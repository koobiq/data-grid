// @ts-check

const isCI = !!process.env.CI;

/** @type {import('eslint').Linter.Config} */
const config = {
    root: true,
    env: {
        es2022: true,
        commonjs: true,
        node: true
    },
    plugins: ['file-progress'],
    extends: ['plugin:eslint-comments/recommended'],
    rules: {
        // plugin:file-progress
        'file-progress/activate': isCI ? 0 : 1,

        // plugin:eslint-comments
        'eslint-comments/no-unused-disable': 1
    },
    overrides: [
        {
            files: ['*.js', '*.ts'],
            extends: ['eslint:recommended'],
            rules: {}
        },
        {
            files: ['*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: __dirname
            },
            extends: [
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/stylistic',
                'plugin:@angular-eslint/recommended',
                'plugin:@angular-eslint/template/process-inline-templates'
            ],
            rules: {
                // plugin:@typescript-eslint
                '@typescript-eslint/consistent-type-definitions': [1, 'type'],
                '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],

                // plugin:@angular-eslint
                '@angular-eslint/component-class-suffix': 0,
                '@angular-eslint/directive-class-suffix': 0,
                '@angular-eslint/prefer-standalone': 1,
                '@angular-eslint/prefer-on-push-component-change-detection': 1
            }
        },
        {
            files: ['*.html'],
            extends: ['plugin:@angular-eslint/template/recommended', 'plugin:@angular-eslint/template/accessibility'],
            rules: {
                '@angular-eslint/template/prefer-self-closing-tags': 1,
                '@angular-eslint/template/prefer-control-flow': 1
            }
        },
        {
            files: ['*.js', '*.ts', '*.html'],
            extends: [
                // should be last
                'plugin:prettier/recommended'
            ]
        }
    ]
};

module.exports = config;
