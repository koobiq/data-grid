// @ts-check

const isCI = !!process.env.CI;

/** @type {import('eslint').Linter.ConfigOverride} */
const JS_AND_TS = {
    files: ['*.js', '*.ts'],
    extends: ['eslint:recommended'],
    rules: {}
};

/** @type {import('eslint').Linter.ConfigOverride} */
const TS = {
    files: ['*.ts'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname
    },
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/stylistic'],
    rules: {
        // plugin:@typescript-eslint
        '@typescript-eslint/consistent-type-definitions': [1, 'type'],
        '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ANGULAR = {
    files: ['*.ng.ts'],
    extends: ['plugin:@angular-eslint/all', 'plugin:@angular-eslint/template/process-inline-templates'],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/component-class-suffix': 0,
        '@angular-eslint/directive-class-suffix': 0,
        '@angular-eslint/component-max-inline-declarations': 0,
        '@angular-eslint/no-host-metadata-property': 0
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ANGULAR_DEV = {
    files: ['dev/**/*.ng.ts'],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'dev', style: 'camelCase' }],
        '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'dev', style: 'kebab-case' }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ANGULAR_PACKAGES = {
    files: ['packages/**/*.ng.ts'],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'kbq', style: 'camelCase' }],
        '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'kbq', style: 'kebab-case' }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ANGULAR_TEMPLATE = {
    // @TODO should add *.ng.html suffix
    files: ['*.html'],
    extends: ['plugin:@angular-eslint/template/all'],
    rules: {
        '@angular-eslint/template/i18n': 0,
        '@angular-eslint/template/no-call-expression': 0,
        '@angular-eslint/template/prefer-ngsrc': 0
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const PRETTIER = {
    files: ['*.js', '*.ts', '*.html'],
    extends: ['plugin:prettier/recommended']
};

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
        JS_AND_TS,
        TS,
        ANGULAR,
        ANGULAR_DEV,
        ANGULAR_PACKAGES,
        ANGULAR_TEMPLATE,
        // should be last
        PRETTIER
    ]
};

module.exports = config;
