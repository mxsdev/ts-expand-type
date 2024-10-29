/* eslint-disable import/no-extraneous-dependencies */
import type * as ts from "typescript/lib/tsserverlibrary"
import { type Language } from "@volar/language-core"
import {
    proxyCreateProgram,
    type TypeScriptServiceScript,
} from "@volar/typescript"
import {
    VueCompilerOptions,
    createParsedCommandLine,
    resolveVueCompilerOptions,
    createVueLanguagePlugin,
} from "@vue/language-core"
import { SourceFileLocation, TypescriptContext } from "./types"

const windowsPathReg = /\\/g

type VuePrograme = ts.Program & {
    // https://github.com/volarjs/volar.js/blob/v2.2.0/packages/typescript/lib/node/proxyCreateProgram.ts#L209
    __volar__?: { language: Language }
    // https://github.com/vuejs/language-tools/blob/v2.0.16/packages/typescript-plugin/index.ts#L75
    __vue__?: { language: Language }
}

let tsPrograme: VuePrograme | undefined

function getMappingOffset(
    language: Language,
    serviceScript: TypeScriptServiceScript
) {
    if (serviceScript.preventLeadingOffset) {
        return 0
    }
    const sourceScript = language.scripts.fromVirtualCode(serviceScript.code)
    return sourceScript.snapshot.getLength()
}

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
        oldProgram: ctx.program,
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
            const vueLanguagePlugin = createVueLanguagePlugin<string>(
                ts,
                options.options,
                vueOptions,
                (id) => id
            )
            return [vueLanguagePlugin]
        }
    )

    tsPrograme = ctx.program

    if (!(tsPrograme?.__vue__ || tsPrograme?.__volar__)) {
        console.log("create vue program")
        tsPrograme = createProgram(options) as VuePrograme
    }

    let fixLocation = (startPos: number) =>
        undefined as ts.LineAndCharacter | undefined

    const language = (tsPrograme.__volar__ || tsPrograme.__vue__)?.language
    if (language?.scripts) {
        const vFile = language.scripts.get(fileName)
        const serviceScript =
            vFile?.generated?.languagePlugin.typescript?.getServiceScript(
                vFile.generated.root
            )
        if (vFile?.generated?.root?.languageId === "vue" && serviceScript) {
            const sourceMap = language.maps.get(serviceScript.code, vFile)

            const snapshotLength = getMappingOffset(language, serviceScript)

            for (const [generatedLocation] of sourceMap.toGeneratedLocation(
                startPos
            )) {
                if (generatedLocation) {
                    startPos = generatedLocation + snapshotLength
                }
            }

            fixLocation = (startPos: number) => {
                for (const [sourceLocation] of sourceMap.toSourceLocation(
                    startPos - snapshotLength
                )) {
                    if (sourceLocation) {
                        const restoreLocation =
                            ctx.sourceFile.getLineAndCharacterOfPosition(
                                sourceLocation
                            )
                        return restoreLocation
                    }
                }

                return undefined
            }
        }
    }

    return [startPos, fixLocation] as const
}
