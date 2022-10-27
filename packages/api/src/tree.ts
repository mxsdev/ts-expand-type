import * as assert from "assert"
import type * as ts from "typescript"
import { APIConfig } from "./config"
import {
    DeclarationInfo,
    IndexInfo,
    SignatureInfo,
    SourceFileLocation,
    SymbolInfo,
    TypeId,
    TypeInfo,
    TypeInfoNoId,
} from "./types"
import { SymbolFlags } from "./typescript"
import {
    getIndexInfos,
    getIntersectionTypesFlat,
    getSymbolType,
    getTypeId,
    TSIndexInfoMerged,
    isPureObject,
    wrapSafe,
    isArrayType,
    getTypeArguments,
    isTupleType,
    getParameterInfo,
    IntrinsicTypeInternal,
    TSSymbol,
    isClassType,
    isInterfaceType,
    getImplementsTypes,
    filterUndefined,
    getConstructSignatures,
    getEmptyTypeId,
    getTypeParameters,
    isNonEmpty,
    arrayContentsEqual,
    getResolvedSignature,
    getSignatureTypeArguments,
    getSourceFileLocation,
    getNodeSymbol,
    TypescriptContext,
    removeDuplicates,
} from "./util"

const maxDepthExceeded: TypeInfo = { kind: "max_depth", id: getEmptyTypeId() }

type TypeTreeContext = {
    typescriptContext: TypescriptContext
    config: APIConfig
    seen: Set<TypeId>
    depth: number
}

type SymbolOrType = (
    | { symbol: ts.Symbol; type?: undefined }
    | { type: ts.Type; symbol?: undefined }
) & { node?: ts.Node }

export function generateTypeTree(
    symbolOrType: SymbolOrType,
    typescriptContext: TypescriptContext,
    config?: APIConfig
) {
    return _generateTypeTree(symbolOrType, {
        typescriptContext,
        config: config ?? new APIConfig(),
        seen: new Set(),
        depth: 0,
    })
}

type TypeTreeOptions = {
    optional?: boolean
    isRest?: boolean
    insideClassOrInterface?: boolean
}

