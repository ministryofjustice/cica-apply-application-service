'use strict';

/*! m0-start */
const config = {
    extends: ['airbnb-base', 'prettier', 'plugin:jest/recommended'],
    env: {
        node: true
    },
    // overwrite airbnb-base to use commonjs instead of ES6 modules
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'script',
        ecmaFeatures: {
            modules: false,
            classes: false
        }
    },
    rules: {
        'prettier/prettier': ['error'],
        'linebreak-style': ['error', process.platform === 'win32' ? 'windows' : 'unix'],
        curly: ['error', 'all'],
        'jest/expect-expect': ['error'],
        // https://github.com/eslint/eslint/issues/8953#issuecomment-317697474
        strict: ['error', 'safe'],
        'import/extensions': ['off'],
        'no-inner-declarations': ['off'],
        'fp/no-class': 'error'
    },
    plugins: ['prettier', 'fp']
};
/*! m0-end */

config.rules['no-param-reassign'] = ['error', {props: false}];

/*! m0-start */
module.exports = config;
/*! m0-end */
