'use strict'

module.exports = {
  parserOptions: {
    ecmaVersion: 'latest',
  },
  root: true,
  extends: ['eslint:recommended', 'plugin:eslint-plugin/recommended', 'plugin:node/recommended'],
  env: {
    es6: true,
  },
}
