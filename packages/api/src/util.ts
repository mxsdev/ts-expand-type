import type * as ts from "typescript"
import { wrapSafe, isEmpty, filterUndefined } from "./objectUtil"
import {
    SourceFileLocation,
    TypeId,
    TypescriptContext,
    SourceFileTypescriptContext,
    DiscriminatedIndexInfo,
    ParameterInfo,
    SymbolOrType,
} from "./types"
import {
    CheckFlags,
    DeclarationInternal,
    GenericTypeInternal,
    getSymbolConstructor,
    getTypeConstructor,
    IntersectionTypeInternal,
    MappedTypeInternal,
    NodeWithJsDoc,
    ObjectTypeInternal,
    SignatureInternal,
    SymbolInternal,
    SymbolName,
    TransientSymbol,
    UnionTypeInternal,
} from "./typescript"

export function isValidType(type: ts.Type): boolean {
    return (
        !("intrinsicName" in type) ||
        (type as unknown as { intrinsicName: string }).intrinsicName !== "error"
    )
}

export function getSymbolDeclaration(
    symbol?: ts.Symbol
): ts.Declaration | undefined {
    return symbol
        ? symbol.valueDeclaration || symbol.declarations?.[0]
        : undefined
}

export function getSymbolType(
    { typeChecker }: TypescriptContext,
    symbol: ts.Symbol,
    location?: ts.Node
) {
    if (location) {
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)

        if (isValidType(type)) {
            return type
        }
    }

    const declaration = getSymbolDeclaration(symbol)
    if (declaration) {
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration)
        if (isValidType(type)) {
            return type
        }
    }

    const symbolType = typeChecker.getDeclaredTypeOfSymbol(symbol)
    if (isValidType(symbolType)) {
        return symbolType
    }

    const fallbackType = typeChecker.getTypeOfSymbolAtLocation(symbol, {
        parent: {},
    } as unknown as ts.Node)
    return fallbackType
}

export function getNodeSymbol(
    { typeChecker }: TypescriptContext,
    node?: ts.Node
): ts.Symbol | undefined {
    return node
        ? (node as ts.Node & { symbol?: SymbolInternal }).symbol ??
              typeChecker.getSymbolAtLocation(node)
        : undefined
}

export function getNodeType(ctx: TypescriptContext, node: ts.Node) {
    const { typeChecker, ts } = ctx

    const nodeType = typeChecker.getTypeAtLocation(node)
    if (isValidType(nodeType)) return nodeType

    const symbolType = wrapSafe((symbol: ts.Symbol) =>
        getSymbolType(ctx, symbol, node)
    )(getNodeSymbol(ctx, node))
    if (symbolType && isValidType(symbolType)) return symbolType

    if (ts.isTypeNode(node) || (node.parent && ts.isTypeNode(node.parent))) {
        const typeNode = ts.isTypeNode(node)
            ? node
            : ts.isTypeNode(node.parent)
            ? node.parent
            : (undefined as never)

        const typeNodeType = getTypeFromTypeNode(ctx, typeNode)
        if (isValidType(typeNodeType)) return typeNodeType
    }

    if (
        (
            ts as typeof ts & {
                isExpression(node: ts.Node): node is ts.Expression
            }
        ).isExpression(node)
    ) {
        const expressionType = checkExpression(ctx, node)
        if (expressionType && isValidType(expressionType)) return expressionType
    }

    return undefined
}

/**
 * Hack to call typeChecker.checkExpression externally
 */
export function checkExpression(ctx: TypescriptContext, node: ts.Node) {
    const { ts, typeChecker } = ctx

    const symbol = createSymbol(
        ctx,
        ts.SymbolFlags.BlockScopedVariable,
        "type" as ts.__String
    )
    const declaration = {
        kind: ts.SyntaxKind.VariableDeclaration,
        flags: ts.NodeFlags.JavaScriptFile,
        type: {
            kind: ts.SyntaxKind.LiteralType,
            literal: node,
            parent: {
                kind: ts.SyntaxKind.VariableStatement,
            },
        },
        parent: {
            parent: {
                kind: 0,
            },
        },
    } as unknown as ts.Declaration
    symbol.valueDeclaration = declaration

    const type = typeChecker.getTypeOfSymbolAtLocation(symbol, {
        parent: {},
    } as unknown as ts.Node)
    return isValidType(type) ? type : undefined
}

