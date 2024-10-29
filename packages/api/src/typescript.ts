import type * as ts from "typescript"
import { TypescriptContext } from "./types"

/**
 * @internal
 */
export type SymbolName = ts.__String

/**
 * @internal
 */
type TypeMapper = unknown

/**
 * @internal
 */
export type TypeConstructor = new (
    checker: ts.TypeChecker,
    flags: ts.TypeFlags
) => ts.Type

/**
 * @internal
 */
export type SymbolConstructor = new (
    flags: ts.SymbolFlags,
    name: SymbolName
) => ts.Symbol

/**
 * @internal
 */
export function getTypeConstructor({ ts }: TypescriptContext) {
    // @ts-expect-error - objectAllocator exists but is not exposed by types publicly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return ts.objectAllocator.getTypeConstructor() as TypeConstructor
}

/**
 * @internal
 */
export function getSymbolConstructor({ ts }: TypescriptContext) {
    // @ts-expect-error - objectAllocator exists but is not exposed by types publicly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return ts.objectAllocator.getSymbolConstructor() as SymbolConstructor
}

/**
 * @internal
 */
export type ObjectTypeInternal = ts.ObjectType & {
    id: number
    members: ts.SymbolTable
    properties: ts.Symbol[]
    indexInfos: ts.IndexInfo[]
    constructSignatures: ts.Signature[]
    callSignatures: ts.Signature[]
}

/**
 * @internal
 */
export type MappedTypeInternal = ts.Type & {
    declaration: ts.MappedTypeNode
    typeParameter?: ts.TypeParameter
    constraintType?: ts.Type
    templateType?: ts.Type
    modifiersType?: ts.Type
}

/**
 * @internal
 */
export type GenericTypeInternal = ts.GenericType & {
    readonly?: boolean
}

/**
 * @internal
 */
export type TransientSymbol = ts.Symbol & { checkFlags: number }

/**
 * @internal
 */
export type NodeWithTypeArguments = ts.Node & {
    typeArguments?: ts.NodeArray<ts.TypeNode>
}
/**
 * @internal
 */
export type NodeWithJsDoc = ts.Node & { jsDoc?: ts.Node[] | undefined }

/**
 * @internal
 */
export type DeclarationInternal = ts.Declaration & { name?: ts.Identifier }

/**
 * @internal
 */
export type UnionTypeInternal = ts.UnionType & { id: number }
/**
 * @internal
 */
export type IntersectionTypeInternal = ts.IntersectionType & { id: number }
/**
 * @internal
 */
export type TypeReferenceInternal = ts.TypeReference & {
    resolvedTypeArguments?: ts.Type[]
}
/**
 * @internal
 */
export type SignatureInternal = ts.Signature & {
    minArgumentCount: number
    resolvedMinArgumentCount?: number
    target?: SignatureInternal
    mapper: TypeMapper
}
/**
 * @internal
 */
export type IntrinsicTypeInternal = ts.Type & {
    intrinsicName: string
    objectFlags: ts.ObjectFlags
}

/**
 * @internal
 */
export type SymbolInternal = ts.Symbol & {
    checkFlags: number
    type?: ts.Type
    parent?: SymbolInternal
    target?: SymbolInternal
}

/**
 * @internal
 */
export const enum CheckFlags {
    Instantiated = 1 << 0, // Instantiated symbol
    SyntheticProperty = 1 << 1, // Property in union or intersection type
    SyntheticMethod = 1 << 2, // Method in union or intersection type
    Readonly = 1 << 3, // Readonly transient symbol
    ReadPartial = 1 << 4, // Synthetic property present in some but not all constituents
    WritePartial = 1 << 5, // Synthetic property present in some but only satisfied by an index signature in others
    HasNonUniformType = 1 << 6, // Synthetic property with non-uniform type in constituents
    HasLiteralType = 1 << 7, // Synthetic property with at least one literal type in constituents
    ContainsPublic = 1 << 8, // Synthetic property with public constituent(s)
    ContainsProtected = 1 << 9, // Synthetic property with protected constituent(s)
    ContainsPrivate = 1 << 10, // Synthetic property with private constituent(s)
    ContainsStatic = 1 << 11, // Synthetic property with static constituent(s)
    Late = 1 << 12, // Late-bound symbol for a computed property with a dynamic name
    ReverseMapped = 1 << 13, // Property of reverse-inferred homomorphic mapped type
    OptionalParameter = 1 << 14, // Optional parameter
    RestParameter = 1 << 15, // Rest parameter
    DeferredType = 1 << 16, // Calculation of the type of this symbol is deferred due to processing costs, should be fetched with `getTypeOfSymbolWithDeferredType`
    HasNeverType = 1 << 17, // Synthetic property with at least one never type in constituents
    Mapped = 1 << 18, // Property of mapped type
    StripOptional = 1 << 19, // Strip optionality in mapped property
    Unresolved = 1 << 20, // Unresolved type alias symbol
    Synthetic = SyntheticProperty | SyntheticMethod,
    Discriminant = HasNonUniformType | HasLiteralType,
    Partial = ReadPartial | WritePartial,
}

/**
 * @internal
 */
