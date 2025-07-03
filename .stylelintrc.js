// @ts-check

const kebabCasePattern = '^(_?[a-z][a-z0-9]*)(-[a-z0-9]+)*$';

/**
 * @see https://stylelint.io/user-guide/rules/selector-class-pattern
 *
 * @param {string[]} prefixes
 */
const makeSelectorClassPatternOptions = (prefixes = []) => {
    const allowedPrefixes = [
        // default
        'kbq-',
        // for ag-grid
        'ag-'
    ];

    return [
        `^_?(${allowedPrefixes.concat(prefixes).join('|')})`,
        {
            resolveNestedSelectors: true
        }
    ];
};

/** @type {import('stylelint').Config['overrides']} */
const packagesRules = [
    {
        files: ['packages/**/*.scss', 'packages/**/*.css'],
        rules: {
            'selector-class-pattern': makeSelectorClassPatternOptions([])
        }
    }
];

/** @type {import('stylelint').Config['overrides']} */
const devRules = [
    {
        files: ['dev/**/*.scss', 'dev/**/*.css'],
        rules: {
            'selector-class-pattern': makeSelectorClassPatternOptions(['dev-'])
        }
    }
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
        'selector-class-pattern': makeSelectorClassPatternOptions(),

        // scss
        'scss/comment-no-loud': true,
        'scss/selector-no-union-class-name': true,
        'scss/at-mixin-pattern': [kebabCasePattern, { message: 'Expected @mixin name to be kebab-case.' }],
        'scss/at-use-no-unnamespaced': true,
        'scss/at-use-no-redundant-alias': true,
        'scss/no-unused-private-members': true,
        'scss/at-mixin-argumentless-call-parentheses': null
    },
    overrides: [...packagesRules, ...devRules]
};

module.exports = config;
