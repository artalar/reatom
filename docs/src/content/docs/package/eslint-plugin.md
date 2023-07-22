---
title: eslint-plugin
description: Reatom for eslint-plugin
---

## Installation

```sh
npm i -D @reatom/eslint-plugin
```

## Usage

You should add `@reatom` to `plugins` and specify `extends` or `rules` into your config.

```json
{
  "plugins": ["@reatom"],
  "extends": ["plugin:@reatom/recommended"]
}
```

```json
{
  "plugins": ["@reatom"],
  "rules": {
    "@reatom/atom-rule": "error",
    "@reatom/action-rule": "error",
    "@reatom/reatom-prefix-rule": "error",
    "@reatom/atom-postfix-rule": "error"
  }
}
```

Here is an example of React + TypeScript + Prettier config with Reatom.

> [Eslint setup commit](https://github.com/artalar/reatom-react-ts/commit/3632b01d6a58a35602d1c191e5d6b53a7717e747)

```json
{
  "env": {
    "browser": true,
    "es2022": true
  },
  "extends": [
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "standard-with-typescript",
    "plugin:@reatom/recommended",
    "plugin:prettier/recommended"
  ],
  "overrides": [],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "project": ["tsconfig.json"]
  },
  "plugins": ["react", "@reatom", "prettier"],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "off",
    "prettier/prettier": "error"
  },
  "settings": {
    "atomPostfix": "Atom"
  }
}
```