export const enum TypeFlags {
    Any = 1 << 0,
    Unknown = 1 << 1,
    String = 1 << 2,
    Number = 1 << 3,
    Boolean = 1 << 4,
    Enum = 1 << 5,
    BigInt = 1 << 6,
    StringLiteral = 1 << 7,
    NumberLiteral = 1 << 8,
    BooleanLiteral = 1 << 9,
    EnumLiteral = 1 << 10, // Always combined with StringLiteral, NumberLiteral, or Union
    BigIntLiteral = 1 << 11,
    ESSymbol = 1 << 12, // Type of symbol primitive introduced in ES6
    UniqueESSymbol = 1 << 13, // unique symbol
    Void = 1 << 14,
    Undefined = 1 << 15,
    Null = 1 << 16,
    Never = 1 << 17, // Never type
    TypeParameter = 1 << 18, // Type parameter
    Object = 1 << 19, // Object type
    Union = 1 << 20, // Union (T | U)
    Intersection = 1 << 21, // Intersection (T & U)
    Index = 1 << 22, // keyof T
    IndexedAccess = 1 << 23, // T[K]
    Conditional = 1 << 24, // T extends U ? X : Y
    Substitution = 1 << 25, // Type parameter substitution
    NonPrimitive = 1 << 26, // intrinsic object type
    TemplateLiteral = 1 << 27, // Template literal type
    StringMapping = 1 << 28, // Uppercase/Lowercase type

    /* @internal */
    AnyOrUnknown = Any | Unknown,
    /* @internal */
    Nullable = Undefined | Null,
    Literal = StringLiteral | NumberLiteral | BigIntLiteral | BooleanLiteral,
    Unit = Literal | UniqueESSymbol | Nullable,
    StringOrNumberLiteral = StringLiteral | NumberLiteral,
    /* @internal */
    StringOrNumberLiteralOrUnique = StringLiteral |
        NumberLiteral |
        UniqueESSymbol,
    /* @internal */
    DefinitelyFalsy = StringLiteral |
        NumberLiteral |
        BigIntLiteral |
        BooleanLiteral |
        Void |
        Undefined |
        Null,
    PossiblyFalsy = DefinitelyFalsy | String | Number | BigInt | Boolean,
    /* @internal */
    Intrinsic = Any |
        Unknown |
        String |
        Number |
        BigInt |
        Boolean |
        BooleanLiteral |
        ESSymbol |
        Void |
        Undefined |
        Null |
        Never |
        NonPrimitive,
    /* @internal */
    Primitive = String |
        Number |
        BigInt |
        Boolean |
        Enum |
        EnumLiteral |
        ESSymbol |
        Void |
        Undefined |
        Null |
        Literal |
        UniqueESSymbol,
    StringLike = String | StringLiteral | TemplateLiteral | StringMapping,
    NumberLike = Number | NumberLiteral | Enum,
    BigIntLike = BigInt | BigIntLiteral,
    BooleanLike = Boolean | BooleanLiteral,
    EnumLike = Enum | EnumLiteral,
    ESSymbolLike = ESSymbol | UniqueESSymbol,
    VoidLike = Void | Undefined,
    /* @internal */
    DefinitelyNonNullable = StringLike |
        NumberLike |
        BigIntLike |
        BooleanLike |
        EnumLike |
        ESSymbolLike |
        Object |
        NonPrimitive,
    /* @internal */
    DisjointDomains = NonPrimitive |
        StringLike |
        NumberLike |
        BigIntLike |
        BooleanLike |
        ESSymbolLike |
        VoidLike |
        Null,
    UnionOrIntersection = Union | Intersection,
    StructuredType = Object | Union | Intersection,
    TypeVariable = TypeParameter | IndexedAccess,
    InstantiableNonPrimitive = TypeVariable | Conditional | Substitution,
    InstantiablePrimitive = Index | TemplateLiteral | StringMapping,
    Instantiable = InstantiableNonPrimitive | InstantiablePrimitive,
    StructuredOrInstantiable = StructuredType | Instantiable,
    /* @internal */
    ObjectFlagsType = Any | Nullable | Never | Object | Union | Intersection,
    /* @internal */
    Simplifiable = IndexedAccess | Conditional,
    /* @internal */
    Singleton = Any |
        Unknown |
        String |
        Number |
        Boolean |
        BigInt |
        ESSymbol |
        Void |
        Undefined |
        Null |
        Never |
        NonPrimitive,
    // 'Narrowable' types are types where narrowing actually narrows.
    // This *should* be every type other than null, undefined, void, and never
    Narrowable = Any |
        Unknown |
        StructuredOrInstantiable |
        StringLike |
        NumberLike |
        BigIntLike |
        BooleanLike |
        ESSymbol |
        UniqueESSymbol |
        NonPrimitive,
    // The following flags are aggregated during union and intersection type construction
    /* @internal */
    IncludesMask = Any |
        Unknown |
        Primitive |
        Never |
        Object |
        Union |
        Intersection |
        NonPrimitive |
        TemplateLiteral,
    // The following flags are used for different purposes during union and intersection type construction
    /* @internal */
    IncludesMissingType = TypeParameter,
    /* @internal */
    IncludesNonWideningType = Index,
    /* @internal */
    IncludesWildcard = IndexedAccess,
    /* @internal */
    IncludesEmptyObject = Conditional,
    /* @internal */
    IncludesInstantiable = Substitution,
    /* @internal */
    NotPrimitiveUnion = Any |
        Unknown |
        Enum |
        Void |
        Never |
        Object |
        Intersection |
        IncludesInstantiable,
}

/**
 * @internal
 */
