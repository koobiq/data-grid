module.exports = {
    '*.{css,scss,md,yml,json,js,ts,html}': 'prettier --write',
    '*.{js,ts,html}': 'eslint --max-warnings=0 --fix',
    '*.{css,scss}': 'stylelint --max-warnings=0 --fix'
};
