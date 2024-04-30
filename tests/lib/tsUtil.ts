import { SourceFileTypescriptContext } from "@ts-type-explorer/api"
import assert from "assert"
import * as ts from "typescript"

export function createTsContext(fileName: string): SourceFileTypescriptContext {
    const program = ts.createProgram([fileName], {})
    const sourceFile = program.getSourceFile(fileName)

    assert(sourceFile, "Source file does not exist!")

    const typeChecker = program.getTypeChecker()

    return {
        program,
        sourceFile,
        typeChecker,
        ts,
    }
}
