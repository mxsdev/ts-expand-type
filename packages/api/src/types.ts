import type * as ts from "typescript"

export interface APIConfig {
    maxDepth: number
    referenceDefinedTypes: boolean
}

type FileLocationRequest = {
    range: TextRange
}

export type CustomTypeScriptRequest = {
    id: "type-tree"
    maxDepth?: number
} & FileLocationRequest

export type CustomTypeScriptRequestId = CustomTypeScriptRequest["id"]

export type CustomTypeScriptRequestOfId<Id extends CustomTypeScriptRequestId> =
    Extract<CustomTypeScriptRequest, { id: Id }>

type CustomTypescriptResponseBodyData = {
    id: "type-tree"
    typeInfo: TypeInfo | undefined
}

export type CustomTypeScriptResponse<
    Id extends CustomTypeScriptRequestId = CustomTypeScriptRequestId
> = {
    body: {
        __tsExplorerResponse?:
            | CustomTypeScriptResponseBody<Id>
            | {
                  id: "error"
                  error: { name?: string; stack?: string; message?: string }
              }
    }
}

export type CustomTypeScriptResponseBody<
    Id extends CustomTypeScriptRequestId = CustomTypeScriptRequestId
> = Extract<CustomTypescriptResponseBodyData, { id: Id }>

export type TypescriptContext = {
    program: ts.Program
    typeChecker: ts.TypeChecker
    ts: typeof import("typescript/lib/tsserverlibrary")
}

export type SourceFileTypescriptContext = TypescriptContext & {
    sourceFile: ts.SourceFile
}

export type TextRange = {
    start: ts.LineAndCharacter
    end: ts.LineAndCharacter
}

export type SourceFileLocation = {
    range: TextRange
    fileName: string
}

export type DeclarationInfo = {
    location: SourceFileLocation
}

export type SymbolInfo = {
    name: string
    flags: number
    optional?: boolean
    anonymous?: boolean
    rest?: boolean
    readonly?: boolean
    insideClassOrInterface?: boolean
    declarations?: DeclarationInfo[]
    resolvedDeclarations?: DeclarationInfo[]
}

export type IndexInfo = {
    keyType?: TypeInfo
    type?: TypeInfo
    parameterSymbol?: SymbolInfo
    parameterType?: TypeInfo
}

export type SignatureInfo = {
    symbolMeta?: SymbolInfo
    parameters: TypeInfo[]
    returnType?: TypeInfo
    typeParameters?: TypeInfo[]
}

export type TypeParameterInfo = {
    name: string
}

export type TypeInfo = TypeInfoNoId & { id: TypeId }

export type TypeInfoNoId = {
    symbolMeta?: SymbolInfo
    aliasSymbolMeta?: SymbolInfo
    typeArguments?: TypeInfo[]
    typeParameters?: TypeInfo[]
} & (
    | {
          kind: "primitive"
          primitive:
              | "any"
              | "unknown"
              | "string"
              | "number"
              | "boolean"
              | "bigint"
              | "essymbol"
              | "unique_symbol"
              | "null"
              | "never"
              | "undefined"
              | "void"
      }
    | { kind: "enum"; properties?: TypeInfo[] }
    | { kind: "reference"; location?: SourceFileLocation }
    | { kind: "string_literal"; value: string }
    | { kind: "number_literal"; value: number }
    | { kind: "boolean_literal"; value: boolean }
    | {
          kind: "enum_literal"
          literalSymbol: SymbolInfo
          parentSymbol?: SymbolInfo
          value: string
      }
    | { kind: "bigint_literal"; value: ts.PseudoBigInt }
    | {
          kind: "type_parameter"
          baseConstraint?: TypeInfo
          defaultType?: TypeInfo
          typeSymbolMeta?: SymbolInfo
      }
    | {
          kind: "object"
          properties: TypeInfo[]
          indexInfos?: IndexInfo[]
          objectClass?: TypeInfo
      }
    | {
          kind: "interface" | "class"
          properties: TypeInfo[]
          baseType?: TypeInfo
          implementsTypes?: TypeInfo[]
          constructSignatures?: SignatureInfo[]
          classSymbol?: SymbolInfo
          indexInfos?: IndexInfo[]
      }
    | { kind: "function"; signatures: SignatureInfo[]; isJSXElement?: boolean }
    | { kind: "array"; type: TypeInfo; readonly?: boolean }
    | { kind: "tuple"; types: TypeInfo[]; names?: string[]; readonly?: boolean }
    | {
          kind: "union"
          types: TypeInfo[]
      }
    | {
          kind: "intersection"
          properties: TypeInfo[]
          types: TypeInfo[]
          indexInfos?: IndexInfo[]
      }
    | {
          kind: "index"
          keyOf: TypeInfo
      }
    | {
          kind: "indexed_access"
          indexType: TypeInfo
          objectType: TypeInfo
      }
    | {
          kind: "conditional"
          checkType: TypeInfo
          extendsType: TypeInfo
          trueType?: TypeInfo
          falseType?: TypeInfo
      }
    | {
          kind: "substitution"
          baseType: TypeInfo
          constraint: TypeInfo
      }
    | { kind: "non_primitive" }
    | { kind: "intrinsic" }
    | {
          kind: "template_literal"
          texts: readonly string[]
          types: TypeInfo[]
      }
    | {
          kind: "string_mapping"
          typeSymbol: SymbolInfo
          type: TypeInfo
      }
    | {
          kind: "max_depth"
      }
    | {
          kind: "namespace"
          exports: TypeInfo[]
      }
    | {
          kind: "module"
          exports: TypeInfo[]
      }
)

