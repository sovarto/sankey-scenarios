import { default as defaultConfig } from '@epic-web/config/eslint';
import unusedImports from 'eslint-plugin-unused-imports';

/** @type {import("eslint").Linter.Config} */
export default [
    {
        ignores: [
            '**/public/81154fe671a4aba847c8ceba274446a1.js',
            '**/public/c35b65af6999133003842d58a5337ca3.js',
            '**/app/common/assets/cookiescript/*',
        ]
    },
    ...defaultConfig,
    {
        plugins: { 'unused-imports': unusedImports },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': [ 'warn', { vars: 'all', args: 'after-used', ignoreRestSiblings: true } ]
        }
    },
    {
        files: [ '**/tests/**/*.{ts,tsx}' ],
        rules: { 'react-hooks/rules-of-hooks': 'off' }
    },
];