export function getSignaturesOfType(
    { typeChecker, ts }: TypescriptContext,
    type: ts.Type
) {
    return [
        ...typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call),
        ...typeChecker.getSignaturesOfType(type, ts.SignatureKind.Construct),
    ]
}

/**
 * @internal
 */
export function getIndexInfos(
    { typeChecker, ts }: TypescriptContext,
    type: ts.Type
) {
    const indexInfos: DiscriminatedIndexInfo[] = [
        ...typeChecker
            .getIndexInfosOfType(type)
            .map((info) => ({ type: "simple", info } as const)),
    ]

    if (
        indexInfos.length === 0 &&
        type.flags & ts.TypeFlags.Object &&
        (type as ObjectTypeInternal).objectFlags & ts.ObjectFlags.Mapped &&
        !(
            (type as ObjectTypeInternal).objectFlags &
            ts.ObjectFlags.Instantiated
        )
    ) {
        const mappedType = type as MappedTypeInternal

        if (mappedType.typeParameter) {
            indexInfos.push({
                type: "parameter",
                info: {
                    keyType: mappedType.constraintType,
                    type: mappedType.templateType,
                    parameterType: mappedType.typeParameter,
                    declaration: mappedType.declaration,
                },
            })
        }
    }

    return indexInfos
}

/**
 * @internal
 */
export function createType(ctx: TypescriptContext, flags: ts.TypeFlags) {
    return new (getTypeConstructor(ctx))(ctx.typeChecker, flags)
}

/**
 * @internal
 */
export function createObjectType(
    ctx: TypescriptContext,
    objectFlags: ts.ObjectFlags,
    flags: ts.TypeFlags = 2
): ObjectTypeInternal {
    const type = createType(
        ctx,
        flags | ctx.ts.TypeFlags.Object
    ) as ObjectTypeInternal
    type.members = new Map()
    type.objectFlags = objectFlags
    type.properties = []
    type.indexInfos = []
    type.constructSignatures = []
    type.callSignatures = []

    return type
}

/**
 * @internal
 */
export function createUnionType(
    ctx: TypescriptContext,
    types: ts.Type[] = [],
    flags: ts.TypeFlags = 2
): UnionTypeInternal {
    const type = createType(
        ctx,
        flags | ctx.ts.TypeFlags.Union
    ) as UnionTypeInternal

    type.types = types

    return type
}

/**
 * @internal
 */
export function createIntersectionType(
    ctx: TypescriptContext,
    types: ts.Type[] = [],
    flags: ts.TypeFlags = 2
): IntersectionTypeInternal {
    const type = createType(
        ctx,
        flags | ctx.ts.TypeFlags.Intersection
    ) as IntersectionTypeInternal

    type.types = types

    return type
}

/**
 * @internal
 */
export function createSymbol(
    ctx: TypescriptContext,
    flags: ts.SymbolFlags,
    name: SymbolName,
    checkFlags?: number
) {
    const symbol = new (getSymbolConstructor(ctx))(
        flags | ctx.ts.SymbolFlags.Transient,
        name
    ) as SymbolInternal
    symbol.checkFlags = checkFlags || 0
    return symbol
}

export function multilineTypeToString(
    { typeChecker, sourceFile, ts }: SourceFileTypescriptContext,
    type: ts.Type,
    enclosingDeclaration?: ts.Node,
    flags: ts.NodeBuilderFlags = 0
) {
    const typeNode = typeChecker.typeToTypeNode(
        type,
        enclosingDeclaration,
        flags
    )
    if (!typeNode) return ""

    const printer = ts.createPrinter()
    return printer.printNode(ts.EmitHint.Unspecified, typeNode, sourceFile)
}

export function getTypeId(
    type: ts.Type,
    symbol?: ts.Symbol,
    node?: ts.Node
): TypeId {
    const ids: (number | undefined)[] = [
        (type as ts.Type & { id: number })?.id,
        (symbol as ts.Symbol & { id?: number })?.id,
        (node as ts.Node & { id?: number })?.id,
    ]

    return ids.map((x) => (x === undefined ? "" : x.toString())).join(",")
}

export function getEmptyTypeId(): TypeId {
    return ""
}

