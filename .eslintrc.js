// @ts-check

/**
 * @param {string} str
 * @returns {string}
 */
const capitalizeFirst = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * @see https://typescript-eslint.io/rules/naming-convention/#options
 *
 * @param {string | undefined} prefix
 */
const makeNamingConventionOptions = (prefix = undefined) => {
    /** @type {unknown[]} */
    const rules = [
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' },
        { selector: 'function', format: ['camelCase'] },
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'class', format: ['PascalCase'] },
        { selector: 'classMethod', format: ['camelCase'] },
        { selector: 'classProperty', format: ['camelCase', 'UPPER_CASE'], leadingUnderscore: 'allow' }
    ];

    if (prefix) {
        rules.push(
            {
                selector: 'variable',
                modifiers: ['exported'],
                format: ['StrictPascalCase', 'UPPER_CASE'],
                prefix: [prefix, `${prefix.toUpperCase()}_`]
            },
            { selector: 'function', modifiers: ['exported'], format: ['StrictPascalCase'], prefix: [prefix] },
            {
                selector: 'interface',
                modifiers: ['exported'],
                format: ['StrictPascalCase'],
                prefix: [capitalizeFirst(prefix)]
            },
            {
                selector: 'typeLike',
                modifiers: ['exported'],
                format: ['StrictPascalCase'],
                prefix: [capitalizeFirst(prefix)]
            },
            {
                selector: 'enum',
                modifiers: ['exported'],
                format: ['StrictPascalCase'],
                prefix: [capitalizeFirst(prefix)]
            },
            { selector: 'class', modifiers: ['exported'], format: ['PascalCase'], prefix: [capitalizeFirst(prefix)] }
        );
    }

    return rules;
};

/** @type {import('eslint').Linter.ConfigOverride} */
const jsAndTsRules = {
    files: ['*.js', '*.ts'],
    extends: ['eslint:recommended', 'plugin:promise/recommended'],
    rules: {
        // plugin:eslint
        'no-console': [1, { allow: ['debug', 'warn', 'error'] }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const tsRules = {
    files: ['*.ts'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname
    },
    extends: [
        /** @see https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/eslintrc/all.ts */
        'plugin:@typescript-eslint/all',
        'plugin:rxjs/recommended'
    ],
    rules: {
        // plugin:@typescript-eslint
        '@typescript-eslint/consistent-type-definitions': [1, 'type'],
        '@typescript-eslint/no-unused-vars': [1, { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-magic-numbers': 0,
        '@typescript-eslint/prefer-readonly-parameter-types': 0,
        '@typescript-eslint/explicit-member-accessibility': 0,
        '@typescript-eslint/no-confusing-void-expression': 0,
        '@typescript-eslint/consistent-type-imports': 0,
        '@typescript-eslint/naming-convention': [1, ...makeNamingConventionOptions()],
        '@typescript-eslint/member-ordering': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/strict-boolean-expressions': 0,
        '@typescript-eslint/no-extraneous-class': [1, { allowEmpty: true }],
        '@typescript-eslint/class-methods-use-this': 0
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ngTsRules = {
    files: ['*.ng.ts'],
    extends: [
        /** @see https://github.com/angular-eslint/angular-eslint/blob/main/packages/angular-eslint/src/configs/ts-all.ts */
        'plugin:@angular-eslint/all',
        'plugin:@angular-eslint/template/process-inline-templates'
    ],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/component-class-suffix': 0,
        '@angular-eslint/directive-class-suffix': 0,
        '@angular-eslint/component-max-inline-declarations': 0,
        '@angular-eslint/no-host-metadata-property': 0
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const tsDevRules = {
    files: ['dev/**/*.ts'],
    rules: {
        // plugin:@typescript-eslint
        '@typescript-eslint/naming-convention': [1, ...makeNamingConventionOptions('dev')]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ngTsDevRules = {
    files: ['dev/**/*.ng.ts'],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'dev', style: 'camelCase' }],
        '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'dev', style: 'kebab-case' }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const tsPackagesRules = {
    files: ['packages/**/*.ts'],
    rules: {
        // plugin:@typescript-eslint
        '@typescript-eslint/naming-convention': [1, ...makeNamingConventionOptions('kbq')]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ngTsPackagesRules = {
    files: ['packages/**/*.ng.ts'],
    rules: {
        // plugin:@angular-eslint
        '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'kbq', style: 'camelCase' }],
        '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'kbq', style: 'kebab-case' }]
    }
};

/** @type {import('eslint').Linter.ConfigOverride} */
const ngTemplateRules = {
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
const prettierRules = {
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
    extends: ['plugin:eslint-comments/recommended'],
    rules: {
        // plugin:eslint-comments
        'eslint-comments/no-unused-disable': 1
    },
    overrides: [
        jsAndTsRules,
        tsRules,
        ngTsRules,
        tsDevRules,
        ngTsDevRules,
        tsPackagesRules,
        ngTsPackagesRules,
        ngTemplateRules,
        // should be last
        prettierRules
    ]
};

module.exports = config;
