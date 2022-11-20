# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.4.0](https://github.com/mxsdev/ts-expand-type/compare/v0.3.3...v0.4.0) (2022-11-20)

### Bug Fixes

-   hide internal symbol names ([b9b49ff](https://github.com/mxsdev/ts-expand-type/commit/b9b49ff12cd4c3caf3529843bf7c43a4482b2e9a)), closes [#20](https://github.com/mxsdev/ts-expand-type/issues/20)

### Features

-   **api:** secure lazy symbol resolution ([a21086c](https://github.com/mxsdev/ts-expand-type/commit/a21086c66062d7b4e2a94d3162c9cbe71193323f)), closes [#23](https://github.com/mxsdev/ts-expand-type/issues/23)
-   configurable recursion depth ([99f6878](https://github.com/mxsdev/ts-expand-type/commit/99f68782b7e6b5c295338e4bbc3b0092cbe9c7ae))
-   error entries in type tree ([071665c](https://github.com/mxsdev/ts-expand-type/commit/071665c82bbeeb0fb08c4cc87c140a0d8c6ac046)), closes [#15](https://github.com/mxsdev/ts-expand-type/issues/15)
-   show type arguments in labels ([1c062c7](https://github.com/mxsdev/ts-expand-type/commit/1c062c78b4ac93d2faa2c7d35b56b340296c666f)), closes [#19](https://github.com/mxsdev/ts-expand-type/issues/19)

## [0.3.2](https://github.com/mxsdev/ts-expand-type/compare/v0.3.1...v0.3.2) (2022-11-09)

### Bug Fixes

-   **api:** remove typescript import ([acfe537](https://github.com/mxsdev/ts-expand-type/commit/acfe5371483dc3a8ead50875c14aab65b353abba))

## [0.3.1](https://github.com/mxsdev/ts-expand-type/compare/v0.3.0...v0.3.1) (2022-11-09)

### Bug Fixes

-   **api:** resolve signature only on identifier ([155fbff](https://github.com/mxsdev/ts-expand-type/commit/155fbfffada7e30495b3f01d8bbf4cf33af17209))
-   **api:** resolve symbol declarations ([4d6640f](https://github.com/mxsdev/ts-expand-type/commit/4d6640f76d2c38bd3f92687297032ce7632e220f)), closes [#16](https://github.com/mxsdev/ts-expand-type/issues/16)

# [0.3.0](https://github.com/mxsdev/ts-expand-type/compare/v0.2.0...v0.3.0) (2022-11-08)

### Bug Fixes

-   **api:** error getting signature type arguments ([732fe0d](https://github.com/mxsdev/ts-expand-type/commit/732fe0dc034c834aaf495aee04ec286786a54275)), closes [#14](https://github.com/mxsdev/ts-expand-type/issues/14)
-   **api:** find nearest signature recursively ([ec3b53b](https://github.com/mxsdev/ts-expand-type/commit/ec3b53bf83abe3d175ac1c44a1b14e2396eb37d7)), closes [#9](https://github.com/mxsdev/ts-expand-type/issues/9)
-   **api:** getParameterInfo throws error ([3d0dd77](https://github.com/mxsdev/ts-expand-type/commit/3d0dd77bd587a596c741908bbc4f1dc8ccec8ffa))
-   **api:** import ts as pure type ([404a009](https://github.com/mxsdev/ts-expand-type/commit/404a0096d582b90ae8ec6de18e9c918e2a394482))
-   **api:** max recursion depth hit unexpectedly ([b97d4de](https://github.com/mxsdev/ts-expand-type/commit/b97d4deea9a68fbc97fc80f4af47965ecbf0ce44)), closes [#10](https://github.com/mxsdev/ts-expand-type/issues/10)
-   **api:** use interface symbol as alias ([4a38b19](https://github.com/mxsdev/ts-expand-type/commit/4a38b19ab86f6f47216c3381b7b25ec7286fb10a))

### Features

-   **api:** use resolved symbol as alias ([db02e7b](https://github.com/mxsdev/ts-expand-type/commit/db02e7ba7e1ad72eb79b6d41a5a5c5ca014b21b9))
-   support modules and namespaces ([670e069](https://github.com/mxsdev/ts-expand-type/commit/670e06970baf7040471aa5967a974a0d521f415a)), closes [#6](https://github.com/mxsdev/ts-expand-type/issues/6) [#7](https://github.com/mxsdev/ts-expand-type/issues/7)
-   support readonly ([5848029](https://github.com/mxsdev/ts-expand-type/commit/5848029cfbe116727efa9ed28cc728ebb6dac544))
-   **vscode:** hide error messages ([1103cc0](https://github.com/mxsdev/ts-expand-type/commit/1103cc0604dd05588cd17b3b46a8744aa6554477)), closes [#13](https://github.com/mxsdev/ts-expand-type/issues/13)

# [0.2.0](https://github.com/mxsdev/ts-expand-type/compare/v0.1.0...v0.2.0) (2022-10-30)

### Bug Fixes

-   **api:** type node resolution sometimes failing ([c9873f8](https://github.com/mxsdev/ts-expand-type/commit/c9873f8368dea2fc715fd78ee7cda9bda892b214))
-   return dummy completion info ([544bdc1](https://github.com/mxsdev/ts-expand-type/commit/544bdc149b7d4e7d5f44048749ebf3ce834c829b))

### Features

-   support jsx components ([65e3c87](https://github.com/mxsdev/ts-expand-type/commit/65e3c87d2f6b8017265bd455265056b06bb0e1db))

### Performance Improvements

-   switch from quickinfo to completions ([0d18d5c](https://github.com/mxsdev/ts-expand-type/commit/0d18d5cd4538d04c94a94da7452754f695cfacf9))

# 0.1.0 (2022-10-28)

### Bug Fixes

-   **api:** check for optional parameters ([6aa937e](https://github.com/mxsdev/ts-expand-type/commit/6aa937eeea972729303e95bc5b3ffcd63cab3f81))
-   **api:** fix stripped internals ([2aa4761](https://github.com/mxsdev/ts-expand-type/commit/2aa4761af5950393115cb14ef3445291173d6436))
-   **api:** ignore instantiated mapped type parameters ([9cdaeca](https://github.com/mxsdev/ts-expand-type/commit/9cdaeca85c7cb6b618de74d1e54bfe37e84e01cf))
-   **api:** implement max recursion depth ([10c621e](https://github.com/mxsdev/ts-expand-type/commit/10c621e5af85e65716524822b621ee48c728d6af))
-   **api:** include class implementations ([955abcd](https://github.com/mxsdev/ts-expand-type/commit/955abcd270a9af22c25d832de60fe4289b8a4fc9))
-   **api:** interface doesn't have alias ([6857141](https://github.com/mxsdev/ts-expand-type/commit/6857141eac4062088e31593906bd8e7a683d40e2))
-   **api:** intersections not merging ([48bd533](https://github.com/mxsdev/ts-expand-type/commit/48bd5336cc69d7310032deab13bd9a58604130b0))
-   **api:** narrow declarations to identifier ([5b8448f](https://github.com/mxsdev/ts-expand-type/commit/5b8448f4f3afdf7b827fbdf833d446040731fa3a))
-   **api:** not getting interface symbols ([8646664](https://github.com/mxsdev/ts-expand-type/commit/8646664b0b7f5217e3659b3e8b33470bdce4dcb7))
-   **api:** simple index info has parameter info ([3b477b5](https://github.com/mxsdev/ts-expand-type/commit/3b477b587d1342f2fe79f5d3061b37fb879bf249))
-   **api:** some enum literals not working ([d507076](https://github.com/mxsdev/ts-expand-type/commit/d507076adcbcfe414818e8a46dbb736bbfe3907e))
-   **api:** support intersections of mapped types ([799f81c](https://github.com/mxsdev/ts-expand-type/commit/799f81c2883464a231aacb9841215a01e83ca5b2))
-   **api:** support synthetic anonymous types ([6fcfe62](https://github.com/mxsdev/ts-expand-type/commit/6fcfe62c358f81969efa44c6889323a8bbc18266))
-   class instances shouldn't go to class definitions ([b5340f9](https://github.com/mxsdev/ts-expand-type/commit/b5340f9247392fdef65d143ced9b116e4b776b8a))
-   mapped type/signatures dont have icons ([1f16913](https://github.com/mxsdev/ts-expand-type/commit/1f169138911c83b8c3e4cf604a22fb48ab1ef247))
-   prevent race condition with refresh ([421a9f9](https://github.com/mxsdev/ts-expand-type/commit/421a9f962f610fe7ba8fd0d3eeb63e939248bd14))

### Features

-   add type parameter constraint and default ([79b7634](https://github.com/mxsdev/ts-expand-type/commit/79b763450972d9f38dc7c8262e70386fd513ebc3))
-   **api:** add location to index info ([d064c55](https://github.com/mxsdev/ts-expand-type/commit/d064c553484437b66d989ccca246da7fa67a1a25))
-   **api:** add primitive kind to localized tree ([2613e19](https://github.com/mxsdev/ts-expand-type/commit/2613e191a8b6d97c45041bfc5ddd036905f5dd67))
-   **api:** export tree info types ([943b3eb](https://github.com/mxsdev/ts-expand-type/commit/943b3ebb6ec2f5b34db0a273389b7a43cb9bec32))
-   **api:** generate type tree ([81b89f2](https://github.com/mxsdev/ts-expand-type/commit/81b89f2f4acf0bfe557d2c0423f9200f9d833546))
-   **api:** give purpose as string literal ([32cb5f7](https://github.com/mxsdev/ts-expand-type/commit/32cb5f79dcbce37ced4766a1d252b5c856b0be38))
-   **api:** indicate properties in localized tree ([349cc3b](https://github.com/mxsdev/ts-expand-type/commit/349cc3b071dde70bcc3660ae146d46658fa8a517))
-   **api:** support boolean literals ([190a996](https://github.com/mxsdev/ts-expand-type/commit/190a9962aef42b71fa694e40e597acc873a06523))
-   **api:** support conditional types ([180a0a9](https://github.com/mxsdev/ts-expand-type/commit/180a0a9b71de0b7a5e2bd67a06505ea96e277d12))
-   **api:** support mapped type parameters ([d0c603a](https://github.com/mxsdev/ts-expand-type/commit/d0c603a2075adfe65033bd16a67133640eec8352))
-   **api:** support optional parameters ([7dfbeb8](https://github.com/mxsdev/ts-expand-type/commit/7dfbeb86c7e38b86211d4bd12c72fdefda718d03))
-   code extension scaffolding ([8e011f8](https://github.com/mxsdev/ts-expand-type/commit/8e011f808ad2d8e7e71fa874664e0c8a5eb88b72))
-   include class info within class instance ([d19130c](https://github.com/mxsdev/ts-expand-type/commit/d19130cd865f9214b2737353c50c36adc71c8ad4))
-   lazy load symbols ([f078045](https://github.com/mxsdev/ts-expand-type/commit/f0780452a722da283a2bce8107e79fe23b4dc1fd))
-   mapped type parameters ([7688059](https://github.com/mxsdev/ts-expand-type/commit/76880597ac5ad4fd1f1d60cfb239d8d29f942616))
-   show type info for type literals ([770dfba](https://github.com/mxsdev/ts-expand-type/commit/770dfba77aa8265927785aac7e8e76006eee7303))
-   support alias names ([1174b6d](https://github.com/mxsdev/ts-expand-type/commit/1174b6dba6579dc4606b06054763bd8f3c2c4a32))
-   support arrays and tuples ([2429fda](https://github.com/mxsdev/ts-expand-type/commit/2429fdac148a5c8c32843fd19a214c283d952e35))
-   support classes & interfaces ([34f1340](https://github.com/mxsdev/ts-expand-type/commit/34f134059680c956b6051bfc05fa71f0db0b2fb7))
-   support enums & enum literals ([01c0749](https://github.com/mxsdev/ts-expand-type/commit/01c074979abd3870bcb0e47c987a0fac26211439))
-   support function generics ([9eecac9](https://github.com/mxsdev/ts-expand-type/commit/9eecac908c20e514dfab1b98b26111649872026c))
-   support going to type definition ([e4b6675](https://github.com/mxsdev/ts-expand-type/commit/e4b66757d7157cd485876b43fca382007c4406e7))
-   support indexes in interfaces ([0f99fe8](https://github.com/mxsdev/ts-expand-type/commit/0f99fe8cad5a5843483b4b402383284833bb6809))
-   support intrinsic types ([802e9f5](https://github.com/mxsdev/ts-expand-type/commit/802e9f512139c8c0859c9293aecabf40ac8a7fd4))
-   support keyof and indexed access ([5e67899](https://github.com/mxsdev/ts-expand-type/commit/5e6789924cd2d0184e3462645a3fe3ff3a6fd0d0))
-   support named tuples ([f87a0ab](https://github.com/mxsdev/ts-expand-type/commit/f87a0ab285609ab56f81fd5696a2fa4b8e012bad))
-   support optional function parameters ([0a7704c](https://github.com/mxsdev/ts-expand-type/commit/0a7704ccb882ed35e596b4221d22373a44b5fe9b))
-   support rest parameters ([ebb5ddb](https://github.com/mxsdev/ts-expand-type/commit/ebb5ddba158f797dc73e171eef92141cbfe19e78))
-   support type parameters in classes and type aliases ([be63c2e](https://github.com/mxsdev/ts-expand-type/commit/be63c2e01439c77c6e682618288d456e7aeea1ef))
-   **vscode:** add type tree view ([9d18f22](https://github.com/mxsdev/ts-expand-type/commit/9d18f220404cf68259ac34226eef0ad5a5c4627c))
-   **vscode:** expanded type in quickinfo ([ceaafa9](https://github.com/mxsdev/ts-expand-type/commit/ceaafa9b04efe208e0ad9a2ff5c47d0d17a60847))
-   **vscode:** support bigint literals ([8353913](https://github.com/mxsdev/ts-expand-type/commit/8353913670425608351b2a8110bdfa83c284cbdb))
-   **vscode:** support mapped types ([56942d9](https://github.com/mxsdev/ts-expand-type/commit/56942d927cbf86d3b54aa175f65add9afecdc4d3))
-   **vscode:** support partials in tree view ([2314e57](https://github.com/mxsdev/ts-expand-type/commit/2314e57583c26e60485d6535ec0c1776b2a80efa))
-   **vscode:** support template literal types ([36b4edf](https://github.com/mxsdev/ts-expand-type/commit/36b4edf24b761b59734029d9f1232d489e0c8e1a))
