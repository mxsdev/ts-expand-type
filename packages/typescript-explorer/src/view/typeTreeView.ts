import { TypeInfo, TypeId, getTypeInfoChildren, SymbolInfo, SignatureInfo, IndexInfo, pseudoBigIntToString } from '@ts-expand-type/api'
import assert = require('assert');
import * as vscode from 'vscode'
import * as ts from 'typescript'
import { getKindText, getPrimitiveKindText, LocalizableKind } from '../localization';
import { StateManager } from '../state/stateManager';

type ResolvedTypeInfo = Exclude<TypeInfo, {kind: 'reference'}>
type TreeCache = Map<TypeId, ResolvedTypeInfo>

export class TypeTreeProvider implements vscode.TreeDataProvider<TypeTreeItem> {
    constructor(private stateManager: StateManager) { }

    private itemCache: TreeCache = new Map()

    private _onDidChangeTreeData: vscode.EventEmitter<TypeTreeItem | undefined | null | void> = new vscode.EventEmitter<TypeTreeItem | undefined | null | void>()
    readonly onDidChangeTreeData: vscode.Event<TypeTreeItem | undefined | null | void> = this._onDidChangeTreeData.event

    refresh(): void {
        this.itemCache.clear()
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TypeTreeItem) {
        return element
    }
    
    async getChildren(element?: TypeTreeItem): Promise<TypeTreeItem[]> {
        if(!element) {
            const typeInfo = this.stateManager.getTypeTree()
            if(!typeInfo) { return [] }

            this.populateCache(typeInfo)

            return [this.createTypeNode(typeInfo, /* root */ undefined)]
        } else {
            return element.getChildren()
        }
    }

    private populateCache(tree: TypeInfo) {
        if(tree.kind === 'reference') { return }
        this.itemCache.set(tree.id, tree)
        getTypeInfoChildren(tree).forEach(c => this.populateCache(c))
    }

    resolveTypeReference(typeInfo: TypeInfo): ResolvedTypeInfo {
        if(typeInfo.kind === 'reference') {
            const resolvedTypeInfo = this.itemCache.get(typeInfo.id)
            assert(resolvedTypeInfo, "Encountered invalid type reference!")
            return resolvedTypeInfo
        }

        return typeInfo
    }

    createTypeNode(typeInfo: TypeInfo, parent: TypeTreeItem|undefined, args?: TypeNodeArgs) {
        return new TypeNode(typeInfo, this, parent, args)
    }
}

abstract class TypeTreeItem extends vscode.TreeItem {
    protected depth: number

    constructor(
        label: string, collapsibleState: vscode.TreeItemCollapsibleState,
        private provider: TypeTreeProvider, 
        protected parent?: TypeTreeItem
    ) {
        super(label, collapsibleState)
        this.depth = (parent?.depth ?? 0) + 1
    }

    abstract getChildren(): TypeTreeItem[]

    isCollapsible(): boolean {
        return this.collapsibleState !== vscode.TreeItemCollapsibleState.None
    }

    createChildTypeNode(typeInfo: TypeInfo, args?: TypeNodeArgs) {
        return this.provider.createTypeNode(typeInfo, this, args)
    }

    createNodeGroup(typeInfos: TypeInfo[], label: string) {
        return new TypeNodeGroup(label, this.provider, this, typeInfos)
    }

    createSigatureNode(signature: SignatureInfo) {
        return new SignatureNode(signature, this.provider, this)
    }

    createIndexNode(indexInfo: IndexInfo) {
        return new IndexNode(indexInfo, this.provider, this)
    }

    getSignatureChildren(signature: SignatureInfo): TypeNode[] {
        return [
            ...signature.parameters.map(param => this.createChildTypeNode(param)),
            this.createChildTypeNode(signature.returnType, { purpose: 'return' }),
        ]
    }
}

class TypeNode extends TypeTreeItem {
    typeTree: ResolvedTypeInfo

    constructor(
        typeTree: TypeInfo,
        provider: TypeTreeProvider,
        parent: TypeTreeItem|undefined,
        private args?: TypeNodeArgs,
    ) {
        const symbolMeta = typeTree.symbolMeta
        let dimension = 0

        while(typeTree.kind === 'array' || typeTree.kind === 'reference') {
            if(typeTree.kind === 'array') {
                dimension++
                typeTree = typeTree.type
            } else {
                typeTree = provider.resolveTypeReference(typeTree)
            }
        }

        const resolvedTypeTree = {...typeTree, symbolMeta} as ResolvedTypeInfo

        const { label, description, isCollapsible } = generateTypeNodeMeta(resolvedTypeTree, dimension, args)
        super(label, vscode.TreeItemCollapsibleState.None, provider, parent)

        if(isCollapsible) {
            this.collapsibleState = this.depth > 1 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Expanded
        }

        this.typeTree = resolvedTypeTree
        this.description = description
    }
    
