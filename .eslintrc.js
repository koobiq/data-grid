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
    extends: ['plugin:@typescript-eslint/all'],
    rules: {
        // plugin:@typescript-eslint
        '@typescript-eslint/consistent-type-definitions': [1, 'type'],
        '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-magic-numbers': 0,
        '@typescript-eslint/prefer-readonly-parameter-types': 0,
        '@typescript-eslint/explicit-member-accessibility': 0,
        '@typescript-eslint/no-confusing-void-expression': 0,
        '@typescript-eslint/consistent-type-imports': 0,
        '@typescript-eslint/naming-convention': [
            1,
            {
                selector: 'variable',
                format: ['camelCase', 'UPPER_CASE'],
                leadingUnderscore: 'allow'
            },
            {
                selector: 'function',
                format: ['camelCase']
            },
            {
                selector: 'interface',
                format: ['PascalCase']
            },
            {
                selector: 'typeLike',
                format: ['PascalCase'],
                leadingUnderscore: 'allow'
            },
            {
                selector: 'enum',
                format: ['PascalCase']
            },
            {
                selector: 'enumMember',
                format: ['PascalCase']
            },
            {
                selector: 'class',
                format: ['PascalCase']
            },
            {
                selector: 'classMethod',
                format: ['camelCase']
            },
            {
                selector: 'classProperty',
                format: ['camelCase', 'UPPER_CASE']
            }
        ],
        '@typescript-eslint/member-ordering': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/strict-boolean-expressions': 0,
        '@typescript-eslint/no-extraneous-class': [1, { allowEmpty: true }],
        '@typescript-eslint/class-methods-use-this': 0
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
