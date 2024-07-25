/* eslint-disable import/no-extraneous-dependencies */
import type * as ts from "typescript/lib/tsserverlibrary"
import { type Language } from "@volar/language-core"
import { proxyCreateProgram } from "@volar/typescript"
import {
    VueCompilerOptions,
    createParsedCommandLine,
    createVueLanguagePlugin,
    resolveVueCompilerOptions,
} from "@vue/language-core"
import * as SourceMaps from "@volar/source-map"
import { SourceFileLocation, TypescriptContext } from "./types"

const windowsPathReg = /\\/g

type VuePrograme = ts.Program & {
    // https://github.com/volarjs/volar.js/blob/v2.2.0/packages/typescript/lib/node/proxyCreateProgram.ts#L209
    __volar__?: { language: Language }
    // https://github.com/vuejs/language-tools/blob/v2.0.16/packages/typescript-plugin/index.ts#L75
    __vue__?: { language: Language }
}

let oldPrograme: VuePrograme | undefined

export function getPositionOfLineAndCharacterForVue(
    ctx: TypescriptContext & { sourceFile: ts.SourceFile },
    location: SourceFileLocation,
    startPos = -1
) {
    const fileName = location.fileName

    const compilerOptions = {
        ...ctx.program.getCompilerOptions(),
        rootDir: ctx.program.getCurrentDirectory(),
        declaration: true,
        emitDeclarationOnly: true,
        allowNonTsExtensions: true,
    }

    const options: ts.CreateProgramOptions = {
        host: ctx.ts.createCompilerHost(compilerOptions),
        rootNames: ctx.program.getRootFileNames(),
        options: compilerOptions,
        oldProgram: oldPrograme || ctx.program,
    }

    let vueOptions: VueCompilerOptions
    const createProgram = proxyCreateProgram(
        ctx.ts,
        ctx.ts.createProgram,
        (ts, _options) => {
            const { configFilePath } = _options.options
            vueOptions =
                typeof configFilePath === "string"
                    ? createParsedCommandLine(
                          ts,
                          ts.sys,
                          configFilePath.replace(windowsPathReg, "/")
                      ).vueOptions
                    : resolveVueCompilerOptions({
                          extensions: [".vue", ".cext"],
                      })
            return [
                createVueLanguagePlugin(
                    ts,
                    (id) => id,
                    _options.host?.useCaseSensitiveFileNames?.() ?? false,
                    () => "",
                    () =>
                        _options.rootNames.map((rootName) =>
                            rootName.replace(windowsPathReg, "/")
                        ),
                    _options.options,
                    vueOptions
                ),
            ]
        }
    )

    oldPrograme = oldPrograme ?? ctx.program

    if (!oldPrograme?.__vue__ && !oldPrograme?.__volar__) {
        console.log("create vue program")
        oldPrograme = createProgram(options) as VuePrograme
    }

    const language = (oldPrograme.__volar__ || oldPrograme.__vue__)?.language
    if (language?.scripts) {
        const vFile = language.scripts.get(fileName)
        const serviceScript =
            vFile?.generated?.languagePlugin.typescript?.getServiceScript(
                vFile.generated.root
            )
        if (vFile?.generated?.root?.languageId === "vue" && serviceScript) {
            const sourceMap = language.maps.get(serviceScript.code, vFile.id)

            const snapshotLength = vFile?.generated?.root?.snapshot?.getLength()
            if (startPos < snapshotLength) {
                startPos =
                    (sourceMap?.getGeneratedOffset?.(startPos)?.[0] || -1) +
                    // https://github.com/volarjs/volar.js/blob/v2.2.0-alpha.12/packages/typescript/lib/node/proxyCreateProgram.ts#L143
                    (snapshotLength || 0)
            }
        }
    }

    return [
        startPos,
        (startPos: number) => {
            if (!oldPrograme?.__vue__ && !oldPrograme?.__volar__) {
                console.log("create vue program")
                oldPrograme = createProgram(options) as VuePrograme
            }

            const language = (oldPrograme.__volar__ || oldPrograme.__vue__)
                ?.language

            if (language?.scripts) {
                const vFile = language.scripts.get(fileName)
                const serviceScript =
                    vFile?.generated?.languagePlugin.typescript?.getServiceScript(
                        vFile.generated.root
                    )
                if (
                    vFile?.generated?.root?.languageId === "vue" &&
                    serviceScript
                ) {
                    const code = vFile?.generated?.root?.embeddedCodes?.[0]
                    if (code) {
                        const sourceMap = language.maps.get(
                            serviceScript.code,
                            vFile.id
                        )

                        const snapshotLength =
                            vFile?.generated?.root?.snapshot?.getLength()

                        if (startPos > snapshotLength) {
                            const restoreStartPos = sourceMap?.getSourceOffset(
                                startPos - snapshotLength
                            )?.[0]

                            if (restoreStartPos) {
                                const restoreLocation =
                                    ctx.sourceFile.getLineAndCharacterOfPosition(
                                        restoreStartPos
                                    )

                                return restoreLocation
                            }
                        }
                    }
                }
            }

            return undefined
        },
    ] as const
}
