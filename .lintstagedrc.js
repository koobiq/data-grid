module.exports = {
    '*': 'prettier --write --ignore-unknown',
    '*.{js,cjs,ts,html}': 'eslint --max-warnings=0 --no-warn-ignored --fix',
    '*.{css,scss}': 'stylelint --max-warnings=0 --fix'
};