    getChildren(): TypeTreeItem[] {
        const { kind } = this.typeTree

        const toTreeNodeArgs = (info: TypeInfo, args?: TypeNodeArgs) => this.createChildTypeNode(info, args)
        const toTreeNode = (info: TypeInfo) => toTreeNodeArgs(info)

        switch(kind) {
            case "object": {
                const { properties, indexInfos = [] } = this.typeTree
                return [
                    ...indexInfos.map(info => this.createIndexNode(info)),
                    ...properties.map(toTreeNode),
                ]
            }

            case "class":
            case "interface": {
                const { properties, baseType, implementsTypes, constructSignatures, typeParameters } = this.typeTree
                return [ 
                    ...typeParameters ? [this.createNodeGroup(typeParameters, "Type Parameters")] : [],
                    ...constructSignatures ? [toTreeNodeArgs({ kind: 'function', id: -1, signatures: constructSignatures }, { purpose: 'class_constructor' })] : [],
                    ...baseType ? [toTreeNodeArgs(baseType, { purpose: 'class_base_type'})] : [],
                    ...(implementsTypes && implementsTypes.length > 0) ? [this.createNodeGroup(implementsTypes, "Implements")] : [],
                    ...properties.map(toTreeNode),
                ]
            }

            case "enum": {
                const { properties = [] } = this.typeTree
                return properties.map(toTreeNode)
            }

            case "function": {
                const { signatures } = this.typeTree
                
                if(signatures.length === 1) {
                    return this.getSignatureChildren(signatures[0])
                } else {
                    return signatures.map(sig => this.createSigatureNode(sig))
                }
            }

            case "array": {
                throw new Error("Tried to get children for array type")
            }

            case "tuple": {
                const { types, names } = this.typeTree
                return types.map((t, i) => toTreeNodeArgs(t, { name: names?.[i] }))
            }

            case "conditional": {
                const { checkType, extendsType, trueType, falseType } = this.typeTree

                return [
                    toTreeNodeArgs(checkType, { purpose: 'conditional_check' }),
                    toTreeNodeArgs(extendsType, { purpose: 'conditional_extends'}),
                    ...trueType ? [toTreeNodeArgs(trueType, { purpose: 'conditional_true' })] : [],
                    ...falseType ? [toTreeNodeArgs(falseType, { purpose: 'conditional_false' })] : [],
                ]
            }

            case "index": {
                const { keyOf } = this.typeTree

                return [
                    toTreeNodeArgs(keyOf, { purpose: 'keyof' })
                ]
            }

            case "indexed_access": {
                const { indexType, objectType } = this.typeTree

                return [
                    toTreeNodeArgs(objectType, { purpose: 'indexed_access_base' }),
                    toTreeNodeArgs(indexType, { purpose: 'indexed_access_index' }),
                ]
            }

            // TODO: intersection properties
            case "intersection":
            case "union": {
                const { types } = this.typeTree
                return types.map(toTreeNode)
            }

            case "string_mapping": {
                const { type } = this.typeTree
                return [toTreeNode(type)]
            }

            case "template_literal": {
                const { types, texts } = this.typeTree
                const res: TypeTreeItem[] = []

                let i = 0, j = 0

                while(i < texts.length || j < types.length) {
                    if(i < texts.length) {
                        const text = texts[i]
                        if(text) {
                            // TODO: this should probably be its own treenode type
                            res.push(
                                toTreeNode({ kind: 'string_literal', id: -1, value: text })
                            )
                        }
                        i++
                    }

                    if(j < types.length) {
                        const type = types[j]
                        res.push(toTreeNode(type))
                        j++
                    }
                }

                return res
            }

            case "type_parameter": {
                const { defaultType, baseConstraint } = this.typeTree
                return [
                    ...defaultType ? [toTreeNodeArgs(defaultType, { purpose: 'parameter_default' })] : [],
                    ...baseConstraint ? [toTreeNodeArgs(baseConstraint, { purpose: 'parameter_base_constraint' })] : [],
                ]
            }

            case "primitive":
            case "bigint_literal":
            case "boolean_literal":
            case "enum_literal":
            case "number_literal":
            default: {
                return []
                break
            }
        }
    }
}

class SignatureNode extends TypeTreeItem {
    constructor(
        private signature: SignatureInfo,
        provider: TypeTreeProvider,
        parent: TypeTreeItem|undefined,
    ) {
        super(signature.symbolMeta?.name ?? "", vscode.TreeItemCollapsibleState.Collapsed, provider, parent)
        this.description = "signature"
    }

    getChildren() {
        return this.getSignatureChildren(this.signature)
    }
}

class IndexNode extends TypeTreeItem {
    constructor(
        private indexInfo: IndexInfo,
        provider: TypeTreeProvider,
        parent: TypeTreeItem|undefined
    ) {
        super(indexInfo.parameterSymbol?.name ?? "", vscode.TreeItemCollapsibleState.Collapsed, provider, parent)
        this.description = "index"
    }

    getChildren() {
        return [
            ...this.indexInfo.keyType ? [this.createChildTypeNode(this.indexInfo.keyType, { purpose: 'index_type'})] : [],
            ...this.indexInfo.type ? [this.createChildTypeNode(this.indexInfo.type, { purpose: 'index_value_type'})] : [],
        ]
    }
}

