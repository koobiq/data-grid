// @ts-check

/** @type {import('prettier').Options} */
const config = {
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'none',
    htmlWhitespaceSensitivity: 'ignore',
    plugins: ['prettier-plugin-organize-imports'],
    overrides: [
        {
            files: ['*.yml'],
            options: {
                tabWidth: 2
            }
        },
        {
            files: ['*.ng.html'],
            options: {
                parser: 'angular'
            }
        }
    ]
};

module.exports = config;