export const enum SymbolFlags {
    None = 0,
    FunctionScopedVariable = 1 << 0, // Variable (var) or parameter
    BlockScopedVariable = 1 << 1, // A block-scoped variable (let or const)
    Property = 1 << 2, // Property or enum member
    EnumMember = 1 << 3, // Enum member
    Function = 1 << 4, // Function
    Class = 1 << 5, // Class
    Interface = 1 << 6, // Interface
    ConstEnum = 1 << 7, // Const enum
    RegularEnum = 1 << 8, // Enum
    ValueModule = 1 << 9, // Instantiated module
    NamespaceModule = 1 << 10, // Uninstantiated module
    TypeLiteral = 1 << 11, // Type Literal or mapped type
    ObjectLiteral = 1 << 12, // Object Literal
    Method = 1 << 13, // Method
    Constructor = 1 << 14, // Constructor
    GetAccessor = 1 << 15, // Get accessor
    SetAccessor = 1 << 16, // Set accessor
    Signature = 1 << 17, // Call, construct, or index signature
    TypeParameter = 1 << 18, // Type parameter
    TypeAlias = 1 << 19, // Type alias
    ExportValue = 1 << 20, // Exported value marker (see comment in declareModuleMember in binder)
    Alias = 1 << 21, // An alias for another symbol (see comment in isAliasSymbolDeclaration in checker)
    Prototype = 1 << 22, // Prototype property (no source representation)
    ExportStar = 1 << 23, // Export * declaration
    Optional = 1 << 24, // Optional property
    Transient = 1 << 25, // Transient symbol (created during type check)
    Assignment = 1 << 26, // Assignment treated as declaration (eg `this.prop = 1`)
    ModuleExports = 1 << 27, // Symbol for CommonJS `module` of `module.exports`
    /* @internal */
    All = FunctionScopedVariable |
        BlockScopedVariable |
        Property |
        EnumMember |
        Function |
        Class |
        Interface |
        ConstEnum |
        RegularEnum |
        ValueModule |
        NamespaceModule |
        TypeLiteral |
        ObjectLiteral |
        Method |
        Constructor |
        GetAccessor |
        SetAccessor |
        Signature |
        TypeParameter |
        TypeAlias |
        ExportValue |
        Alias |
        Prototype |
        ExportStar |
        Optional |
        Transient,

    Enum = RegularEnum | ConstEnum,
    Variable = FunctionScopedVariable | BlockScopedVariable,
    Value = Variable |
        Property |
        EnumMember |
        ObjectLiteral |
        Function |
        Class |
        Enum |
        ValueModule |
        Method |
        GetAccessor |
        SetAccessor,
    Type = Class |
        Interface |
        Enum |
        EnumMember |
        TypeLiteral |
        TypeParameter |
        TypeAlias,
    Namespace = ValueModule | NamespaceModule | Enum,
    Module = ValueModule | NamespaceModule,
    Accessor = GetAccessor | SetAccessor,

    // Variables can be redeclared, but can not redeclare a block-scoped declaration with the
    // same name, or any other value that is not a variable, e.g. ValueModule or Class
    FunctionScopedVariableExcludes = Value & ~FunctionScopedVariable,

    // Block-scoped declarations are not allowed to be re-declared
    // they can not merge with anything in the value space
    BlockScopedVariableExcludes = Value,

    ParameterExcludes = Value,
    PropertyExcludes = None,
    EnumMemberExcludes = Value | Type,
    FunctionExcludes = Value & ~(Function | ValueModule | Class),
    ClassExcludes = (Value | Type) & ~(ValueModule | Interface | Function), // class-interface mergability done in checker.ts
    InterfaceExcludes = Type & ~(Interface | Class),
    RegularEnumExcludes = (Value | Type) & ~(RegularEnum | ValueModule), // regular enums merge only with regular enums and modules
    ConstEnumExcludes = (Value | Type) & ~ConstEnum, // const enums merge only with const enums
    ValueModuleExcludes = Value &
        ~(Function | Class | RegularEnum | ValueModule),
    NamespaceModuleExcludes = 0,
    MethodExcludes = Value & ~Method,
    GetAccessorExcludes = Value & ~SetAccessor,
    SetAccessorExcludes = Value & ~GetAccessor,
    AccessorExcludes = Value & ~Accessor,
    TypeParameterExcludes = Type & ~TypeParameter,
    TypeAliasExcludes = Type,
    AliasExcludes = Alias,

    ModuleMember = Variable |
        Function |
        Class |
        Interface |
        Enum |
        Module |
        TypeAlias |
        Alias,

    ExportHasLocal = Function | Class | Enum | ValueModule,

    BlockScoped = BlockScopedVariable | Class | Enum,

    PropertyOrAccessor = Property | Accessor,

    ClassMember = Method | Accessor | Property,

    /* @internal */
    ExportSupportsDefaultModifier = Class | Function | Interface,

    /* @internal */
    ExportDoesNotSupportDefaultModifier = ~ExportSupportsDefaultModifier,

    /* @internal */
    // The set of things we consider semantically classifiable.  Used to speed up the LS during
    // classification.
    Classifiable = Class |
        Enum |
        TypeAlias |
        Interface |
        TypeParameter |
        Module |
        Alias,

    /* @internal */
    LateBindingContainer = Class |
        Interface |
        TypeLiteral |
        ObjectLiteral |
        Function,
}

/**
 * @internal
 */
