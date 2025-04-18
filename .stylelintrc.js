// @ts-check

const KEBAB_CASE_PATTERN = '^_?[a-z0-9]+(-[a-z0-9]+)*$';

/** @type {import('stylelint').Config} */
const config = {
    defaultSeverity: 'error',
    allowEmptyInput: true,
    extends: [
        'stylelint-config-recommended-scss',
        // should be last
        'stylelint-prettier/recommended'
    ],
    rules: {
        'rule-empty-line-before': [
            'always-multi-line',
            {
                except: ['first-nested'],
                ignore: ['after-comment']
            }
        ],
        'max-nesting-depth': [2, { ignore: ['pseudo-classes'] }],
        'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['vertical', 'horizontal'] }],

        // scss
        'scss/comment-no-loud': true,
        'scss/selector-no-union-class-name': true,
        'scss/at-mixin-pattern': [KEBAB_CASE_PATTERN, { message: 'Expected @mixin name to be kebab-case.' }],
        'scss/at-use-no-unnamespaced': true,
        'scss/at-use-no-redundant-alias': true,
        'scss/no-unused-private-members': true
    }
};

module.exports = config;
