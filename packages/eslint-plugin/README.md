## Installation

```sh
npm i @reatom/eslint-plugin
```

## Usage

```ts
// .eslintrc.js
{
    ...,
    plugins: [
        "@reatom"
    ],
    ...
    // use all rules
    extends: [
        "plugin:@reatom/recommended"
    ],
    ...
    // or pick some
    rules: {
        '@reatom/atom-rule': 'error',
        '@reatom/action-rule': 'error',
        '@reatom/reatom-prefux-rule': 'error'
    }
}
```