export const enum TypeFormatFlags {
    None = 0,
    NoTruncation = 1 << 0, // Don't truncate typeToString result
    WriteArrayAsGenericType = 1 << 1, // Write Array<T> instead T[]
    // hole because there's a hole in node builder flags
    UseStructuralFallback = 1 << 3, // When an alias cannot be named by its symbol, rather than report an error, fallback to a structural printout if possible
    // hole because there's a hole in node builder flags
    WriteTypeArgumentsOfSignature = 1 << 5, // Write the type arguments instead of type parameters of the signature
    UseFullyQualifiedType = 1 << 6, // Write out the fully qualified type name (eg. Module.Type, instead of Type)
    // hole because `UseOnlyExternalAliasing` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` instead
    SuppressAnyReturnType = 1 << 8, // If the return type is any-like, don't offer a return type.
    // hole because `WriteTypeParametersInQualifiedName` is here in node builder flags, but functions which take old flags use `SymbolFormatFlags` for this instead
    MultilineObjectLiterals = 1 << 10, // Always print object literals across multiple lines (only used to map into node builder flags)
    WriteClassExpressionAsTypeLiteral = 1 << 11, // Write a type literal instead of (Anonymous class)
    UseTypeOfFunction = 1 << 12, // Write typeof instead of function type literal
    OmitParameterModifiers = 1 << 13, // Omit modifiers on parameters

    UseAliasDefinedOutsideCurrentScope = 1 << 14, // For a `type T = ... ` defined in a different file, write `T` instead of its value, even though `T` can't be accessed in the current scope.
    UseSingleQuotesForStringLiteralType = 1 << 28, // Use single quotes for string literal type
    NoTypeReduction = 1 << 29, // Don't call getReducedType
    OmitThisParameter = 1 << 25,

    // Error Handling
    AllowUniqueESSymbolType = 1 << 20, // This is bit 20 to align with the same bit in `NodeBuilderFlags`

    // TypeFormatFlags exclusive
    AddUndefined = 1 << 17, // Add undefined to types of initialized, non-optional parameters
    WriteArrowStyleSignature = 1 << 18, // Write arrow style signature

    // State
    InArrayType = 1 << 19, // Writing an array element type
    InElementType = 1 << 21, // Writing an array or union element type
    InFirstTypeArgument = 1 << 22, // Writing first type argument of the instantiated type
    InTypeAlias = 1 << 23, // Writing type in type alias declaration

    /** @deprecated */ WriteOwnNameForAnyLike = 0, // Does nothing

    NodeBuilderFlagsMask = NoTruncation |
        WriteArrayAsGenericType |
        UseStructuralFallback |
        WriteTypeArgumentsOfSignature |
        UseFullyQualifiedType |
        SuppressAnyReturnType |
        MultilineObjectLiterals |
        WriteClassExpressionAsTypeLiteral |
        UseTypeOfFunction |
        OmitParameterModifiers |
        UseAliasDefinedOutsideCurrentScope |
        AllowUniqueESSymbolType |
        InTypeAlias |
        UseSingleQuotesForStringLiteralType |
        NoTypeReduction |
        OmitThisParameter,
}

/**
 * @internal
 */
export const enum NodeBuilderFlags {
    None = 0,
    // Options
    NoTruncation = 1 << 0, // Don't truncate result
    WriteArrayAsGenericType = 1 << 1, // Write Array<T> instead T[]
    GenerateNamesForShadowedTypeParams = 1 << 2, // When a type parameter T is shadowing another T, generate a name for it so it can still be referenced
    UseStructuralFallback = 1 << 3, // When an alias cannot be named by its symbol, rather than report an error, fallback to a structural printout if possible
    ForbidIndexedAccessSymbolReferences = 1 << 4, // Forbid references like `I["a"]["b"]` - print `typeof I.a<x>.b<y>` instead
    WriteTypeArgumentsOfSignature = 1 << 5, // Write the type arguments instead of type parameters of the signature
    UseFullyQualifiedType = 1 << 6, // Write out the fully qualified type name (eg. Module.Type, instead of Type)
    UseOnlyExternalAliasing = 1 << 7, // Only use external aliases for a symbol
    SuppressAnyReturnType = 1 << 8, // If the return type is any-like and can be elided, don't offer a return type.
    WriteTypeParametersInQualifiedName = 1 << 9,
    MultilineObjectLiterals = 1 << 10, // Always write object literals across multiple lines
    WriteClassExpressionAsTypeLiteral = 1 << 11, // Write class {} as { new(): {} } - used for mixin declaration emit
    UseTypeOfFunction = 1 << 12, // Build using typeof instead of function type literal
    OmitParameterModifiers = 1 << 13, // Omit modifiers on parameters
    UseAliasDefinedOutsideCurrentScope = 1 << 14, // Allow non-visible aliases
    UseSingleQuotesForStringLiteralType = 1 << 28, // Use single quotes for string literal type
    NoTypeReduction = 1 << 29, // Don't call getReducedType
    OmitThisParameter = 1 << 25,

    // Error handling
    AllowThisInObjectLiteral = 1 << 15,
    AllowQualifiedNameInPlaceOfIdentifier = 1 << 16,
    /** @deprecated AllowQualifedNameInPlaceOfIdentifier. Use AllowQualifiedNameInPlaceOfIdentifier instead. */
    AllowQualifedNameInPlaceOfIdentifier = AllowQualifiedNameInPlaceOfIdentifier,
    AllowAnonymousIdentifier = 1 << 17,
    AllowEmptyUnionOrIntersection = 1 << 18,
    AllowEmptyTuple = 1 << 19,
    AllowUniqueESSymbolType = 1 << 20,
    AllowEmptyIndexInfoType = 1 << 21,
    /* @internal */ WriteComputedProps = 1 << 30, // { [E.A]: 1 }

    // Errors (cont.)
    AllowNodeModulesRelativePaths = 1 << 26,
    /* @internal */ DoNotIncludeSymbolChain = 1 << 27, // Skip looking up and printing an accessible symbol chain

    IgnoreErrors = AllowThisInObjectLiteral |
        AllowQualifiedNameInPlaceOfIdentifier |
        AllowAnonymousIdentifier |
        AllowEmptyUnionOrIntersection |
        AllowEmptyTuple |
        AllowEmptyIndexInfoType |
        AllowNodeModulesRelativePaths,

    // State
    InObjectTypeLiteral = 1 << 22,
    InTypeAlias = 1 << 23, // Writing type in type alias declaration
    InInitialEntityName = 1 << 24, // Set when writing the LHS of an entity name or entity name expression
}

