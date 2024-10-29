import * as vscode from "vscode"
import type * as Proto from "typescript/lib/protocol"
import {
    CustomTypeScriptRequestId,
    CustomTypeScriptRequestOfId,
    CustomTypeScriptResponse,
    CustomTypeScriptResponseBody,
    SourceFileLocation,
    TypeInfo,
} from "@ts-type-explorer/api"
import {
    positionFromLineAndCharacter,
    rangeFromLineAndCharacters,
    rangeToTextRange,
    toFileLocationRequestArgs,
} from "./util"
import { maxRecursionDepth } from "./config"

async function getQuickInfoAtPosition(
    fileName: string,
    position: vscode.Position
) {
    return await vscode.commands
        .executeCommand(
            "typescript.tsserverRequest",
            "quickinfo-full",
            toFileLocationRequestArgs(fileName, position)
        )
        .then(
            (r) => (r as Proto.QuickInfoResponse).body,
            (e) => {
                if (!fileName.endsWith(".vue")) {
                    throw e
                }
            }
        )
}

async function customTypescriptRequest<Id extends CustomTypeScriptRequestId>(
    fileName: string,
    position: vscode.Position,
    request: CustomTypeScriptRequestOfId<Id>
): Promise<CustomTypeScriptResponseBody<Id> | undefined> {
    return await vscode.commands
        .executeCommand("typescript.tsserverRequest", "completionInfo", {
            ...toFileLocationRequestArgs(fileName, position),
            /**
             * We override the "triggerCharacter" property here as a hack so
             * that we can send custom commands to TSServer
             */
            triggerCharacter: request,
        })
        .then((val) => {
            if (!val) return undefined

            const response = val as CustomTypeScriptResponse

            if (response.body.__tsExplorerResponse?.id === "error") {
                const error = response.body.__tsExplorerResponse.error

                const errorObj = new Error(error.message ?? "")
                errorObj.stack = error.stack
                errorObj.name = error.name ?? errorObj.name

                throw errorObj
            }

            return response.body.__tsExplorerResponse as
                | CustomTypeScriptResponseBody<Id>
                | undefined
        })
}

export function getQuickInfoAtLocation(location: SourceFileLocation) {
    return getQuickInfoAtPosition(
        location.fileName,
        positionFromLineAndCharacter(location.range.start)
    )
}

export function getTypeTreeAtLocation(
    location: SourceFileLocation
): Promise<TypeInfo | undefined> {
    return getTypeTreeAtRange(
        location.fileName,
        rangeFromLineAndCharacters(location.range.start, location.range.end)
    )
}

export function getTypeTreeAtRange(
    fileName: string,
    range: vscode.Range
): Promise<TypeInfo | undefined> {
    return customTypescriptRequest(
        fileName,
        positionFromLineAndCharacter(range.start),
        {
            id: "type-tree",
            range: rangeToTextRange(range),
            maxDepth: maxRecursionDepth.get(),
        }
    ).then((res) => res?.typeInfo)
}
