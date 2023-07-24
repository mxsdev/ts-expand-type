import { TypeInfo } from "@ts-type-explorer/api"
import * as vscode from "vscode"
import { descriptionTypeArgumentsEnabled, descriptionTypeArgumentsMaxLength, iconColorsEnabled, iconsEnabled, maxRecursionDepth, readonlyEnabled, selectionEnabled, showBaseClassInfo, showTypeParameterInfo } from "../config"
import { getTypeTreeAtRange } from "../server"
import { isDocumentSupported, logError, showError } from "../util"
import { TypeTreeItem, TypeTreeProvider } from "../view/typeTreeView"
import { ViewProviders } from "../view/views"
import { ExtensionConfig } from "@ts-type-explorer/api/dist/types"

export class StateManager {
    public typeTree: TypeInfo | undefined
    public typeTreeProvider?: TypeTreeProvider

    private selectionLocked = false
    private selectionEnabled = true

    public initialized = false

    init(
        context: vscode.ExtensionContext,
        { typeTreeProvider }: ViewProviders
    ) {
        this.typeTreeProvider = typeTreeProvider

        this.updateSelectionContext()

        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (
                    event.affectsConfiguration(
                        "typescriptExplorer.typeTree.selection.enable"
                    )
                ) {
                    this.updateSelectionContext()
                }
            },
            undefined,
            context.subscriptions
        )

        vscode.window.onDidChangeTextEditorSelection((e) => {
            if (!isDocumentSupported(e.textEditor.document)) {
                return
            }

            if (
                e.kind === vscode.TextEditorSelectionChangeKind.Command ||
                !e.kind
            ) {
                return
            }

            this.selectTypeAtPosition(
                e.textEditor.document.fileName,
                e.selections
            )
        })

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.typeTree.view.refresh",
                () => typeTreeProvider.refresh()
            )
        )

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.typeTree.view.find",
                () => vscode.commands.executeCommand("list.find")
            )
        )

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.typeTree.view.declared.goTo",
                (item: TypeTreeItem) => item.goToDefinition()
            )
        )

        this.setSelectionLock(this.selectionLocked)

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.selection.lock",
                () => this.setSelectionLock(true)
            )
        )

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.selection.unlock",
                () => this.setSelectionLock(false)
            )
        )

        context.subscriptions.push(
            vscode.commands.registerCommand(
                "typescriptExplorer.selection.select",
                () => {
                    const editor = vscode.window.activeTextEditor

                    if (!editor) {
                        showError("No active text selection!")
                        return
                    }

                    if (!isDocumentSupported(editor.document)) {
                        showError("Document language not supported!")
                        return
                    }

                    this.selectTypeAtPosition(
                        editor.document.fileName,
                        [editor.selection],
                        true
                    )
                }
            )
        )

        this.initialized = true
    }

    setTypeTree(typeTree: TypeInfo | undefined) {
        this.typeTree = typeTree
        this.typeTreeProvider?.refresh()
    }

    getTypeTree() {
        return this.typeTree
    }

    private updateSelectionContext() {
        this.selectionEnabled = selectionEnabled.get()
        vscode.commands.executeCommand(
            "setContext",
            "typescriptExplorer.selection.enabled",
            this.selectionEnabled
        )
    }

    setSelectionLock(locked: boolean) {
        this.selectionLocked = locked

        return vscode.commands.executeCommand<void>(
            "setContext",
            "typescriptExplorer.selection.locked",
            locked
        )
    }

    getSelectionLock() {
        return this.selectionLocked || !this.selectionEnabled
    }

    async selectTypeAtPosition(
        fileName: string,
        selections: readonly vscode.Range[],
        ignoreSelectionLock = false
    ) {
        if (this.getSelectionLock() && !ignoreSelectionLock) {
            return
        }

        if (selections.length === 0) {
            this.setTypeTree(undefined)
            return
        }

        return getTypeTreeAtRange(fileName, selections[0])
            .then((tree) => {
                this.setTypeTree(tree)
            })
            .catch((e) => {
                showError("Error getting type information!")
                logError("TypeTreeRequest error", e)
            })
    }

    getConfiguration(): ExtensionConfig {
        return {
            iconColorsEnabled: iconColorsEnabled.get(),
            descriptionTypeArgumentsEnabled: descriptionTypeArgumentsEnabled.get(),
            descriptionTypeArgumentsMaxLength: descriptionTypeArgumentsMaxLength.get() ?? 10,
            iconsEnabled: iconsEnabled.get(),
            metaTypeArgumentsInFunction: iconsEnabled.get(),
            readonlyEnabled: readonlyEnabled.get(),
            showBaseClassInfo: showBaseClassInfo.get(),
            showTypeParameterInfo: showTypeParameterInfo.get(),
            apiConfig: {
                maxDepth: maxRecursionDepth.get() ?? 6
            },
        }
    }
}
