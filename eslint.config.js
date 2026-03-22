import { default as defaultConfig } from '@epic-web/config/eslint';
import unusedImports from 'eslint-plugin-unused-imports';

/** @type {import("eslint").Linter.Config} */
export default [
    {
        ignores: [
            'e2e/**',
            'dist/**',
            'node_modules/**',
            'build/**',
            'coverage/**',
            'playwright.config.ts',
            'charts/*/templates/*.yaml',
        ]
    },
    ...defaultConfig,
    {
        plugins: { 'unused-imports': unusedImports },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [ 'warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: true } ],
            'import/consistent-type-specifier-style': [ 'warn', 'prefer-top-level' ]
        }
    },
    {
        files: [ '**/tests/**/*.{ts,tsx}' ],
        rules: { 'react-hooks/rules-of-hooks': 'off' }
    },
];