type TypeNodeArgs = {
    purpose?: 'return'|'index_type'|'index_value_type'|'conditional_check'|'conditional_extends'|'conditional_true'|'conditional_false'|'keyof'|'indexed_access_index'|'indexed_access_base'|'parameter_default'|'parameter_base_constraint'|'class_constructor'|'class_base_type',
    optional?: boolean,
    name?: string,
}

class TypeNodeGroup extends TypeTreeItem {
    constructor(
        label: string,
        provider: TypeTreeProvider,
        parent: TypeTreeItem|undefined,
        public children: TypeInfo[],
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed, provider, parent)
    }

    getChildren(): TypeTreeItem[] {
        return this.children.map(c => this.createChildTypeNode(c))
    }
}

function generateTypeNodeMeta(info: ResolvedTypeInfo, dimension: number, {purpose, optional, name: forceName }: TypeNodeArgs = {}) {
    let nameOverridden = false

    const isOptional = info.symbolMeta?.optional || optional || ((info.symbolMeta?.flags ?? 0) & ts.SymbolFlags.Optional)
    const isRest = info.symbolMeta?.rest

    const label = getLabel()
    const description = getDescription(label)

    return {
        label, description,
        isCollapsible: kindHasChildren(info.kind)
    }

    function getLabel() {
        const nameByPurpose = getNameByPurpose()
        nameOverridden = true

        if(forceName !== undefined) {
            return forceName
        }

        if(purpose && purpose in nameByPurpose) {
            return `<${nameByPurpose[purpose]!}>`
        }

        nameOverridden = false
        return !info.symbolMeta?.anonymous ? (info.symbolMeta?.name ?? "") : ""
    }

    function getDescription(label: string) {
        const baseDescription = getDescriptionFromBase(getBaseDescription())

        const aliasDescriptionBase = getAliasDescription() ?? (nameOverridden && info.symbolMeta?.name)
        const aliasDescription = (aliasDescriptionBase && aliasDescriptionBase !== label) && getDescriptionFromBase(aliasDescriptionBase, false)

        return aliasDescription ? `${aliasDescription} (${baseDescription})` : baseDescription

        function getDescriptionFromBase(base: string, includeRest = true) {
            base += "[]".repeat(dimension)
            
            if(isOptional) {
                base += '?'
            }

            if(isRest && includeRest) {
                base = "..." + base
            }

            return base
        }

    }

    function getAliasDescription(): string|undefined {
        switch(info.kind) {
            case "type_parameter": {
                return info.symbolMeta?.name
            }

            case "bigint_literal":
            case "number_literal":
            case "string_literal":
            case "boolean_literal": {
                return undefined
            }

            case "enum_literal": {
                let text = info.symbol.name
                if(info.parentSymbol) {
                    text = `${info.parentSymbol.name}.${text}`
                }
                return text
            }

            default: {
                return info.aliasSymbolMeta?.name
            }
        }
    }

    function getBaseDescription(): string {
        const kindText = (kind: LocalizableKind, ...args: string[]) => getKindText(kind, { insideClassOrInterface: info.symbolMeta?.insideClassOrInterface }, ...args)

        switch(info.kind) {
            case "string_mapping": {
                const { symbol } = info
                return symbol.name
            }

            case "primitive": {
                return getPrimitiveKindText(info.primitive)
            }

            case "bigint_literal": {
                return kindText(info.kind, pseudoBigIntToString(info.value))
            }

            case "boolean_literal": {
                return kindText(info.kind, info.value.toString())
            }

            case "string_literal": {
                return kindText(info.kind, info.value)
            }

            case "number_literal": {
                return kindText(info.kind, info.value.toString())
            }

            default: {
                return kindText(info.kind)
            }
        }
    }

    function getNameByPurpose() {
        const nameByPurpose: Partial<Record<NonNullable<TypeNodeArgs['purpose']>, string>> = {
            return: "return",
            index_type: "constraint",
            index_value_type: "value",
            conditional_check: "check",
            conditional_extends: "extends",
            conditional_true: "true",
            conditional_false: "false",
            keyof: "keyof",
            indexed_access_base: "base",
            indexed_access_index: "index",
            parameter_base_constraint: "extends",
            parameter_default: "default",
            class_constructor: "constructor",
        }

        return nameByPurpose
    }
}

type TypeInfoKind = TypeInfo['kind']
function kindHasChildren(kind: TypeInfoKind) {
    return kind === 'conditional' 
           || kind === 'object'      
           || kind === 'index'      
           || kind === 'indexed_access'      
           || kind === 'substitution'      
           || kind === 'union'      
           || kind === 'intersection'
           || kind === 'tuple'
           || kind === 'function'
           || kind === 'string_mapping'
           || kind === 'template_literal'
           || kind === 'enum'
           || kind === 'type_parameter'
           || kind === 'interface'
           || kind === 'class'
}