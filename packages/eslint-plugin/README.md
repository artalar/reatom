# `@reatom/eslint-plugin`

Reatom-specific ESLint rules.

## Installation

```sh
npm i -D @reatom/eslint-plugin
```

## Usage

Add `@reatom` to `plugins` and specify `extends` or `rules` in your config.

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

> [ESLint setup commit](https://github.com/artalar/reatom-react-ts/commit/3632b01d6a58a35602d1c191e5d6b53a7717e747)

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

## Motivation

The primary purpose of this plugin is to automate generation of atom and action names using ESLint autofixes. Many have asked why not make a Babel plugin for naming, why keep it in source, here is our opinion:

- Build infrastructure is diverse and divergent - it's hard to support a plenty of tools used today;
- Plugin's output may be unexpected;
- Such plugin is hard to implement because of variety of naming strategies, especially in factories;

These are the problems we faced back in 2019 when the first version of Reatom was released. They made it clear for us that the game is not worth the candle.

On the contrary, explicit unit names have multiple advantages:

- No risk of unexpected plugin behaviour, full control over unit names;
- Requires no build infrastructure and is not that hard to do;
- Writing names is simplified even further by AI coding helpers (i.e. Copilot) and this set of ESLint rules.
