// @ts-check

/** @type {import('stylelint').Config} */
const config = {
    defaultSeverity: 'error',
    allowEmptyInput: true,
    extends: [
        'stylelint-config-recommended-scss',
        // should be last
        'stylelint-prettier/recommended'
    ],
    rules: {}
};

module.exports = config;