/**
 * @internal
 */
export const enum SyntaxKind {
    Unknown,
    EndOfFileToken,
    SingleLineCommentTrivia,
    MultiLineCommentTrivia,
    NewLineTrivia,
    WhitespaceTrivia,
    // We detect and preserve #! on the first line
    ShebangTrivia,
    // We detect and provide better error recovery when we encounter a git merge marker.  This
    // allows us to edit files with git-conflict markers in them in a much more pleasant manner.
    ConflictMarkerTrivia,
    // Literals
    NumericLiteral,
    BigIntLiteral,
    StringLiteral,
    JsxText,
    JsxTextAllWhiteSpaces,
    RegularExpressionLiteral,
    NoSubstitutionTemplateLiteral,
    // Pseudo-literals
    TemplateHead,
    TemplateMiddle,
    TemplateTail,
    // Punctuation
    OpenBraceToken,
    CloseBraceToken,
    OpenParenToken,
    CloseParenToken,
    OpenBracketToken,
    CloseBracketToken,
    DotToken,
    DotDotDotToken,
    SemicolonToken,
    CommaToken,
    QuestionDotToken,
    LessThanToken,
    LessThanSlashToken,
    GreaterThanToken,
    LessThanEqualsToken,
    GreaterThanEqualsToken,
    EqualsEqualsToken,
    ExclamationEqualsToken,
    EqualsEqualsEqualsToken,
    ExclamationEqualsEqualsToken,
    EqualsGreaterThanToken,
    PlusToken,
    MinusToken,
    AsteriskToken,
    AsteriskAsteriskToken,
    SlashToken,
    PercentToken,
    PlusPlusToken,
    MinusMinusToken,
    LessThanLessThanToken,
    GreaterThanGreaterThanToken,
    GreaterThanGreaterThanGreaterThanToken,
    AmpersandToken,
    BarToken,
    CaretToken,
    ExclamationToken,
    TildeToken,
    AmpersandAmpersandToken,
    BarBarToken,
    QuestionToken,
    ColonToken,
    AtToken,
    QuestionQuestionToken,
    /** Only the JSDoc scanner produces BacktickToken. The normal scanner produces NoSubstitutionTemplateLiteral and related kinds. */
    BacktickToken,
    /** Only the JSDoc scanner produces HashToken. The normal scanner produces PrivateIdentifier. */
    HashToken,
    // Assignments
    EqualsToken,
    PlusEqualsToken,
    MinusEqualsToken,
    AsteriskEqualsToken,
    AsteriskAsteriskEqualsToken,
    SlashEqualsToken,
    PercentEqualsToken,
    LessThanLessThanEqualsToken,
    GreaterThanGreaterThanEqualsToken,
    GreaterThanGreaterThanGreaterThanEqualsToken,
    AmpersandEqualsToken,
    BarEqualsToken,
    BarBarEqualsToken,
    AmpersandAmpersandEqualsToken,
    QuestionQuestionEqualsToken,
    CaretEqualsToken,
    // Identifiers and PrivateIdentifiers
    Identifier,
    PrivateIdentifier,
    // Reserved words
    BreakKeyword,
    CaseKeyword,
    CatchKeyword,
    ClassKeyword,
    ConstKeyword,
    ContinueKeyword,
    DebuggerKeyword,
    DefaultKeyword,
    DeleteKeyword,
    DoKeyword,
    ElseKeyword,
    EnumKeyword,
    ExportKeyword,
    ExtendsKeyword,
    FalseKeyword,
    FinallyKeyword,
    ForKeyword,
    FunctionKeyword,
    IfKeyword,
    ImportKeyword,
    InKeyword,
    InstanceOfKeyword,
    NewKeyword,
    NullKeyword,
    ReturnKeyword,
    SuperKeyword,
    SwitchKeyword,
    ThisKeyword,
    ThrowKeyword,
    TrueKeyword,
    TryKeyword,
    TypeOfKeyword,
    VarKeyword,
    VoidKeyword,
    WhileKeyword,
    WithKeyword,
    // Strict mode reserved words
    ImplementsKeyword,
    InterfaceKeyword,
    LetKeyword,
    PackageKeyword,
    PrivateKeyword,
    ProtectedKeyword,
    PublicKeyword,
    StaticKeyword,
    YieldKeyword,
    // Contextual keywords
    AbstractKeyword,
    AccessorKeyword,
    AsKeyword,
    AssertsKeyword,
    AssertKeyword,
    AnyKeyword,
    AsyncKeyword,
    AwaitKeyword,
    BooleanKeyword,
    ConstructorKeyword,
    DeclareKeyword,
    GetKeyword,
    InferKeyword,
    IntrinsicKeyword,
    IsKeyword,
    KeyOfKeyword,
    ModuleKeyword,
    NamespaceKeyword,
    NeverKeyword,
    OutKeyword,
    ReadonlyKeyword,
    RequireKeyword,
    NumberKeyword,
    ObjectKeyword,
    SatisfiesKeyword,
    SetKeyword,
    StringKeyword,
    SymbolKeyword,
    TypeKeyword,
    UndefinedKeyword,
    UniqueKeyword,
    UnknownKeyword,
    FromKeyword,
    GlobalKeyword,
    BigIntKeyword,
    OverrideKeyword,
    OfKeyword, // LastKeyword and LastToken and LastContextualKeyword

    // Parse tree nodes

    // Names
    QualifiedName,
    ComputedPropertyName,
    // Signature elements
    TypeParameter,
    Parameter,
    Decorator,
    // TypeMember
    PropertySignature,
    PropertyDeclaration,
    MethodSignature,
    MethodDeclaration,
    ClassStaticBlockDeclaration,
    Constructor,
    GetAccessor,
    SetAccessor,
    CallSignature,
    ConstructSignature,
    IndexSignature,
    // Type
    TypePredicate,
    TypeReference,
    FunctionType,
    ConstructorType,
    TypeQuery,
    TypeLiteral,
    ArrayType,
    TupleType,
    OptionalType,
    RestType,
    UnionType,
    IntersectionType,
    ConditionalType,
    InferType,
    ParenthesizedType,
    ThisType,
    TypeOperator,
    IndexedAccessType,
    MappedType,
    LiteralType,
    NamedTupleMember,
    TemplateLiteralType,
    TemplateLiteralTypeSpan,
    ImportType,
    // Binding patterns
    ObjectBindingPattern,
    ArrayBindingPattern,
    BindingElement,
    // Expression
    ArrayLiteralExpression,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    ElementAccessExpression,
    CallExpression,
    NewExpression,
    TaggedTemplateExpression,
    TypeAssertionExpression,
    ParenthesizedExpression,
    FunctionExpression,
    ArrowFunction,
    DeleteExpression,
    TypeOfExpression,
    VoidExpression,
    AwaitExpression,
    PrefixUnaryExpression,
    PostfixUnaryExpression,
    BinaryExpression,
    ConditionalExpression,
    TemplateExpression,
    YieldExpression,
    SpreadElement,
    ClassExpression,
    OmittedExpression,
    ExpressionWithTypeArguments,
    AsExpression,
    NonNullExpression,
    MetaProperty,
    SyntheticExpression,
    SatisfiesExpression,

    // Misc
    TemplateSpan,
    SemicolonClassElement,
    // Element
    Block,
    EmptyStatement,
    VariableStatement,
    ExpressionStatement,
    IfStatement,
    DoStatement,
    WhileStatement,
    ForStatement,
    ForInStatement,
    ForOfStatement,
    ContinueStatement,
    BreakStatement,
    ReturnStatement,
    WithStatement,
    SwitchStatement,
    LabeledStatement,
    ThrowStatement,
    TryStatement,
    DebuggerStatement,
    VariableDeclaration,
    VariableDeclarationList,
    FunctionDeclaration,
    ClassDeclaration,
    InterfaceDeclaration,
    TypeAliasDeclaration,
    EnumDeclaration,
    ModuleDeclaration,
    ModuleBlock,
    CaseBlock,
    NamespaceExportDeclaration,
    ImportEqualsDeclaration,
    ImportDeclaration,
    ImportClause,
    NamespaceImport,
    NamedImports,
    ImportSpecifier,
    ExportAssignment,
    ExportDeclaration,
    NamedExports,
    NamespaceExport,
    ExportSpecifier,
    MissingDeclaration,

    // Module references
    ExternalModuleReference,

    // JSX
    JsxElement,
    JsxSelfClosingElement,
    JsxOpeningElement,
    JsxClosingElement,
    JsxFragment,
    JsxOpeningFragment,
    JsxClosingFragment,
    JsxAttribute,
    JsxAttributes,
    JsxSpreadAttribute,
    JsxExpression,

    // Clauses
    CaseClause,
    DefaultClause,
    HeritageClause,
    CatchClause,
    AssertClause,
    AssertEntry,
    ImportTypeAssertionContainer,

    // Property assignments
    PropertyAssignment,
    ShorthandPropertyAssignment,
    SpreadAssignment,

    // Enum
    EnumMember,
    // Unparsed
    UnparsedPrologue,
    UnparsedPrepend,
    UnparsedText,
    UnparsedInternalText,
    UnparsedSyntheticReference,

    // Top-level nodes
    SourceFile,
    Bundle,
    UnparsedSource,
    InputFiles,

    // JSDoc nodes
    JSDocTypeExpression,
    JSDocNameReference,
    JSDocMemberName, // C#p
    JSDocAllType, // The * type
    JSDocUnknownType, // The ? type
    JSDocNullableType,
    JSDocNonNullableType,
    JSDocOptionalType,
    JSDocFunctionType,
    JSDocVariadicType,
    JSDocNamepathType, // https://jsdoc.app/about-namepaths.html
    JSDoc,
    /** @deprecated Use SyntaxKind.JSDoc */
    JSDocComment = JSDoc,
    JSDocText,
    JSDocTypeLiteral,
    JSDocSignature,
    JSDocLink,
    JSDocLinkCode,
    JSDocLinkPlain,
    JSDocTag,
    JSDocAugmentsTag,
    JSDocImplementsTag,
    JSDocAuthorTag,
    JSDocDeprecatedTag,
    JSDocClassTag,
    JSDocPublicTag,
    JSDocPrivateTag,
    JSDocProtectedTag,
    JSDocReadonlyTag,
    JSDocOverrideTag,
    JSDocCallbackTag,
    JSDocEnumTag,
    JSDocParameterTag,
    JSDocReturnTag,
    JSDocThisTag,
    JSDocTypeTag,
    JSDocTemplateTag,
    JSDocTypedefTag,
    JSDocSeeTag,
    JSDocPropertyTag,

    // Synthesized list
    SyntaxList,

    // Transformation nodes
    NotEmittedStatement,
    PartiallyEmittedExpression,
    CommaListExpression,
    MergeDeclarationMarker,
    EndOfDeclarationMarker,
    SyntheticReferenceExpression,

    // Enum value count
    Count,

    // Markers
    FirstAssignment = EqualsToken,
    LastAssignment = CaretEqualsToken,
    FirstCompoundAssignment = PlusEqualsToken,
    LastCompoundAssignment = CaretEqualsToken,
    FirstReservedWord = BreakKeyword,
    LastReservedWord = WithKeyword,
    FirstKeyword = BreakKeyword,
    LastKeyword = OfKeyword,
    FirstFutureReservedWord = ImplementsKeyword,
    LastFutureReservedWord = YieldKeyword,
    FirstTypeNode = TypePredicate,
    LastTypeNode = ImportType,
    FirstPunctuation = OpenBraceToken,
    LastPunctuation = CaretEqualsToken,
    FirstToken = Unknown,
    LastToken = LastKeyword,
    FirstTriviaToken = SingleLineCommentTrivia,
    LastTriviaToken = ConflictMarkerTrivia,
    FirstLiteralToken = NumericLiteral,
    LastLiteralToken = NoSubstitutionTemplateLiteral,
    FirstTemplateToken = NoSubstitutionTemplateLiteral,
    LastTemplateToken = TemplateTail,
    FirstBinaryOperator = LessThanToken,
    LastBinaryOperator = CaretEqualsToken,
    FirstStatement = VariableStatement,
    LastStatement = DebuggerStatement,
    FirstNode = QualifiedName,
    FirstJSDocNode = JSDocTypeExpression,
    LastJSDocNode = JSDocPropertyTag,
    FirstJSDocTagNode = JSDocTag,
    LastJSDocTagNode = JSDocPropertyTag,
    /* @internal */ FirstContextualKeyword = AbstractKeyword,
    /* @internal */ LastContextualKeyword = OfKeyword,
}

