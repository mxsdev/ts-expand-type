import {
    APIConfig,
    CustomTypeScriptRequest,
    CustomTypeScriptResponse,
    CustomTypeScriptResponseBody,
    getTypeInfoAtRange,
    TypescriptContext,
} from "@ts-type-explorer/api"
import { SourceFileTypescriptContext } from "@ts-type-explorer/api"
import type * as ts from "typescript/lib/tsserverlibrary"

// TODO: add config for e.g. max depth

function init(modules: {
    typescript: typeof import("typescript/lib/tsserverlibrary")
}) {
    function create(info: ts.server.PluginCreateInfo) {
        // Set up decorator object
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const proxy: ts.LanguageService = Object.create(null)
        for (const k of Object.keys(info.languageService) as Array<
            keyof ts.LanguageService
        >) {
            const x = info.languageService[k]!
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            // eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-unsafe-return
            proxy[k] = (...args: Array<{}>) =>
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                x.apply(info.languageService, args)
        }

        function getContext(
            fileName: string
        ): SourceFileTypescriptContext | undefined {
            const program = info.project["program"] as ts.Program | undefined

            if (!program) return undefined

            const typeChecker = program.getTypeChecker()
            const sourceFile = program.getSourceFile(fileName)

            if (!sourceFile) return undefined

            return {
                program,
                typeChecker,
                sourceFile,
                ts: modules.typescript,
            }
        }

        proxy.getCompletionsAtPosition = function (...args) {
            // triggerCharacter is "hijacked" with custom request information
            const { triggerCharacter: possiblePayload } = args[2] ?? {}

            if (!possiblePayload || typeof possiblePayload === "string") {
                return info.languageService.getCompletionsAtPosition(...args)
            }

            const payload =
                possiblePayload as unknown as CustomTypeScriptRequest

            const [fileName, position] = args
            const ctx = getContext(fileName)

            let prior = info.languageService.getCompletionsAtPosition(
                fileName,
                position,
                undefined,
                undefined
            ) as
                | (ts.WithMetadata<ts.CompletionInfo> &
                      CustomTypeScriptResponse["body"])
                | undefined

            if (!ctx) {
                return undefined
            }

            prior ??= {
                isGlobalCompletion: false,
                isMemberCompletion: false,
                isNewIdentifierLocation: false,
                entries: [],
            }

            try {
                const responseData = getCustomResponse(ctx, fileName, payload)

                if (responseData) {
                    prior.__tsExplorerResponse = responseData
                }
            } catch (e: unknown) {
                const error = e as Error

                prior.__tsExplorerResponse = {
                    id: "error",
                    error: {
                        message: error.message,
                        stack: error.stack,
                        name: error.name,
                    },
                }
            }

            return prior
        }

        return proxy
    }

    return { create }
}

function getCustomResponse(
    ctx: TypescriptContext,
    fileName: string,
    payload: CustomTypeScriptRequest,
    apiConfig?: Partial<APIConfig>
): CustomTypeScriptResponseBody {
    switch (payload.id) {
        case "type-tree": {
            const { maxDepth } = payload

            const typeInfo = getTypeInfoAtRange(
                ctx,
                {
                    fileName,
                    range: payload.range,
                },
                {
                    ...apiConfig,
                    referenceDefinedTypes: true,
                    ...(maxDepth && { maxDepth }),
                }
            )

            return { id: "type-tree", typeInfo }
        }
    }
}

export = init
