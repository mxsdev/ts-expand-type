/* eslint-disable prefer-const */
import * as assert from "assert"
import type * as ts from "typescript"
import { configDefaults } from "./config"
import {
    wrapSafe,
    filterUndefined,
    isNonEmpty,
    arrayContentsEqual,
    removeDuplicates,
    cartesianEqual,
} from "./objectUtil"
import { Queue } from "./queue"
import {
    DeclarationInfo,
    IndexInfo,
    SignatureInfo,
    SourceFileLocation,
    SymbolInfo,
    SymbolOrType,
    TypeInfo,
    TypeInfoNoId,
    TypescriptContext,
    TypeTreeContext,
    TypeTreeOptions,
    DiscriminatedIndexInfo,
    APIConfig,
} from "./types"
import {
    IntrinsicTypeInternal,
    SymbolFlags,
    SymbolInternal,
} from "./typescript"
import {
    getIndexInfos,
    getIntersectionTypesFlat,
    getSymbolType,
    getTypeId,
    isArrayType,
    getTypeArguments,
    isTupleType,
    getParameterInfo,
    isClassType,
    isInterfaceType,
    getImplementsTypes,
    getConstructSignatures,
    getEmptyTypeId,
    getTypeParameters,
    getResolvedSignature,
    getSignatureTypeArguments,
    getSourceFileLocation,
    getNodeSymbol,
    narrowDeclarationForLocation,
    isPureObjectOrMappedTypeShallow,
    getDescendantAtRange,
    getSymbolOrTypeOfNode,
    isReadonlySymbol,
    isReadonlyArrayType,
    isReadonlyTupleType,
    getSymbolExports,
    isNamespace,
    getSignaturesOfType,
    isClassOrInterfaceType,
    getAliasedSymbol,
    getDescendantAtPosition,
} from "./util"

const maxDepthExceeded: TypeInfo = { kind: "max_depth", id: getEmptyTypeId() }

export function generateTypeTree(
    symbolOrType: SymbolOrType,
    typescriptContext: TypescriptContext,
    _config?: Partial<APIConfig>
) {
    const config = configDefaults(_config)

    return _generateTypeTree(symbolOrType, {
        typescriptContext,
        config,
        seen: new Set(),
    })
}

type GenerateTypeTreeArgs = {
    symbolOrType: SymbolOrType
    options?: TypeTreeOptions
    typeInfo: TypeInfo
}

