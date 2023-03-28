---
layout: ../../layouts/Layout.astro
title: eslint-plugin
description: Reatom for eslint-plugin
---

## Installation

```sh
npm i @reatom/eslint-plugin
```

## Usage

```ts
// .eslintrc.js
{
    plugins: [
        "@reatom"
    ],
    // use all rules
    extends: [
        "plugin:@reatom/recommended"
    ],
    // or pick some
    rules: {
        '@reatom/atom-rule': 'error',
        '@reatom/action-rule': 'error',
        '@reatom/reatom-prefix-rule': 'error'
    }
}
```
