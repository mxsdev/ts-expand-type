import assert from "assert"
import {
    LocalizedTypeInfo,
    LocalizedTypeInfoOrError,
    LocalizeOpts,
    ResolvedArrayTypeInfo,
    ResolvedTypeInfo,
    TypeInfo,
    TypeInfoChild,
    TypeInfoMap,
    TypeInfoRetriever,
} from "./types"
import { getTypeInfoChildren } from "./tree"
import { _localizeTypeInfo } from "./localizedTree"
import { filterUndefined } from "./objectUtil"

/**
 * Localizes and resolves circularities in TypeInfo nodes
 */
export class TypeInfoResolver {
    /**
     * @internal
     */
    private includeIds = false

    /**
     * @internal
     */
    private typeInfoMaps = new WeakMap<TypeInfo, TypeInfoMap>()

    /**
     * @internal
     */
    private localizedInfoOrigin = new WeakMap<LocalizedTypeInfo, TypeInfo>()

    constructor(private retrieveTypeInfo?: TypeInfoRetriever) {}

    async localize(info: TypeInfo): Promise<LocalizedTypeInfoOrError> {
        return this.localizeWorker(info).catch((e) => ({
            error: {
                error: e as Error,
                typeInfo: info,
            },
        }))
    }

    private async localizeWorker(info: TypeInfo) {
        return this.localizeTypeInfo(
            await this.resolveTypeReferenceOrArray(info),
            info
        )
    }

    private async localizeChild(
        child: TypeInfoChild,
        parentOrigin: TypeInfo
    ): Promise<LocalizedTypeInfoOrError> {
        return this.localizeChildWorker(child, parentOrigin).catch((e) => ({
            error: {
                error: e as Error,
                typeInfo: child.info,
            },
        }))
    }

    private async localizeChildWorker(
        { info, localizedInfo, opts }: TypeInfoChild,
        parentOrigin: TypeInfo
    ): Promise<LocalizedTypeInfo> {
        assert(
            info || localizedInfo,
            "Either info or localized info must be provided"
        )

        if (localizedInfo) {
            this.localizedInfoOrigin.set(localizedInfo, parentOrigin)
            return localizedInfo
        }

        assert(info)

        const typeInfoMap = this.getTypeInfoMap(parentOrigin)

        const resolvedInfo = await this.resolveTypeReferenceOrArray(
            info,
            typeInfoMap
        )

        return this.localizeTypeInfo(resolvedInfo, info, opts)
    }

    async localizeChildren(
        parent: LocalizedTypeInfo,
        typeArguments = false
    ): Promise<LocalizedTypeInfoOrError[]> {
        const parentOrigin = this.localizedInfoOrigin.get(parent)
        assert(parentOrigin)

        const targets = !typeArguments ? parent.children : parent.typeArguments

        return await Promise.all(
            targets?.map((child) => this.localizeChild(child, parentOrigin)) ??
                []
        ).then(filterUndefined)
    }

    hasTypeInfo(info: TypeInfo): boolean {
        return this.typeInfoMaps.has(info)
    }

    hasLocalizedTypeInfo(localizedInfo: LocalizedTypeInfo): boolean {
        const info = this.localizedInfoOrigin.get(localizedInfo)
        return !!(info && this.hasTypeInfo(info))
    }

    private localizeTypeInfo(
        resolvedInfo: ResolvedArrayTypeInfo,
        info?: TypeInfo,
        opts?: LocalizeOpts
    ) {
        info ??= resolvedInfo.info

        opts ??= {}
        opts.includeIds = this.includeIds

        return _localizeTypeInfo(
            info,
            resolvedInfo,
            { localizedOrigin: this.localizedInfoOrigin },
            opts
        )
    }

    private getTypeInfoMap(info: TypeInfo) {
        if (this.typeInfoMaps.has(info)) {
            return this.typeInfoMaps.get(info)!
        }

        const typeInfoMap = this.generateTypeInfoMap(info)
        this.typeInfoMaps.set(info, typeInfoMap)

        return typeInfoMap
    }

    private async resolveTypeReferenceOrArray(
        info: TypeInfo,
        _typeInfoMap?: TypeInfoMap
    ): Promise<ResolvedArrayTypeInfo> {
        let dimension = 0
        let resolvedInfo = info

        let typeInfoMap = _typeInfoMap ?? this.getTypeInfoMap(info)

        while (
            resolvedInfo.kind === "array" ||
            resolvedInfo.kind === "reference"
        ) {
            // TODO: this process of flattening an array should probably
            //       be done in tree.ts, so as to not unnecessarily
            //       consume depth stacks
            if (resolvedInfo.kind === "array") {
                dimension++
                resolvedInfo = resolvedInfo.type
            } else {
                const resolved = await this.resolveTypeReference(
                    resolvedInfo,
                    typeInfoMap
                )

                assert(resolved, "Cannot resolve type from location!")

                typeInfoMap = resolved.typeInfoMap
                resolvedInfo = resolved.typeInfo
            }
        }

        resolvedInfo = {
            ...resolvedInfo,
            symbolMeta: info.symbolMeta,
            aliasSymbolMeta:
                resolvedInfo.aliasSymbolMeta ?? resolvedInfo.symbolMeta,
            id: info.id,
        }

        if (dimension === 0) {
            resolvedInfo.aliasSymbolMeta = info.aliasSymbolMeta
        }

        this.typeInfoMaps.set(resolvedInfo, typeInfoMap)

        return { info: resolvedInfo, dimension }
    }

    private async resolveTypeReference(
        typeInfo: TypeInfo,
        typeInfoMap: TypeInfoMap
    ): Promise<
        { typeInfo: ResolvedTypeInfo; typeInfoMap: TypeInfoMap } | undefined
    > {
        if (typeInfo.kind === "reference") {
            if (typeInfo.location) {
                assert(this.retrieveTypeInfo, "Must provide retriveTypeInfo")

                const retrievedTypeInfo = (await this.retrieveTypeInfo(
                    typeInfo.location
                )) as ResolvedTypeInfo

                if (!retrievedTypeInfo) return undefined

                typeInfoMap = this.getTypeInfoMap(retrievedTypeInfo)
                typeInfo = retrievedTypeInfo
            } else {
                const resolvedTypeInfo = typeInfoMap.get(typeInfo.id)
                assert(resolvedTypeInfo, "Encountered invalid type reference!")

                typeInfo = resolvedTypeInfo
            }
        }

        this.typeInfoMaps.set(typeInfo, typeInfoMap)
        return { typeInfo, typeInfoMap }
    }

    private generateTypeInfoMap(
        tree: TypeInfo,
        cache?: TypeInfoMap
    ): TypeInfoMap {
        cache ??= new Map()

        if (tree.kind === "reference") {
            return cache
        }
        cache.set(tree.id, tree)
        getTypeInfoChildren(tree).forEach((c) =>
            this.generateTypeInfoMap(c, cache)
        )

        return cache
    }

    /**
     * Sets resolver to debug mode, which will include id information in
     * resultant localized type info.
     *
     * This is used by the test runner to identify circular paths.
     */
    debug(): this {
        this.includeIds = true
        return this
    }
}
