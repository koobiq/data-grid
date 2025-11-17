module.exports = {
    '*': 'prettier --write --ignore-unknown',
    '*.{js,ts,html}': 'eslint --max-warnings=0 --fix',
    '*.{css,scss}': 'stylelint --max-warnings=0 --fix'
};