function _generateTypeTree(
    { symbol, type, node }: SymbolOrType,
    ctx: TypeTreeContext,
    options?: TypeTreeOptions
): TypeInfo {
    assert(symbol || type, "Must provide either symbol or type")
    ctx.depth++

    const originalSymbol = symbol

    const { typescriptContext: tsCtx } = ctx
    const maxDepth = ctx.config.maxDepth

    const { typeChecker, ts } = tsCtx

    if (ctx.depth > maxDepth) {
        // TODO: allow custom maximum depth
        ctx.depth--
        return maxDepthExceeded
    }

    if (!type) {
        type = getSymbolType(tsCtx, symbol!)
    }

    let isAnonymousSymbol = !symbol

    if (!symbol) {
        const associatedSymbol = type.getSymbol()

        if (
            associatedSymbol &&
            !isArrayType(tsCtx, type) &&
            !isTupleType(tsCtx, type)
        ) {
            isAnonymousSymbol = associatedSymbol.name === "__type"
            symbol = associatedSymbol
        }
    }

    let classSymbol: ts.Symbol | undefined

    const {
        isConstructCallExpression,
        signatureTypeArguments,
        signatures,
        constructSignatures,
        signature,
    } = resolveSignature(tsCtx, type, node)

    if (type.symbol) {
        if (type.symbol.flags & SymbolFlags.Class) {
            const classDefinition = type.symbol.declarations?.[0] as
                | ts.NamedDeclaration
                | undefined
            if (classDefinition && classDefinition.name) {
                classSymbol = type.symbol
            }

            if (
                !isConstructCallExpression &&
                symbol &&
                symbol.flags & SymbolFlags.Class
            ) {
                const returnType = wrapSafe((sig: ts.Signature) =>
                    typeChecker.getReturnTypeOfSignature(sig)
                )(constructSignatures[0])

                type = returnType ?? type
            }
        }
    }

    let typeInfo: TypeInfoNoId
    const id = getTypeId(type, symbol, node)

    if (!ctx.seen?.has(id)) {
        const locations: SourceFileLocation[] = filterUndefined([
            ...(getSymbolLocations(originalSymbol) ?? []),
        ])

        if (
            ctx.config.referenceDefinedTypes &&
            ctx.depth > 1 &&
            isNonEmpty(locations) &&
            originalSymbol &&
            !(
                originalSymbol.flags & ts.SymbolFlags.Property &&
                locations.length > 1
            ) &&
            // ensures inferred types on e.g. function
            // parameter symbols are referenced properly
            type ===
                getSymbolType(
                    tsCtx,
                    (originalSymbol as TSSymbol).target ?? originalSymbol,
                    node
                )
        ) {
            typeInfo = { kind: "reference", location: locations[0] }
        } else {
            ctx.seen?.add(id)
            typeInfo = createNode(type)
        }
    } else {
        typeInfo = { kind: "reference" }
    }

    const typeInfoId = typeInfo as TypeInfo

    typeInfoId.symbolMeta = wrapSafe(getSymbolInfo)(
        symbol,
        isAnonymousSymbol,
        options
    )

    let aliasSymbol = type.aliasSymbol

    if (isInterfaceType(tsCtx, type)) {
        aliasSymbol ??= type.symbol
    }

    if (aliasSymbol && aliasSymbol !== symbol) {
        typeInfoId.aliasSymbolMeta = getSymbolInfo(aliasSymbol)
    }

    if (typeInfoId.kind !== "reference") {
        const typeParameters = getTypeParameters(tsCtx, type, symbol)
        if (isNonEmpty(typeParameters)) {
            typeInfoId.typeParameters = parseTypes(typeParameters)
        }

        const typeArguments = !signature
            ? getTypeArguments(tsCtx, type, node)
            : signatureTypeArguments
        if (
            !isArrayType(tsCtx, type) &&
            !isTupleType(tsCtx, type) &&
            isNonEmpty(typeArguments) &&
            !(
                typeParameters &&
                arrayContentsEqual(typeArguments, typeParameters)
            )
        ) {
            typeInfoId.typeArguments = parseTypes(typeArguments)
        }
    }

    typeInfoId.id = id

    ctx.depth--
    return typeInfoId

    function createNode(type: ts.Type): TypeInfoNoId {
        const flags = type.getFlags()

        if (flags & ts.TypeFlags.TypeParameter) {
            return {
                kind: "type_parameter",
                baseConstraint: wrapSafe(parseType)(
                    typeChecker.getBaseConstraintOfType(type)
                ),
                defaultType: wrapSafe(parseType)(
                    typeChecker.getDefaultFromTypeParameter(type)
                ),
                ...(type.symbol &&
                    type.symbol !== symbol &&
                    type.symbol !== type.aliasSymbol && {
                        typeSymbolMeta: getSymbolInfo(type.symbol),
                    }),
            }
        } else if (flags & ts.TypeFlags.Any) {
            if ((type as IntrinsicTypeInternal).intrinsicName === "intrinsic") {
                return { kind: "intrinsic" }
            }

            return { kind: "primitive", primitive: "any" }
        } else if (flags & ts.TypeFlags.Unknown) {
            return { kind: "primitive", primitive: "unknown" }
        } else if (flags & ts.TypeFlags.Undefined) {
            return { kind: "primitive", primitive: "undefined" }
        } else if (flags & ts.TypeFlags.Null) {
            return { kind: "primitive", primitive: "null" }
        } else if (flags & ts.TypeFlags.Boolean) {
            return { kind: "primitive", primitive: "boolean" }
        } else if (flags & ts.TypeFlags.String) {
            return { kind: "primitive", primitive: "string" }
        } else if (flags & ts.TypeFlags.Number) {
            return { kind: "primitive", primitive: "number" }
        } else if (flags & ts.TypeFlags.Void) {
            return { kind: "primitive", primitive: "void" }
        } else if (flags & ts.TypeFlags.EnumLiteral) {
            return {
                kind: "enum_literal",
                value: (type as ts.StringLiteralType).value,
                literalSymbol: getSymbolInfo(type.symbol),
                parentSymbol: wrapSafe(getSymbolInfo)(
                    (type.symbol as TSSymbol).parent
                ),
            }
        } else if (flags & ts.TypeFlags.Enum) {
            return { kind: "enum" }
        } else if (flags & ts.TypeFlags.BigInt) {
            return { kind: "primitive", primitive: "bigint" }
        } else if (
            flags & ts.TypeFlags.ESSymbol ||
            flags & ts.TypeFlags.ESSymbolLike
        ) {
            return { kind: "primitive", primitive: "essymbol" }
        } else if (flags & ts.TypeFlags.UniqueESSymbol) {
            return { kind: "primitive", primitive: "unique_symbol" }
        } else if (flags & ts.TypeFlags.Never) {
            return { kind: "primitive", primitive: "never" }
        } else if (flags & ts.TypeFlags.StringLiteral) {
            return {
                kind: "string_literal",
                value: (type as ts.StringLiteralType).value,
            }
        } else if (flags & ts.TypeFlags.NumberLiteral) {
            return {
                kind: "number_literal",
                value: (type as ts.NumberLiteralType).value,
            }
        } else if (flags & ts.TypeFlags.BooleanLiteral) {
            return {
                kind: "boolean_literal",
                value: (type as IntrinsicTypeInternal).intrinsicName === "true",
            }
        } else if (flags & ts.TypeFlags.BigIntLiteral) {
            return {
                kind: "bigint_literal",
                value: (type as ts.BigIntLiteralType).value,
            }
        } else if (flags & ts.TypeFlags.Object) {
            const { symbol: typeSymbol } = type
            if (typeSymbol && typeSymbol.flags & SymbolFlags.Enum) {
                return {
                    kind: "enum",
                    properties: parseSymbols(type.getProperties()),
                }
            }

            if (isArrayType(tsCtx, type)) {
                return {
                    kind: "array",
                    type: parseType(getTypeArguments(tsCtx, type)![0]),
                }
            } else if (isTupleType(tsCtx, type)) {
                return {
                    kind: "tuple",
                    types: parseTypes(getTypeArguments(tsCtx, type)!),
                    names: (
                        type.target as ts.TupleType
                    ).labeledElementDeclarations?.map((s) => s.name.getText()),
                }
            } else if (
                isInterfaceType(tsCtx, type) ||
                (isClassType(tsCtx, type) &&
                    symbol &&
                    symbol.flags & SymbolFlags.Class)
            ) {
                return {
                    kind: isClassType(tsCtx, type)
                        ? "class"
                        : isInterfaceType(tsCtx, type)
                        ? "interface"
                        : (assert(
                              false,
                              "Should be class or interface type"
                          ) as never),
                    properties: parseSymbols(type.getProperties(), {
                        insideClassOrInterface: true,
                    }),
                    baseType: wrapSafe(parseType)(type.getBaseTypes()?.[0]),
                    implementsTypes: wrapSafe(parseTypes)(
                        getImplementsTypes(tsCtx, type)
                    ),
                    constructSignatures: getConstructSignatures(
                        tsCtx,
                        type
                    ).map((s) =>
                        getSignatureInfo(s, {
                            kind: ts.SignatureKind.Construct,
                            includeReturnType: false,
                        })
                    ),
                    classSymbol: wrapSafe(getSymbolInfo)(classSymbol),
                }
            } else if (signatures.length > 0) {
                return {
                    kind: "function",
                    signatures: signatures.map((s) =>
                        getSignatureInfo(s.signature, {
                            includeReturnType: true,
                            kind: s.kind,
                            typeParameters: s.typeParameters,
                        })
                    ),
                }
            } else {
                return {
                    kind: "object",
                    properties: parseSymbols(type.getProperties()),
                    indexInfos: getIndexInfos(tsCtx, type).map((indexInfo) =>
                        getIndexInfo(indexInfo)
                    ),
                    objectClass: wrapSafe(parseSymbol)(classSymbol),
                }
            }
        } else if (flags & ts.TypeFlags.Union) {
            return {
                kind: "union",
                types: parseTypes((type as ts.UnionType).types),
            }
        } else if (flags & ts.TypeFlags.Intersection) {
            const allTypes = getIntersectionTypesFlat(tsCtx, type)
            const types = parseTypes(
                allTypes.filter((t) => !isPureObject(tsCtx, t))
            )
            const properties = parseSymbols(type.getProperties())

            if (types.length === 0) {
                return {
                    kind: "object",
                    properties,
                }
            } else {
                return {
                    kind: "intersection",
                    types,
                    properties,
                }
            }
        } else if (flags & ts.TypeFlags.Index) {
            return {
                kind: "index",
                keyOf: parseType((type as ts.IndexType).type),
            }
        } else if (flags & ts.TypeFlags.IndexedAccess) {
            return {
                kind: "indexed_access",
                indexType: parseType((type as ts.IndexedAccessType).indexType),
                objectType: parseType(
                    (type as ts.IndexedAccessType).objectType
                ),
            }
        } else if (flags & ts.TypeFlags.Conditional) {
            // force resolution of true/false types
            typeChecker.typeToString(
                type,
                undefined,
                ts.TypeFormatFlags.InTypeAlias
            )

            return {
                kind: "conditional",
                checkType: parseType((type as ts.ConditionalType).checkType),
                extendsType: parseType(
                    (type as ts.ConditionalType).extendsType
                ),
                trueType: wrapSafe(parseType)(
                    (type as ts.ConditionalType).resolvedTrueType
                ),
                falseType: wrapSafe(parseType)(
                    (type as ts.ConditionalType).resolvedFalseType
                ),
            }
        } else if (flags & ts.TypeFlags.Substitution) {
            return {
                kind: "substitution",
                baseType: parseType((type as ts.SubstitutionType).baseType),
                substitute: parseType((type as ts.SubstitutionType).substitute),
            }
        } else if (flags & ts.TypeFlags.NonPrimitive) {
            return {
                kind: "non_primitive",
            }
        } else if (flags & ts.TypeFlags.TemplateLiteral) {
            return {
                kind: "template_literal",
                texts: (type as ts.TemplateLiteralType).texts,
                types: parseTypes((type as ts.TemplateLiteralType).types),
            }
        } else if (flags & ts.TypeFlags.StringMapping) {
            return {
                kind: "string_mapping",
                typeSymbol: getSymbolInfo(
                    (type as ts.StringMappingType).symbol
                ),
                type: parseType((type as ts.StringMappingType).type),
            }
        }

        return {
            kind: "primitive",
            primitive: "unknown",
        }
    }

    function parseTypes(types: readonly ts.Type[]): TypeInfo[] {
        return ctx.depth + 1 > maxDepth
            ? [maxDepthExceeded]
            : types.map((t) => parseType(t))
    }
    function parseType(type: ts.Type, options?: TypeTreeOptions): TypeInfo {
        return _generateTypeTree({ type }, ctx, options)
    }

    function parseSymbols(
        symbols: readonly ts.Symbol[],
        options?: TypeTreeOptions
    ): TypeInfo[] {
        return ctx.depth + 1 > maxDepth
            ? [maxDepthExceeded]
            : symbols.map((t) => parseSymbol(t, options))
    }
    function parseSymbol(
        symbol: ts.Symbol,
        options?: TypeTreeOptions
    ): TypeInfo {
        return _generateTypeTree({ symbol }, ctx, options)
    }

    function getSignatureInfo(
        signature: ts.Signature,
        {
            typeParameters,
            includeReturnType = true,
        }: {
            kind: ts.SignatureKind
            typeParameters?: readonly ts.Type[]
            includeReturnType?: boolean
        }
    ): SignatureInfo {
        typeParameters = signature.typeParameters ?? typeParameters

        return {
            symbolMeta: wrapSafe(getSymbolInfo)(
                getNodeSymbol(tsCtx, signature.getDeclaration())
            ),
            parameters: signature
                .getParameters()
                .map((parameter) =>
                    getFunctionParameterInfo(parameter, signature)
                ),
            ...(includeReturnType && {
                returnType: parseType(
                    typeChecker.getReturnTypeOfSignature(signature)
                ),
            }),
            ...(typeParameters && {
                typeParameters: parseTypes(typeParameters),
            }),
        }
    }

    function getFunctionParameterInfo(
        parameter: ts.Symbol,
        signature: ts.Signature
    ): TypeInfo {
        const { optional, isRest } = getParameterInfo(
            tsCtx,
            parameter,
            signature
        )

        return parseSymbol(parameter, {
            optional,
            isRest,
        })
    }

    function getIndexInfo(indexInfo: TSIndexInfoMerged): IndexInfo {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parameterSymbol: ts.Symbol =
            // @ts-expect-error This info exists on the object but is not publicly exposed by type info
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            indexInfo?.declaration?.parameters?.[0]?.symbol ??
            indexInfo?.parameterType?.getSymbol()

        const parameterType =
            indexInfo?.parameterType ??
            (parameterSymbol && getSymbolType(tsCtx, parameterSymbol))

        return {
            ...(indexInfo.keyType && { keyType: parseType(indexInfo.keyType) }),
            ...(indexInfo.type && { type: parseType(indexInfo.type) }),
            // parameterSymbol: wrapSafe(getSymbolInfo)(wrapSafe(typeChecker.getSymbolAtLocation)(indexInfo?.declaration?.parameters?.[0]))
            parameterSymbol: wrapSafe(getSymbolInfo)(parameterSymbol),
            ...(parameterType && { parameterType: parseType(parameterType) }),
        }
    }

    function getSymbolLocations(symbol?: ts.Symbol) {
        return wrapSafe(filterUndefined)(
            symbol?.getDeclarations()?.map(getDeclarationLocation)
        )
    }

    function getDeclarationLocation(declaration: ts.Declaration) {
        return getDeclarationInfo(declaration)?.location
    }

    function getSymbolInfo(
        symbol: ts.Symbol,
        isAnonymous = false,
        options: TypeTreeOptions = {}
    ): SymbolInfo {
        const parameterInfo = getParameterInfo(tsCtx, symbol)

        const optional = options.optional ?? parameterInfo.optional
        const rest = options.isRest ?? parameterInfo.isRest

        const parent = (symbol as TSSymbol).parent
        const insideClassOrInterface =
            options.insideClassOrInterface ??
            (parent &&
                parent.flags & (SymbolFlags.Class | SymbolFlags.Interface))

        const declarations = wrapSafe(filterUndefined)(
            symbol.getDeclarations()?.map(getDeclarationInfo)
        )

        return {
            name: symbol.getName(),
            flags: symbol.getFlags(),
            ...(isAnonymous && { anonymous: true }),
            ...(optional && { optional: true }),
            ...(rest && { rest: true }),
            ...(insideClassOrInterface && { insideClassOrInterface: true }),
            ...(declarations && { declarations }),
        }
    }

    function getDeclarationInfo(
        declaration: ts.Declaration
    ): DeclarationInfo | undefined {
        const sourceFile = declaration.getSourceFile()
        const location = getSourceFileLocation(sourceFile, declaration)

        if (!location) {
            return undefined
        }

        return {
            location,
        }
    }
}