/**
 * @internal
 */
export const enum ObjectFlags {
    Class = 1 << 0, // Class
    Interface = 1 << 1, // Interface
    Reference = 1 << 2, // Generic type reference
    Tuple = 1 << 3, // Synthesized generic tuple type
    Anonymous = 1 << 4, // Anonymous
    Mapped = 1 << 5, // Mapped
    Instantiated = 1 << 6, // Instantiated anonymous or mapped type
    ObjectLiteral = 1 << 7, // Originates in an object literal
    EvolvingArray = 1 << 8, // Evolving array type
    ObjectLiteralPatternWithComputedProperties = 1 << 9, // Object literal pattern with computed properties
    ReverseMapped = 1 << 10, // Object contains a property from a reverse-mapped type
    JsxAttributes = 1 << 11, // Jsx attributes type
    JSLiteral = 1 << 12, // Object type declared in JS - disables errors on read/write of nonexisting members
    FreshLiteral = 1 << 13, // Fresh object literal
    ArrayLiteral = 1 << 14, // Originates in an array literal
    /* @internal */
    PrimitiveUnion = 1 << 15, // Union of only primitive types
    /* @internal */
    ContainsWideningType = 1 << 16, // Type is or contains undefined or null widening type
    /* @internal */
    ContainsObjectOrArrayLiteral = 1 << 17, // Type is or contains object literal type
    /* @internal */
    NonInferrableType = 1 << 18, // Type is or contains anyFunctionType or silentNeverType
    /* @internal */
    CouldContainTypeVariablesComputed = 1 << 19, // CouldContainTypeVariables flag has been computed
    /* @internal */
    CouldContainTypeVariables = 1 << 20, // Type could contain a type variable

    ClassOrInterface = Class | Interface,
    /* @internal */
    RequiresWidening = ContainsWideningType | ContainsObjectOrArrayLiteral,
    /* @internal */
    PropagatingFlags = ContainsWideningType |
        ContainsObjectOrArrayLiteral |
        NonInferrableType,
    // Object flags that uniquely identify the kind of ObjectType
    /* @internal */
    ObjectTypeKindMask = ClassOrInterface |
        Reference |
        Tuple |
        Anonymous |
        Mapped |
        ReverseMapped |
        EvolvingArray,

    // Flags that require TypeFlags.Object
    ContainsSpread = 1 << 21, // Object literal contains spread operation
    ObjectRestType = 1 << 22, // Originates in object rest declaration
    InstantiationExpressionType = 1 << 23, // Originates in instantiation expression
    /* @internal */
    IsClassInstanceClone = 1 << 24, // Type is a clone of a class instance type
    // Flags that require TypeFlags.Object and ObjectFlags.Reference
    /* @internal */
    IdenticalBaseTypeCalculated = 1 << 25, // has had `getSingleBaseForNonAugmentingSubtype` invoked on it already
    /* @internal */
    IdenticalBaseTypeExists = 1 << 26, // has a defined cachedEquivalentBaseType member

    // Flags that require TypeFlags.UnionOrIntersection or TypeFlags.Substitution
    /* @internal */
    IsGenericTypeComputed = 1 << 21, // IsGenericObjectType flag has been computed
    /* @internal */
    IsGenericObjectType = 1 << 22, // Union or intersection contains generic object type
    /* @internal */
    IsGenericIndexType = 1 << 23, // Union or intersection contains generic index type
    /* @internal */
    IsGenericType = IsGenericObjectType | IsGenericIndexType,

    // Flags that require TypeFlags.Union
    /* @internal */
    ContainsIntersections = 1 << 24, // Union contains intersections
    /* @internal */
    IsUnknownLikeUnionComputed = 1 << 25, // IsUnknownLikeUnion flag has been computed
    /* @internal */
    IsUnknownLikeUnion = 1 << 26, // Union of null, undefined, and empty object type
    /* @internal */

    // Flags that require TypeFlags.Intersection
    /* @internal */
    IsNeverIntersectionComputed = 1 << 24, // IsNeverLike flag has been computed
    /* @internal */
    IsNeverIntersection = 1 << 25, // Intersection reduces to never
}

