---
title: Reatom with eslint
description: How to use Reatom with ESlint
order: 3
---

## Reatom with ESlint

We recommend using the `@reatom/eslint-plugin`.  
This is optional, but greatly improves the development experience.
In addition to alerting you to possible errors, it can also fill in atom names using variable names

### Installation

```sh
npm i -D @reatom/eslint-plugin
```

### Usage

You should add @reatom to plugins and specify extends or rules into your config.

```json
{
  "plugins": ["@reatom"],
  "extends": ["plugin:@reatom/recommended"]
}
```

### Configuration

Example of customizing rules:

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

More examples you can found in [@reatom/eslint-plugin](/package/eslint-plugin/) package documentation