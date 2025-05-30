// @ts-check

const kebabCasePattern = '^(_?[a-z][a-z0-9]*)(-[a-z0-9]+)*$';

const allowedPrefixes = [
    // default
    'kbq-',
    // for dev apps
    'dev-',
    // for ag-grid
    'ag-'
];

/** @type {import('stylelint').Config} */
const config = {
    defaultSeverity: 'error',
    allowEmptyInput: true,
    extends: [
        'stylelint-config-standard-scss',
        // should be last
        'stylelint-prettier/recommended'
    ],
    rules: {
        'max-nesting-depth': [2, { ignore: ['pseudo-classes'] }],
        'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['vertical', 'horizontal'] }],
        'selector-class-pattern': [
            `^_?(${allowedPrefixes.join('|')})`,
            {
                resolveNestedSelectors: true
            }
        ],

        // scss
        'scss/comment-no-loud': true,
        'scss/selector-no-union-class-name': true,
        'scss/at-mixin-pattern': [kebabCasePattern, { message: 'Expected @mixin name to be kebab-case.' }],
        'scss/at-use-no-unnamespaced': true,
        'scss/at-use-no-redundant-alias': true,
        'scss/no-unused-private-members': true,
        'scss/at-mixin-argumentless-call-parentheses': null
    }
};

module.exports = config;