function resolveSignature(
    ctx: TypescriptContext,
    type: ts.Type,
    node?: ts.Node
) {
    const { ts } = ctx

    const isConstructCallExpression =
        node?.parent.kind === ts.SyntaxKind.NewExpression

    const signature = getResolvedSignature(ctx, node)

    // const callExpression = wrapSafe(getCallLikeExpression)(node)
    const signatureTypeArguments = signature
        ? getSignatureTypeArguments(ctx, signature)
        : undefined
    const signatureTypeParameters = signature?.target?.typeParameters

    const callSignatures = type.getCallSignatures()
    const constructSignatures = type.getConstructSignatures()

    const signatures: {
        signature: ts.Signature
        typeParameters?: readonly ts.Type[]
        kind: ts.SignatureKind
    }[] = signature
        ? [
              {
                  signature,
                  typeParameters: signatureTypeParameters,
                  kind: isConstructCallExpression
                      ? ts.SignatureKind.Construct
                      : ts.SignatureKind.Call,
              },
          ]
        : [
              ...callSignatures.map((signature) => ({
                  signature,
                  kind: ts.SignatureKind.Call,
              })),
              ...constructSignatures.map((signature) => ({
                  signature,
                  kind: ts.SignatureKind.Construct,
              })),
          ]

    return {
        isConstructCallExpression,
        signature,
        signatureTypeArguments,
        signatureTypeParameters,
        callSignatures,
        constructSignatures,
        signatures,
    }
}