export type TypeId = string

export type TypeInfoKind<K extends TypeInfo["kind"]> = Extract<
    TypeInfo,
    { kind: K }
>

export type TypePurpose =
    | "return"
    | "index_type"
    | "index_value_type"
    | "index_parameter_type"
    | "conditional_check"
    | "conditional_extends"
    | "conditional_true"
    | "conditional_false"
    | "keyof"
    | "indexed_access_index"
    | "indexed_access_base"
    | "parameter_default"
    | "parameter_base_constraint"
    | "class_constructor"
    | "class_base_type"
    | "class_implementations"
    | "object_class"
    | "type_parameter_list"
    | "type_argument_list"
    | "parameter_value"
    | "jsx_properties"

export type PrimitiveKind = TypeInfoKind<"primitive">["primitive"]
export type LocalizableKind = Exclude<TypeInfo["kind"], "reference">

export type ResolvedTypeInfo = Exclude<TypeInfo, { kind: "reference" }>

export type LocalizedTypeInfoError = {
    error: Error
    typeInfo?: TypeInfo
}

export type LocalizedTypeInfoOrError = LocalizedTypeInfo & {
    error?: LocalizedTypeInfoError
}

export type TypeInfoChild = {
    info?: TypeInfo
    localizedInfo?: LocalizedTypeInfo
    opts?: LocalizeOpts
}

export type TypeInfoChildren = TypeInfoChild[]

/**
 * @internal
 */
export type ResolvedArrayTypeInfo = {
    info: Exclude<ResolvedTypeInfo, { kind: "array" }>
    dimension: number
}

/**
 * Collapsed version of TypeInfo which is much more useful for displaying to a
 * user
 */
export type LocalizedTypeInfo = {
    /**
     * Localized text version of kind
     */
    kindText?: string
    /**
     * The type's kind, such as object, enum, etc.
     */
    kind?: ResolvedTypeInfo["kind"] | "signature" | "index_info"
    /**
     * In case kind is "primitive", this specifies the kind of primitive
     */
    primitiveKind?: PrimitiveKind
    /**
     * Name of the type alias, if any
     */
    alias?: string
    /**
     * Symbol info associated with this type, if any
     */
    symbol?: LocalizedSymbolInfo
    typeArguments?: TypeInfoChildren
    /**
     * Resolved type name
     */
    name?: string
    /**
     * Some localized type nodes have some special function, which is indicated
     * by its "purpose"
     *
     * For example, a localized type node can exist for the purpose of listing
     * relevant type parameters, in which case it has a purpose of
     * "type_parameter_list"
     *
     * In the VSCode Extension, purpose is usually denoted with angle brackets.
     * The above example, for instance, corresponds to the tree node "<type
     * parameters>"
     */
    purpose?: TypePurpose
    /**
     * Whether this type is something like, for example, an optional parameter
     */
    optional?: boolean
    /**
     * Whether this type is a readonly property/array/tuple
     */
    readonly?: boolean
    /**
     * If this type represents an array, it will have a dimension > 0
     * corresponding to the array type's dimension
     */
    dimension?: number
    /**
     * Whether this type/symbol is something like, for example, a rest parameter
     * in a function
     */
    rest?: boolean
    /**
     * List of resolved locations of the type
     */
    locations?: SourceFileLocation[]
    children?: TypeInfoChildren
    /**
     * Debug id information, used by test runner
     * to identify and remove cycles
     */
    _id?: TypeId
}

export type LocalizedSymbolInfo = {
    name: string
    anonymous?: boolean
    insideClassOrInterface?: boolean
    property?: boolean
    locations?: SourceFileLocation[]
    isArgument?: boolean
}

/**
 * @internal
 */
export type TypeInfoMap = Map<TypeId, ResolvedTypeInfo>

export type LocalizeOpts = {
    optional?: boolean
    purpose?: TypePurpose
    name?: string
    typeArguments?: TypeInfo[]
    typeArgument?: TypeInfo
    includeIds?: boolean
    isInsideJSXElement?: boolean
}

/**
 * @internal
 */
export type LocalizeData = {
    localizedOrigin: WeakMap<LocalizedTypeInfo, TypeInfo>
}

/**
 * @internal
 */
export type TypeTreeContext = {
    typescriptContext: TypescriptContext
    config: APIConfig
    seen: Set<TypeId>
    // depth: number
}

export type SymbolOrType = (
    | { symbol: ts.Symbol; type?: undefined }
    | { type: ts.Type; symbol?: undefined }
) & { node?: ts.Node }

/**
 * @internal
 */
export type TypeTreeOptions = {
    optional?: boolean
    isRest?: boolean
    insideClassOrInterface?: boolean
}

/**
 * @internal
 */
export type RecursiveExpandContext = {
    seen: WeakMap<ts.Type, ts.Type>
    depth: number
    maxDepth: number
}

export type TypeInfoRetriever = (
    location: SourceFileLocation
) => Promise<TypeInfo | undefined>

/**
 * @internal
 */
export type IndexInfoMerged = {
    declaration?: ts.MappedTypeNode | ts.IndexSignatureDeclaration
    keyType?: ts.Type
    type?: ts.Type
    parameterType?: ts.Type
}

/**
 * @internal
 */
export type IndexInfoType = "simple" | "parameter"

/**
 * @internal
 */
export type DiscriminatedIndexInfo = {
    type: IndexInfoType
    info: IndexInfoMerged
}

/**
 * @internal
 */
export type ParameterInfo = {
    optional?: boolean
    isRest?: boolean
}