function _generateTypeTree(
    symbolOrType: SymbolOrType,
    ctx: TypeTreeContext,
    optionsInitial?: TypeTreeOptions
): TypeInfo {
    const queue = new Queue<GenerateTypeTreeArgs>()
    const typeInfoFactory = new TypeInfoFactory()

    const createTypeInfo = (args: Omit<GenerateTypeTreeArgs, "typeInfo">) => {
        const typeInfo = typeInfoFactory.createTypeInfo()
        queue.enqueue({ ...args, typeInfo })
        return typeInfo
    }

    const res = createTypeInfo({ symbolOrType, options: optionsInitial })

    let depth = 0

    while (!queue.isEmpty()) {
        depth++
        const size = queue.length

        for (let i = 0; i < size; i++) {
            const { symbolOrType, options, typeInfo } = queue.dequeue()!

            typeInfoFactory.assignTypeInfo(
                typeInfo,
                _typeTree(symbolOrType, depth, options)
            )
        }
    }

    typeInfoFactory.assertNoUnassigned()
    return res

    function _typeTree(
        { symbol, type, node }: SymbolOrType,
        depth: number,
        options?: TypeTreeOptions
    ) {
        assert(symbol || type, "Must provide either symbol or type")

        const originalSymbol = symbol

        const { typescriptContext: tsCtx } = ctx
        const maxDepth = ctx.config.maxDepth

        const { typeChecker, ts } = tsCtx

        if (depth > maxDepth) {
            return maxDepthExceeded
        }

        if (!type) {
            type = getSymbolType(tsCtx, symbol!)
        }

        const typeSymbol = type.symbol as ts.Symbol | undefined

        let isAnonymousSymbol = !symbol

        if (!symbol) {
            const associatedSymbol = type.getSymbol()

            if (
                associatedSymbol &&
                !isArrayType(tsCtx, type) &&
                !isTupleType(tsCtx, type) &&
                !isInterfaceType(tsCtx, type)
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
            // TODO: should probably support alias symbols as well
            const locations: SourceFileLocation[] = filterUndefined([
                ...(getRecoverableSymbolLocations(originalSymbol) ?? []),
            ])

            if (
                ctx.config.referenceDefinedTypes &&
                depth > 1 &&
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
                        (originalSymbol as SymbolInternal).target ??
                            originalSymbol,
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

        return typeInfoId

        function createNode(type: ts.Type): TypeInfoNoId {
            for (const s of [symbol, typeSymbol]) {
                if (s && s.flags & ts.SymbolFlags.Module) {
                    return {
                        kind: isNamespace(tsCtx, s) ? "namespace" : "module",
                        exports: parseSymbols(getSymbolExports(s)),
                    }
                }
            }

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
                if (
                    (type as IntrinsicTypeInternal).intrinsicName ===
                    "intrinsic"
                ) {
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
            } else if (
                flags & ts.TypeFlags.EnumLiteral ||
                (flags & ts.TypeFlags.EnumLike &&
                    symbol &&
                    symbol.flags & ts.SymbolFlags.EnumMember)
            ) {
                const enumSymbol =
                    symbol && symbol.flags & ts.SymbolFlags.EnumMember
                        ? symbol
                        : type.symbol

                return {
                    kind: "enum_literal",
                    value: (type as ts.StringLiteralType).value,
                    literalSymbol: getSymbolInfo(enumSymbol),
                    parentSymbol: wrapSafe(getSymbolInfo)(
                        (enumSymbol as SymbolInternal).parent
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
                    value:
                        (type as IntrinsicTypeInternal).intrinsicName ===
                        "true",
                }
            } else if (flags & ts.TypeFlags.BigIntLiteral) {
                return {
                    kind: "bigint_literal",
                    value: (type as ts.BigIntLiteralType).value,
                }
            } else if (
                signatures.length > 0 &&
                !isClassOrInterfaceType(tsCtx, type)
            ) {
                const isJSXElement = !!(
                    node &&
                    cartesianEqual(
                        [node.kind, node.parent?.kind],
                        [
                            ts.SyntaxKind.JsxElement,
                            ts.SyntaxKind.JsxOpeningElement,
                            ts.SyntaxKind.JsxClosingElement,
                            ts.SyntaxKind.JsxSelfClosingElement,
                        ]
                    )
                )

                return {
                    kind: "function",
                    signatures: signatures.map((s) =>
                        getSignatureInfo(s.signature, {
                            includeReturnType: true,
                            kind: s.kind,
                            typeParameters: s.typeParameters,
                        })
                    ),
                    ...(isJSXElement && { isJSXElement }),
                }
            } else if (flags & ts.TypeFlags.Object) {
                if (typeSymbol && typeSymbol.flags & SymbolFlags.Enum) {
                    return {
                        kind: "enum",
                        properties: parseSymbols(type.getProperties()),
                    }
                }

                const indexInfos = getIndexInfos(tsCtx, type) //.map((indexInfo) => getIndexInfo(indexInfo))

                if (isArrayType(tsCtx, type)) {
                    const isReadonly = isReadonlyArrayType(tsCtx, type)

                    return {
                        kind: "array",
                        type: parseType(getTypeArguments(tsCtx, type)![0]),
                        ...(isReadonly && { readonly: true }),
                    }
                } else if (isTupleType(tsCtx, type)) {
                    const isReadonly = isReadonlyTupleType(tsCtx, type)

                    return {
                        kind: "tuple",
                        types: parseTypes(getTypeArguments(tsCtx, type)!),
                        names: (
                            type.target as ts.TupleType
                        ).labeledElementDeclarations?.map(
                            (s) => s?.name.getText() || ""
                        ),
                        ...(isReadonly && { readonly: true }),
                    }
                } else if (
                    isInterfaceType(tsCtx, type) ||
                    (isClassType(tsCtx, type) &&
                        symbol &&
                        symbol.flags & SymbolFlags.Class)
                ) {
                    const interfaceKind = isClassType(tsCtx, type)
                        ? "class"
                        : isInterfaceType(tsCtx, type)
                        ? "interface"
                        : (assert(
                              false,
                              "Should be class or interface type"
                          ) as never)

                    return {
                        kind: interfaceKind,
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
                        ...(interfaceKind === "interface" &&
                            isNonEmpty(indexInfos) && {
                                indexInfos: indexInfos.map(getIndexInfo),
                            }),
                    }
                } else {
                    return {
                        kind: "object",
                        properties: parseSymbols(type.getProperties()),
                        indexInfos: indexInfos.map(getIndexInfo),
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
                    allTypes.filter(
                        (t) => !isPureObjectOrMappedTypeShallow(tsCtx, t)
                    )
                )

                const properties = parseSymbols(type.getProperties())
                const indexInfos = getIndexInfos(tsCtx, type).map(getIndexInfo)

                if (types.length === 0) {
                    return {
                        kind: "object",
                        properties,
                        ...(isNonEmpty(indexInfos) && { indexInfos }),
                    }
                } else {
                    return {
                        kind: "intersection",
                        types,
                        ...(isNonEmpty(indexInfos) && { indexInfos }),
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
                    indexType: parseType(
                        (type as ts.IndexedAccessType).indexType
                    ),
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
                    checkType: parseType(
                        (type as ts.ConditionalType).checkType
                    ),
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
                    constraint: parseType(
                        (type as ts.SubstitutionType).constraint
                    ),
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
            return depth + 1 > maxDepth
                ? [maxDepthExceeded]
                : types.map((t) => parseType(t))
        }
        function parseType(type: ts.Type, options?: TypeTreeOptions): TypeInfo {
            return createTypeInfo({ symbolOrType: { type }, options })
        }

        function parseSymbols(
            symbols: readonly ts.Symbol[],
            options?: TypeTreeOptions
        ): TypeInfo[] {
            return depth + 1 > maxDepth
                ? [maxDepthExceeded]
                : symbols.map((t) => parseSymbol(t, options))
        }
        function parseSymbol(
            symbol: ts.Symbol,
            options?: TypeTreeOptions
        ): TypeInfo {
            return createTypeInfo({ symbolOrType: { symbol }, options })
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

        function getIndexInfo({
            info: indexInfo,
            type,
        }: DiscriminatedIndexInfo): IndexInfo {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const parameterSymbol: ts.Symbol =
                // @ts-expect-error This info exists on the object but is not publicly exposed by type info
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                indexInfo?.declaration?.parameters?.[0]?.symbol ??
                indexInfo?.parameterType?.getSymbol()

            const parameterType =
                type === "parameter" &&
                (indexInfo?.parameterType ??
                    (parameterSymbol && getSymbolType(tsCtx, parameterSymbol)))

            return {
                ...(indexInfo.keyType && {
                    keyType: parseType(indexInfo.keyType),
                }),
                ...(indexInfo.type && { type: parseType(indexInfo.type) }),
                parameterSymbol: wrapSafe(getSymbolInfo)(parameterSymbol),
                ...(parameterType && {
                    parameterType: parseType(parameterType),
                }),
            }
        }

        function getSymbolLocations(symbol?: ts.Symbol) {
            return wrapSafe(filterUndefined)(
                symbol?.getDeclarations()?.map(getDeclarationLocation)
            )
        }

        function getRecoverableSymbolLocations(symbol?: ts.Symbol) {
            return getSymbolLocations(symbol)?.filter((location) => {
                const sourceFile = tsCtx.program.getSourceFile(
                    location.fileName
                )

                if (!sourceFile) return false

                return (
                    getNodeSymbol(
                        tsCtx,
                        getDescendantAtPosition(
                            tsCtx,
                            sourceFile,
                            sourceFile.getPositionOfLineAndCharacter(
                                location.range.start.line,
                                location.range.start.character
                            )
                        )
                    ) === originalSymbol
                )
            })
        }

        function getDeclarationLocation(declaration: ts.Declaration) {
            return getDeclarationInfo(declaration)?.location
        }

        function getSymbolInfo(
            symbol: ts.Symbol,
            isAnonymous = false,
            options: TypeTreeOptions = {}
        ): SymbolInfo {
            const aliasedSymbol = getAliasedSymbol(tsCtx, symbol)

            const parameterInfo = getParameterInfo(tsCtx, symbol)

            const optional = options.optional ?? parameterInfo.optional
            const rest = options.isRest ?? parameterInfo.isRest

            const parent = (symbol as SymbolInternal).parent
            const insideClassOrInterface =
                options.insideClassOrInterface ??
                (parent &&
                    parent.flags & (SymbolFlags.Class | SymbolFlags.Interface))

            const declarations = wrapSafe(filterUndefined)(
                symbol.getDeclarations()?.map(getDeclarationInfo)
            )

            const resolvedDeclarations =
                aliasedSymbol &&
                aliasedSymbol !== symbol &&
                isNonEmpty(aliasedSymbol.declarations)
                    ? wrapSafe(filterUndefined)(
                          aliasedSymbol
                              .getDeclarations()
                              ?.map(getDeclarationInfo)
                      )
                    : undefined

            const isReadonly = isReadonlySymbol(tsCtx, symbol)

            return {
                name: typeChecker.symbolToString(symbol),
                flags: symbol.getFlags(),
                ...(isReadonly && { readonly: true }),
                ...(isAnonymous && { anonymous: true }),
                ...(optional && { optional: true }),
                ...(rest && { rest: true }),
                ...(insideClassOrInterface && { insideClassOrInterface: true }),
                ...(declarations && { declarations }),
                ...(resolvedDeclarations && { resolvedDeclarations }),
            }
        }

        function getDeclarationInfo(
            declaration: ts.Declaration
        ): DeclarationInfo | undefined {
            declaration = narrowDeclarationForLocation(declaration)

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
}

function resolveSignature(
    ctx: TypescriptContext,
    type: ts.Type,
    node?: ts.Node
) {
    const { ts } = ctx

    const isConstructCallExpression =
        node?.parent.kind === ts.SyntaxKind.NewExpression

    const signature =
        getSignaturesOfType(ctx, type).length > 0
            ? getResolvedSignature(ctx, node)
            : undefined

    const signatureTypeArguments = signature
        ? getSignatureTypeArguments(ctx, signature, node)
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

    const mapIndexInfo = (x: IndexInfo): (TypeInfo | undefined)[] => [
        x.type,
        x.keyType,
        x.parameterType,
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
                    ...(info.indexInfos?.flatMap(mapIndexInfo) ?? []),
                    info.objectClass,
                ]
            }

            case "intersection": {
                return [
                    ...info.types,
                    ...info.properties,
                    ...(info.indexInfos?.flatMap(mapIndexInfo) ?? []),
                ]
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
                return [info.baseType, info.constraint]
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
                    ...(info.indexInfos?.flatMap(mapIndexInfo) ?? []),
                ]
            }

            case "string_mapping": {
                return [info.type]
            }

            case "module":
            case "namespace": {
                return [...info.exports]
            }
        }

        return []
    }
}

export function getTypeInfoSymbols(info: TypeInfo): SymbolInfo[] {
    const mapIndexInfo = ({
        parameterSymbol,
    }: IndexInfo): SymbolInfo | undefined => parameterSymbol

    return removeDuplicates(
        filterUndefined([
            info.symbolMeta,
            info.aliasSymbolMeta,
            ..._getTypeInfoSymbols(info),
        ])
    )

    function _getTypeInfoSymbols(info: TypeInfo): (SymbolInfo | undefined)[] {
        switch (info.kind) {
            case "intersection":
            case "object": {
                return [...(info.indexInfos?.map(mapIndexInfo) ?? [])]
            }

            case "interface":
            case "class": {
                return [
                    ...(info.constructSignatures?.flatMap(mapSignature) ?? []),
                    info.classSymbol,
                    ...(info.indexInfos?.map(mapIndexInfo) ?? []),
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

export function getTypeInfoAtRange(
    ctx: TypescriptContext,
    location: SourceFileLocation,
    apiConfig?: Partial<APIConfig>
) {
    const sourceFile = ctx.program.getSourceFile(location.fileName)
    if (!sourceFile) return undefined

    const startPos = sourceFile.getPositionOfLineAndCharacter(
        location.range.start.line,
        location.range.start.character
    )

    // TODO: integrate this
    //       getDescendantAtRange will probably need to be improved...
    // const endPos = sourceFile.getPositionOfLineAndCharacter(
    //     location.range.end.line,
    //     location.range.end.character
    // )

    const node = getDescendantAtRange(ctx, sourceFile, [startPos, startPos])

    if (node === sourceFile) {
        return undefined
    }

    return getTypeInfoOfNode(ctx, node, apiConfig)
}

export function getTypeInfoOfNode(
    ctx: TypescriptContext,
    node: ts.Node,
    apiConfig?: Partial<APIConfig>
) {
    if (!node.parent) {
        return undefined
    }

    const symbolOrType = getSymbolOrTypeOfNode(ctx, node)
    if (!symbolOrType) return undefined

    return generateTypeTree(symbolOrType, ctx, apiConfig)
}

/**
 * @internal
 */
class TypeInfoFactory {
    private unassigned = 0

    createTypeInfo(): TypeInfo {
        this.unassigned++
        return {} as TypeInfo
    }

    assignTypeInfo(target: TypeInfo, source: TypeInfo) {
        Object.assign(target, source)
        this.unassigned--
    }

    assertNoUnassigned() {
        assert.strictEqual(this.unassigned, 0, "Some type info is unassigned")
    }
}
