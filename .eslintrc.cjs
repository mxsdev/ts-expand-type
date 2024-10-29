module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.eslint.json", "./packages/*/tsconfig.json"],
    },
    plugins: ["@typescript-eslint", "eslint-plugin-import"],
    ignorePatterns: [
        "tests/**",
        "**/out/**",
        "**/dist/**",
        ".eslintrc.cjs",
        "**/scripts/**/*.js",
        "**/.vscode-test/**",
        "packages/typescript-explorer-vscode/src/test/**",
        "scripts/**",
        "packages/api/tsup.config.ts",
    ],
    root: true,
    rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-duplicate-enum-values": "off",
        "@typescript-eslint/no-floating-promises": "off",
        "import/no-extraneous-dependencies": [
            "warn",
            {
                devDependencies: false,
            },
        ],
    },
}
