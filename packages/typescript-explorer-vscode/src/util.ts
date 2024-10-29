import * as vscode from "vscode"
import type * as ts from "typescript"
import { TextRange } from "@ts-type-explorer/api"
import type * as Proto from "typescript/lib/protocol"
import { dialogueErrors, logErrors } from "./config"

export const positionToLineAndCharacter = (
    position: vscode.Position
): ts.LineAndCharacter => ({
    line: position.line,
    character: position.character,
})

export const rangeToTextRange = (range: vscode.Range): TextRange => ({
    start: positionFromLineAndCharacter(range.start),
    end: positionFromLineAndCharacter(range.end),
})

export const toFileLocationRequestArgs = (
    file: string,
    position: vscode.Position
): Proto.FileLocationRequestArgs => ({
    file,
    line: position.line + 1,
    offset: position.character + 1,
})

export const positionFromLineAndCharacter = ({
    line,
    character,
}: ts.LineAndCharacter) => new vscode.Position(line, character)

export const rangeFromLineAndCharacters = (
    start: ts.LineAndCharacter,
    end: ts.LineAndCharacter
) =>
    new vscode.Range(
        positionFromLineAndCharacter(start),
        positionFromLineAndCharacter(end)
    )

export function getTypescriptMd(code: string) {
    const mds = new vscode.MarkdownString()
    mds.appendCodeblock(code, "typescript")
    return mds
}

/**
 * Smartly set configuration value based on workspace configuration. This will set
 * configuration on a workspace level if a workspace value has been set, and will
 * set it globally otherwise.
 *
 * This will also reset a config value if it is set to its default.
 *
 * @param id
 * @param value
 * @param config Config object to use, defaults to workspace configuration
 */
export function smartlySetConfigValue<T>(
    id: string,
    value: T,
    config?: vscode.WorkspaceConfiguration
) {
    config ??= vscode.workspace.getConfiguration()
    const { workspaceValue, defaultValue } = config.inspect<T>(id) ?? {}

    let setValue: T | undefined = value

    if (defaultValue !== undefined && defaultValue === value) {
        setValue = undefined
    }

    return config.update(id, setValue, workspaceValue === undefined)
}

export function showError(message: string) {
    if (dialogueErrors.get()) {
        vscode.window.showErrorMessage(message)
    }
}

export function logError(...messages: unknown[]) {
    if (logErrors.get()) {
        console.error(...messages)
    }
}

export function isDocumentSupported({ languageId }: vscode.TextDocument) {
    return (
        languageId === "typescript" ||
        languageId === "javascript" ||
        languageId === "typescriptreact" ||
        languageId === "javascriptreact" ||
        languageId === "vue"
    )
}
