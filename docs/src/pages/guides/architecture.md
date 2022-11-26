---
layout: ../../layouts/Layout.astro
title: Architecture
description: Main advices for code organization
---

The main reason for reactive programming is [reduce of code coupling](/general/what-is-state-manager). With that and [DCI](https://dci.github.io/introduction/) there are few simple recommendations of how to construct your application logic:

- one feature - one `model.js` file with all logic.
- export public atoms and actions, stay internal units in a scope.
- describe your atoms as your types, simple and clean. It is good to separate atom with object with a few properties to a few atoms.
- describe your actions, which handle main domain complexity. Separate complex task to several actions for a better debugging.
- in computed atom try to not use `ctx.schedule` by depending on other atom change, use [relative API](/packages/hooks) for that. Also, try to not handle other actions, as it have [some rules](/core#action-handling) and could increase complexity.