export function getTypeInfoChildren(info: TypeInfo): TypeInfo[] {
    const mapSignatureInfo = (signature: SignatureInfo) => [
        ...signature.parameters,
        signature.returnType,
        ...(signature.typeParameters ?? []),
    ]

    return [
        ...(info.typeParameters ?? []),
        ...(info.typeArguments ?? []),
        ...filterUndefined(_getTypeInfoChildren(info)),
    ]

    function _getTypeInfoChildren(info: TypeInfo): (TypeInfo | undefined)[] {
        switch (info.kind) {
            case "object": {
                return [
                    ...info.properties,
                    ...(info.indexInfos?.flatMap((x) => [
                        x.type,
                        x.keyType,
                        x.parameterType,
                    ]) ?? []),
                    // ...wrapSafe(getTypeInfoChildren)(info.objectClass) ?? [],
                    info.objectClass,
                ]
            }

            case "intersection": {
                return [...info.types, ...info.properties]
            }

            case "union": {
                return info.types
            }

            case "index": {
                return [info.keyOf]
            }

            case "indexed_access": {
                return [info.indexType, info.objectType]
            }

            case "conditional": {
                return [
                    info.checkType,
                    info.extendsType,
                    info.falseType,
                    info.trueType,
                ]
            }

            case "substitution": {
                return [info.baseType, info.substitute]
            }

            case "template_literal": {
                return info.types
            }

            case "array": {
                return [info.type]
            }

            case "tuple": {
                return info.types
            }

            case "function": {
                return info.signatures.flatMap(mapSignatureInfo)
            }

            case "enum": {
                return [...(info.properties ?? [])]
            }

            case "type_parameter": {
                return [info.defaultType, info.baseConstraint]
            }

            case "interface":
            case "class": {
                return [
                    ...info.properties,
                    ...(info.constructSignatures?.flatMap(mapSignatureInfo) ??
                        []),
                    info.baseType,
                    ...(info.implementsTypes ?? []),
                ]
            }

            case "string_mapping": {
                return [info.type]
            }
        }

        return []
    }
}

export function getTypeInfoSymbols(info: TypeInfo): SymbolInfo[] {
    return removeDuplicates(
        filterUndefined([
            info.symbolMeta,
            info.aliasSymbolMeta,
            ..._getTypeInfoSymbols(info),
        ])
    )

    function _getTypeInfoSymbols(info: TypeInfo): (SymbolInfo | undefined)[] {
        switch (info.kind) {
            case "object": {
                return [
                    ...(info.indexInfos?.map(
                        ({ parameterSymbol }) => parameterSymbol
                    ) ?? []),
                ]
            }

            case "class": {
                return [
                    ...(info.constructSignatures?.flatMap(mapSignature) ?? []),
                    info.classSymbol,
                ]
            }

            case "enum_literal": {
                return [info.literalSymbol, info.parentSymbol]
            }

            case "function": {
                return [
                    ...(info.signatures.flatMap(mapSignature) ?? []),
                    info.symbolMeta,
                ]
            }

            case "string_mapping": {
                return [info.typeSymbol]
            }

            case "type_parameter": {
                return [info.typeSymbolMeta]
            }

            default: {
                return []
            }
        }

        function mapSignature(signature: SignatureInfo) {
            return [signature.symbolMeta]
        }
    }
}