/**
 * @internal
 */
export const enum NodeFlags {
    None = 0,
    Let = 1 << 0, // Variable declaration
    Const = 1 << 1, // Variable declaration
    NestedNamespace = 1 << 2, // Namespace declaration
    Synthesized = 1 << 3, // Node was synthesized during transformation
    Namespace = 1 << 4, // Namespace declaration
    OptionalChain = 1 << 5, // Chained MemberExpression rooted to a pseudo-OptionalExpression
    ExportContext = 1 << 6, // Export context (initialized by binding)
    ContainsThis = 1 << 7, // Interface contains references to "this"
    HasImplicitReturn = 1 << 8, // If function implicitly returns on one of codepaths (initialized by binding)
    HasExplicitReturn = 1 << 9, // If function has explicit reachable return on one of codepaths (initialized by binding)
    GlobalAugmentation = 1 << 10, // Set if module declaration is an augmentation for the global scope
    HasAsyncFunctions = 1 << 11, // If the file has async functions (initialized by binding)
    DisallowInContext = 1 << 12, // If node was parsed in a context where 'in-expressions' are not allowed
    YieldContext = 1 << 13, // If node was parsed in the 'yield' context created when parsing a generator
    DecoratorContext = 1 << 14, // If node was parsed as part of a decorator
    AwaitContext = 1 << 15, // If node was parsed in the 'await' context created when parsing an async function
    DisallowConditionalTypesContext = 1 << 16, // If node was parsed in a context where conditional types are not allowed
    ThisNodeHasError = 1 << 17, // If the parser encountered an error when parsing the code that created this node
    JavaScriptFile = 1 << 18, // If node was parsed in a JavaScript
    ThisNodeOrAnySubNodesHasError = 1 << 19, // If this node or any of its children had an error
    HasAggregatedChildData = 1 << 20, // If we've computed data from children and cached it in this node

    // These flags will be set when the parser encounters a dynamic import expression or 'import.meta' to avoid
    // walking the tree if the flags are not set. However, these flags are just a approximation
    // (hence why it's named "PossiblyContainsDynamicImport") because once set, the flags never get cleared.
    // During editing, if a dynamic import is removed, incremental parsing will *NOT* clear this flag.
    // This means that the tree will always be traversed during module resolution, or when looking for external module indicators.
    // However, the removal operation should not occur often and in the case of the
    // removal, it is likely that users will add the import anyway.
    // The advantage of this approach is its simplicity. For the case of batch compilation,
    // we guarantee that users won't have to pay the price of walking the tree if a dynamic import isn't used.
    /* @internal */ PossiblyContainsDynamicImport = 1 << 21,
    /* @internal */ PossiblyContainsImportMeta = 1 << 22,

    JSDoc = 1 << 23, // If node was parsed inside jsdoc
    /* @internal */ Ambient = 1 << 24, // If node was inside an ambient context -- a declaration file, or inside something with the `declare` modifier.
    /* @internal */ InWithStatement = 1 << 25, // If any ancestor of node was the `statement` of a WithStatement (not the `expression`)
    JsonFile = 1 << 26, // If node was parsed in a Json
    /* @internal */ TypeCached = 1 << 27, // If a type was cached for node at any point
    /* @internal */ Deprecated = 1 << 28, // If has '@deprecated' JSDoc tag

    BlockScoped = Let | Const,

    ReachabilityCheckFlags = HasImplicitReturn | HasExplicitReturn,
    ReachabilityAndEmitFlags = ReachabilityCheckFlags | HasAsyncFunctions,

    // Parsing context flags
    ContextFlags = DisallowInContext |
        DisallowConditionalTypesContext |
        YieldContext |
        DecoratorContext |
        AwaitContext |
        JavaScriptFile |
        InWithStatement |
        Ambient,

    // Exclude these flags when parsing a Type
    TypeExcludesFlags = YieldContext | AwaitContext,

    // Represents all flags that are potentially set once and
    // never cleared on SourceFiles which get re-used in between incremental parses.
    // See the comment above on `PossiblyContainsDynamicImport` and `PossiblyContainsImportMeta`.
    /* @internal */ PermanentlySetIncrementalFlags = PossiblyContainsDynamicImport |
        PossiblyContainsImportMeta,
}
