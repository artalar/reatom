# `@reatom/eslint-plugin`

Reatom-specific ESLint rules.

> NOTE: You are viewing documentation for an **EXPERIMENTAL** version! We recommend to use it, but we can't guarantee its stability, the rules and its behavior could be changed during minor updates. However, since this is only a DX package, things can't go too badly, so don't worry and have fun ;)

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
    "@reatom/async-rule": "error",
    "@reatom/unit-naming-rule": "error"
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

## Rules

### `unit-naming-rule`

Ensures that all Reatom entities specify the name parameter used for debugging. We assume that Reatom entity factories are `atom`, `action` and all `reatom*` (like `reatomAsync`) functions imported from `@reatom/*` packages.

The name must be equal to the name of a variable or a property an entity is assigned to, like this:

```ts
const count = atom(0, 'count')

const someNamespace = {
  count: atom(0, 'count'),
}
```

When creating atoms dynamically with factories, you can also specify the "namespace" of the name before the `.` symbol:

```ts
const reatomFood = (config: { name: string; calories: number; fat: number; carbs: number; protein: number }) => {
  const { name } = config.name
  const calories = atom(config.calories, `${name}.calories`)
  const fat = atom(config.fat, `${name}.fat`)
  const carbs = atom(config.carbs, `${name}.carbs`)
  const protein = atom(config.protein, `${name}.protein`)
  return { calories, fat, carbs, protein }
}
```

If there is an identifier `name` defined in the function scope, unit names must use it as namespace. Otherwise, namespace must be equal to the name of the factory function.

For private atoms, `_` prefix can be used:

```ts
const secretState = atom(0, '_secretState')
```

You can also ensure that `atom` names have a prefix or a postfix through the configuration, for example:

```ts
{
  atomPrefix: '',
  atomPostfix: 'Atom',
}
```

### `async-rule`

Ensures that asynchronous interactions within Reatom functions are wrapped with `ctx.schedule`. Read [the docs](https://www.reatom.dev/package/core/#ctx-api) for more info.

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
