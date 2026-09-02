import eslintComments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import angular from 'angular-eslint';
import type { Linter } from 'eslint';
import jest from 'eslint-plugin-jest';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-plugin-prettier/recommended';
import promise from 'eslint-plugin-promise';
import rxjs from 'eslint-plugin-rxjs-x';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const capitalizeFirst = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1);

/** @see https://typescript-eslint.io/rules/naming-convention/#options */
type NamingConventionOption = {
    selector: string;
    format: string[];
    modifiers?: string[];
    prefix?: string[];
    leadingUnderscore?: 'allow';
};

const makeNamingConventionOptions = (prefix?: string): NamingConventionOption[] => {
    const rules: NamingConventionOption[] = [
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

export default defineConfig([
    {
        name: 'kbq/ignores',
        ignores: ['dist', 'node_modules', 'tmp', '.angular', '.nx', '.yarn', 'playwright-report', '**/index.html']
    },
    {
        name: 'kbq/js-and-ts',
        files: ['**/*.js', '**/*.cjs', '**/*.ts'],
        extends: [js.configs.recommended, promise.configs['flat/recommended']],
        languageOptions: {
            globals: { ...globals.node, ...globals.commonjs, ...globals.es2022 }
        },
        rules: {
            // plugin:eslint
            'no-console': [1, { allow: ['debug', 'warn', 'error'] }]
        }
    },
    {
        name: 'kbq/js',
        files: ['**/*.js', '**/*.cjs'],
        languageOptions: { sourceType: 'commonjs' }
    },
    {
        name: 'kbq/tools',
        files: ['tools/**/*.js', 'tools/**/*.cjs'],
        rules: {
            // plugin:eslint
            // CLI scripts report their progress to stdout
            'no-console': 0
        }
    },
    {
        name: 'kbq/eslint-comments',
        extends: [eslintComments.recommended],
        rules: {
            // plugin:eslint-comments
            '@eslint-community/eslint-comments/no-unused-disable': 1
        }
    },
    {
        name: 'kbq/ts',
        files: ['**/*.ts'],
        extends: [
            /** @see https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/flat/all.ts */
            tseslint.configs.all,
            rxjs.configs.recommended
        ],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname
            }
        },
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
    },
    {
        name: 'kbq/ng-ts',
        files: ['**/*.ng.ts'],
        extends: [
            /** @see https://github.com/angular-eslint/angular-eslint/blob/main/packages/angular-eslint/src/configs/ts-all.ts */
            // angular-eslint 18 types its flat configs with `@typescript-eslint/utils`,
            // whose `LanguageOptions` is not assignable to the one `defineConfig()` expects
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            angular.configs.tsAll as Linter.Config[]
        ],
        processor: angular.processInlineTemplates,
        rules: {
            // plugin:@angular-eslint
            '@angular-eslint/component-class-suffix': 0,
            '@angular-eslint/directive-class-suffix': 0,
            '@angular-eslint/component-max-inline-declarations': 0,
            '@angular-eslint/no-host-metadata-property': 0,
            '@angular-eslint/no-input-rename': 0,
            '@angular-eslint/no-output-rename': 0
        }
    },
    {
        name: 'kbq/ts-dev',
        files: ['dev/**/*.ts'],
        rules: {
            // plugin:@typescript-eslint
            '@typescript-eslint/naming-convention': [1, ...makeNamingConventionOptions('dev')]
        }
    },
    {
        name: 'kbq/ng-ts-dev',
        files: ['dev/**/*.ng.ts'],
        rules: {
            // plugin:@angular-eslint
            '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'dev', style: 'camelCase' }],
            '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'dev', style: 'kebab-case' }]
        }
    },
    {
        name: 'kbq/ts-packages',
        files: ['packages/**/*.ts'],
        rules: {
            // plugin:@typescript-eslint
            '@typescript-eslint/naming-convention': [1, ...makeNamingConventionOptions('kbq')]
        }
    },
    {
        name: 'kbq/ng-ts-packages',
        files: ['packages/**/*.ng.ts'],
        rules: {
            // plugin:@angular-eslint
            '@angular-eslint/directive-selector': [1, { type: 'attribute', prefix: 'kbq', style: 'camelCase' }],
            '@angular-eslint/component-selector': [1, { type: 'element', prefix: 'kbq', style: 'kebab-case' }]
        }
    },
    {
        // @TODO should add *.ng.html suffix
        name: 'kbq/ng-template',
        files: ['**/*.html'],
        extends: [
            /** @see https://github.com/angular-eslint/angular-eslint/blob/main/packages/angular-eslint/src/configs/template-all.ts */
            // angular-eslint 18 types its flat configs with `@typescript-eslint/utils`,
            // whose `LanguageOptions` is not assignable to the one `defineConfig()` expects
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            angular.configs.templateAll as Linter.Config[]
        ],
        rules: {
            '@angular-eslint/template/i18n': 0,
            '@angular-eslint/template/no-call-expression': 0,
            '@angular-eslint/template/prefer-ngsrc': 0,
            '@angular-eslint/template/click-events-have-key-events': 0,
            '@angular-eslint/template/interactive-supports-focus': 0
        }
    },
    {
        name: 'kbq/playwright',
        files: ['**/*.playwright-spec.ts'],
        extends: [playwright.configs['flat/recommended']],
        rules: {
            'playwright/expect-expect': [
                'warn',
                { assertFunctionNames: ['expect', 'expectFilterValue', 'waitForRowSelected'] }
            ]
        }
    },
    {
        name: 'kbq/jest',
        files: ['**/*.spec.ts'],
        extends: [jest.configs['flat/recommended']]
    },
    {
        // should be last
        name: 'kbq/prettier',
        files: ['**/*.js', '**/*.cjs', '**/*.ts', '**/*.html'],
        extends: [prettier]
    }
]);