export function isPureObject(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.ObjectType {
    const { ts } = ctx

    return (
        (!!(type.flags & ts.TypeFlags.Object) &&
            getIndexInfos(ctx, type).length === 0 &&
            isPureObjectOrMappedTypeShallow(ctx, type)) ||
        (!!(type.flags & ts.TypeFlags.Intersection) &&
            (type as ts.IntersectionType).types.every((t) =>
                isPureObject(ctx, t)
            ))
    )
}

export function isPureObjectOrMappedTypeShallow(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.ObjectType {
    const { ts } = ctx

    return (
        !!(type.flags & ts.TypeFlags.Object) &&
        getSignaturesOfType(ctx, type).length === 0 &&
        !isArrayType(ctx, type) &&
        !isTupleType(ctx, type)
    )
}

export function getIntersectionTypesFlat(
    { ts }: TypescriptContext,
    ...types: ts.Type[]
): ts.Type[] {
    return types.flatMap((type) =>
        type.flags & ts.TypeFlags.Intersection
            ? (type as ts.IntersectionType).types
            : [type]
    )
}

export function isInterfaceType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.InterfaceType {
    const { ts } = ctx
    return !!(getObjectFlags(ctx, type) & ts.ObjectFlags.Interface)
}

export function isClassType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.InterfaceType {
    const { ts } = ctx
    return !!(getObjectFlags(ctx, type) & ts.ObjectFlags.Class)
}

export function isClassOrInterfaceType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.InterfaceType {
    const { ts } = ctx
    return !!(getObjectFlags(ctx, type) & ts.ObjectFlags.ClassOrInterface)
}

export function isReadonlyArrayType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.TypeReference {
    return (
        !!isObjectReference(ctx, type) &&
        type.target.getSymbol()?.getName() === "ReadonlyArray"
    )
}

export function isArrayType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.TypeReference {
    return (
        !!isObjectReference(ctx, type) &&
        (type.target.getSymbol()?.getName() === "Array" ||
            isReadonlyArrayType(ctx, type))
    )
}

export function isTupleType(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.TypeReference {
    return !!(
        isObjectReference(ctx, type) &&
        type.target.objectFlags & ctx.ts.ObjectFlags.Tuple
    )
}

export function isReadonlyTupleType(ctx: TypescriptContext, type: ts.Type) {
    return !!(
        isTupleType(ctx, type) && (type.target as GenericTypeInternal).readonly
    )
}

export function isObjectReference(
    ctx: TypescriptContext,
    type: ts.Type
): type is ts.TypeReference {
    const { ts } = ctx
    return !!(getObjectFlags(ctx, type) & ts.ObjectFlags.Reference)
}

export function getTypeFromTypeNode(
    { typeChecker }: TypescriptContext,
    node: ts.TypeNode,
    enclosingDeclaration?: ts.Node
) {
    return typeChecker.getTypeFromTypeNode(node)
}

export function getTypeArguments<T extends ts.Type>(
    ctx: TypescriptContext,
    type: T,
    node?: ts.Node
): readonly ts.Type[] | undefined {
    const typeArgumentsOfType = isObjectReference(ctx, type)
        ? ctx.typeChecker.getTypeArguments(type)
        : undefined

    if (node && isEmpty(typeArgumentsOfType)) {
        const typeArgumentDefinitions =
            (node as ts.NodeWithTypeArguments).typeArguments ??
            (node.parent as ts.NodeWithTypeArguments)?.typeArguments
        const typeArgumentsOfNode = wrapSafe(filterUndefined)(
            typeArgumentDefinitions?.map((node) =>
                getTypeFromTypeNode(ctx, node)
            )
        )

        if (typeArgumentsOfNode?.length === typeArgumentDefinitions?.length) {
            return typeArgumentsOfNode
        }
    }

    return typeArgumentsOfType
}

export function getTypeParameters(
    ctx: TypescriptContext,
    type: ts.Type,
    symbol?: ts.Symbol
): readonly ts.Type[] | undefined {
    if (isClassOrInterfaceType(ctx, type)) {
        return type.typeParameters
    } else if (
        symbol &&
        symbol.declarations &&
        symbol.declarations.length === 1
    ) {
        const typeParameterDeclarations =
            (
                symbol.declarations[0] as ts.Declaration & {
                    typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>
                }
            ).typeParameters ??
            ctx.typeChecker.symbolToTypeParameterDeclarations(
                symbol,
                undefined,
                undefined
            )
        if (isEmpty(typeParameterDeclarations)) return undefined

        const typeParameterTypes: ts.Type[] = filterUndefined(
            typeParameterDeclarations.map((decl) => getNodeType(ctx, decl))
        )

        if (typeParameterDeclarations.length === typeParameterTypes.length) {
            return typeParameterTypes
        }
    }

    return undefined
}

export function getObjectFlags(
    { ts }: TypescriptContext,
    type: ts.Type
): number {
    return (
        type.flags & ts.TypeFlags.Object &&
        (type as ObjectTypeInternal).objectFlags
    )
}

/**
 * @internal
 */
export function getParameterInfo(
    ctx: TypescriptContext,
    parameter: ts.Symbol,
    signature?: ts.Signature
): ParameterInfo {
    const { typeChecker, ts } = ctx

    const parameterDeclaration = typeChecker.symbolToParameterDeclaration(
        parameter,
        signature?.getDeclaration(),
        undefined
    )
    const baseParameterDeclaration = parameter
        .getDeclarations()
        ?.find((x) => x.kind && ts.SyntaxKind.Parameter && x.parent) as
        | ts.ParameterDeclaration
        | undefined

    if (parameterDeclaration) {
        return {
            optional: !!parameterDeclaration.questionToken,
            isRest: !!parameterDeclaration.dotDotDotToken,
        }
    }

    return {
        optional: !!(
            (baseParameterDeclaration &&
                typeChecker.isOptionalParameter(baseParameterDeclaration)) ||
            getCheckFlags(ctx, parameter) & CheckFlags.OptionalParameter
        ),
        isRest: !!(
            (baseParameterDeclaration &&
                baseParameterDeclaration.dotDotDotToken) ||
            getCheckFlags(ctx, parameter) & CheckFlags.RestParameter
        ),
    }
}

/**
 * @internal
 */
export function getCheckFlags(
    { ts }: TypescriptContext,
    symbol: ts.Symbol
): CheckFlags {
    return symbol.flags & ts.SymbolFlags.Transient
        ? (symbol as TransientSymbol).checkFlags
        : 0
}

export function pseudoBigIntToString(value: ts.PseudoBigInt) {
    return (value.negative ? "-" : "") + value.base10Value
}

export function getImplementsTypes(
    ctx: TypescriptContext,
    type: ts.InterfaceType
): ts.BaseType[] {
    const resolvedImplementsTypes: ts.BaseType[] = []

    if (type.symbol?.declarations) {
        for (const declaration of type.symbol.declarations) {
            const implementsTypeNodes = getEffectiveImplementsTypeNodes(
                ctx,
                declaration as ts.ClassLikeDeclaration
            )
            if (!implementsTypeNodes) continue
            for (const node of implementsTypeNodes) {
                const implementsType = getTypeFromTypeNode(ctx, node)
                if (isValidType(implementsType)) {
                    resolvedImplementsTypes.push(implementsType)
                }
            }
        }
    }
    return resolvedImplementsTypes
}

function isInJSFile(
    { ts }: TypescriptContext,
    node: ts.Node | undefined
): boolean {
    return !!node && !!(node.flags & ts.NodeFlags.JavaScriptFile)
}

function getEffectiveImplementsTypeNodes(
    ctx: TypescriptContext,
    node: ts.ClassLikeDeclaration
): undefined | readonly ts.ExpressionWithTypeArguments[] {
    if (isInJSFile(ctx, node)) {
        return getJSDocImplementsTags(ctx, node).map((n) => n.class)
    } else {
        const heritageClause = getHeritageClause(
            node.heritageClauses,
            ctx.ts.SyntaxKind.ImplementsKeyword
        )
        return heritageClause?.types
    }
}

function getJSDocImplementsTags(
    ctx: TypescriptContext,
    node: ts.Node
): readonly ts.JSDocImplementsTag[] {
    return ctx.ts.getAllJSDocTags(node, (tag): tag is ts.JSDocImplementsTag =>
        isJSDocImplementsTag(ctx, tag)
    )
}

function isJSDocImplementsTag(
    { ts }: TypescriptContext,
    node: ts.Node
): node is ts.JSDocImplementsTag {
    return node.kind === ts.SyntaxKind.JSDocImplementsTag
}

function getHeritageClause(
    clauses: ts.NodeArray<ts.HeritageClause> | undefined,
    kind: ts.SyntaxKind
) {
    if (clauses) {
        for (const clause of clauses) {
            if (clause.token === kind) {
                return clause
            }
        }
    }

    return undefined
}

export function getConstructSignatures(
    ctx: TypescriptContext,
    type: ts.InterfaceType
): readonly ts.Signature[] {
    const symbol = type.getSymbol()

    if (symbol && symbol.flags & ctx.ts.SymbolFlags.Class) {
        const classType = getSymbolType(ctx, symbol)
        return classType.getConstructSignatures()
    }

    return []
}

function getLeftHandSideExpression(node: ts.CallLikeExpression) {
    if ("tag" in node) {
        return node.tag
    } else if ("tagName" in node) {
        return node.tagName
    } else if ("left" in node) {
        return node.left
    } else {
        return node.expression
    }
}

function getCallLikeExpressionName(
    { ts }: TypescriptContext,
    node: ts.CallLikeExpression
) {
    const lhsExpression = getLeftHandSideExpression(node)

    return (lhsExpression as unknown as DeclarationInternal).name
}

export function getCallLikeExpression(ctx: TypescriptContext, node: ts.Node) {
    const { ts } = ctx
    const originalNode = node

    while (node && !ts.isSourceFile(node)) {
        if (ts.isCallLikeExpression(node)) {
            if (
                getLeftHandSideExpression(node) === originalNode ||
                originalNode === getCallLikeExpressionName(ctx, node)
            ) {
                return node
            }

            return undefined
        }

        node = node.parent
    }

    return undefined
}

/**
 * @internal
 */
export function getResolvedSignature(
    ctx: TypescriptContext,
    node?: ts.Node
): SignatureInternal | undefined {
    if (!node) return undefined

    const callExpression = getCallLikeExpression(ctx, node)

    return callExpression
        ? (ctx.typeChecker.getResolvedSignature(
              callExpression
          ) as SignatureInternal)
        : undefined
}

export function getSignatureTypeArguments(
    ctx: TypescriptContext,
    signature: ts.Signature,
    enclosingDeclaration?: ts.Node
): readonly ts.Type[] {
    const { typeChecker, ts } = ctx

    const target = (signature as SignatureInternal).target

    if (!target) {
        return []
    }

    // workaround to force instantiation of signature type arguments
    return typeChecker.getTypeArguments({
        node: {
            kind: ts.SyntaxKind.TypeReference,
        },
        target: {
            outerTypeParameters: target.typeParameters ?? [],
            localTypeParameters: [],
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        mapper: (signature as SignatureInternal).mapper,
    } as unknown as ts.TypeReference)
}

export function getDescendantAtPosition(
    ctx: TypescriptContext,
    sourceFile: ts.SourceFile,
    position: number
) {
    return getDescendantAtRange(ctx, sourceFile, [position, position])
}

/**
 * https://github.com/dsherret/ts-ast-viewer/blob/b4be8f2234a1c3c099296bf5d0ad6cc14107367c/site/src/compiler/getDescendantAtRange.ts
 */
export function getDescendantAtRange(
    { ts }: TypescriptContext,
    sourceFile: ts.SourceFile,
    range: [number, number]
) {
    let bestMatch: { node: ts.Node; start: number } = {
        node: sourceFile,
        start: sourceFile.getStart(sourceFile),
    }
    searchDescendants(sourceFile)
    return bestMatch.node

    function searchDescendants(node: ts.Node) {
        const children: ts.Node[] = []
        node.forEachChild((child) => {
            children.push(child)
            return undefined
        })

        for (const child of children) {
            if (child.kind !== ts.SyntaxKind.SyntaxList) {
                if (isBeforeRange(child.end)) {
                    continue
                }

                const childStart = getStartSafe(child, sourceFile)

                if (isAfterRange(childStart)) {
                    return
                }

                const isEndOfFileToken =
                    child.kind === ts.SyntaxKind.EndOfFileToken
                const hasSameStart =
                    bestMatch.start === childStart && range[0] === childStart
                if (!isEndOfFileToken && !hasSameStart) {
                    bestMatch = { node: child, start: childStart }
                }
            }

            searchDescendants(child)
        }
    }

    function isBeforeRange(pos: number) {
        return pos < range[0]
    }

    function isAfterRange(nodeEnd: number) {
        return nodeEnd >= range[0] && nodeEnd > range[1]
    }

    function getStartSafe(node: ts.Node, sourceFile: ts.SourceFile) {
        // workaround for compiler api bug with getStart(sourceFile, true) (see PR #35029 in typescript repo)
        const jsDocs = (node as NodeWithJsDoc).jsDoc
        if (jsDocs && jsDocs.length > 0) {
            return jsDocs[0].getStart(sourceFile)
        }
        return node.getStart(sourceFile)
    }
}

export function getSourceFileLocation(
    sourceFile: ts.SourceFile,
    node: ts.Node
): SourceFileLocation | undefined {
    const startPos = node.getStart()
    const endPos = node.getEnd()

    if (startPos < 0 || endPos < 0) {
        return undefined
    }

    const start = sourceFile.getLineAndCharacterOfPosition(startPos)
    const end = sourceFile.getLineAndCharacterOfPosition(endPos)

    return {
        fileName: sourceFile.fileName,
        range: {
            start,
            end,
        },
    }
}

export function getSymbolOrTypeOfNode(
    ctx: TypescriptContext,
    node: ts.Node
): SymbolOrType | undefined {
    const { typeChecker } = ctx

    const symbol =
        typeChecker.getSymbolAtLocation(node) ?? getNodeSymbol(ctx, node)

    if (symbol) {
        const symbolType = getSymbolType(ctx, symbol, node)

        if (
            isValidType(symbolType) ||
            symbol.flags & ctx.ts.SymbolFlags.Module
        ) {
            return { symbol, node }
        }
    }

    const type = getNodeType(ctx, node)

    if (type) {
        return { type, node }
    }

    return undefined
}

/**
 * Tries to find subnode that can be retrieved later
 * by the client
 *
 * For example, consider:
 *
 * `export enum Enum { ... }`
 *
 * If the client tries to retrieve the entire `EnumDeclaration`
 * node, then it will go from character 0, which will find the
 * `export` token, which does not have a type. In this case,
 * the node is narrowed to its identifier - `Enum` in this case
 *
 * @param node
 */
export function narrowDeclarationForLocation(node: ts.Declaration) {
    return (node as DeclarationInternal).name ?? node
}

function getDeclarationModifierFlagsFromSymbol(
    ctx: TypescriptContext,
    symbol: ts.Symbol
): ts.ModifierFlags {
    // @ts-expect-error - ts internal
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return ctx.ts.getDeclarationModifierFlagsFromSymbol(
        symbol
    ) as ts.ModifierFlags
}

function getDeclarationNodeFlagsFromSymbol(
    ctx: TypescriptContext,
    symbol: ts.Symbol
): ts.NodeFlags {
    return symbol.valueDeclaration
        ? ctx.ts.getCombinedNodeFlags(symbol.valueDeclaration)
        : 0
}

export function isReadonlySymbol(
    ctx: TypescriptContext,
    symbol: ts.Symbol
): boolean {
    const { ts } = ctx

    return !!(
        (
            getCheckFlags(ctx, symbol) & CheckFlags.Readonly ||
            (symbol.flags & ts.SymbolFlags.Property &&
                getDeclarationModifierFlagsFromSymbol(ctx, symbol) &
                    ts.ModifierFlags.Readonly) ||
            // (symbol.flags & ts.SymbolFlags.Variable &&
            //     getDeclarationNodeFlagsFromSymbol(ctx, symbol) &
            //         ts.NodeFlags.Const) ||
            (symbol.flags & ts.SymbolFlags.Accessor &&
                !(symbol.flags & ts.SymbolFlags.SetAccessor))
        )
        // symbol.flags & ts.SymbolFlags.EnumMember
        // TODO: implement this eventually
        // some(symbol.declarations, isReadonlyAssignmentDeclaration)
    )
}

export function getAliasedSymbol(
    { typeChecker, ts }: TypescriptContext,
    symbol: ts.Symbol
) {
    if (!(symbol.flags & ts.SymbolFlags.Alias)) return undefined

    return typeChecker.getAliasedSymbol(symbol)
}

export function getSymbolExports(symbol: ts.Symbol): ts.Symbol[] {
    const result: ts.Symbol[] = []

    symbol.exports?.forEach((value) => result.push(value))
    symbol.globalExports?.forEach((value) => result.push(value))

    return result
}

export function isNamespace(
    { ts }: TypescriptContext,
    symbol: ts.Symbol
): boolean {
    const declaration = getDeclarationOfKind<ts.ModuleDeclaration>(
        symbol,
        ts.SyntaxKind.ModuleDeclaration
    )
    const isNamespace =
        declaration &&
        declaration.name &&
        declaration.name.kind === ts.SyntaxKind.Identifier

    return !!isNamespace
}

function getDeclarationOfKind<T extends ts.Declaration>(
    symbol: ts.Symbol,
    kind: T["kind"]
): T | undefined {
    const declarations = symbol.declarations
    if (declarations) {
        for (const declaration of declarations) {
            if (declaration.kind === kind) {
                return declaration as T
            }
        }
    }

    return undefined
}
