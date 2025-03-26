// @ts-check

/** @type {import('prettier').Options} */
const config = {
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'none',
    htmlWhitespaceSensitivity: 'ignore',
    overrides: [
        {
            files: ['*.yml'],
            options: {
                tabWidth: 2
            }
        }
    ],
    plugins: [
        // should be last
        'prettier-plugin-multiline-arrays'
    ]
};

module.exports = config;
