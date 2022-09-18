---
layout: ../layouts/Layout.astro
title: Codestyle
description: List of naming conventions and recommendations about codestyle with Reatom development
---

## Fabric naming

If you want to describe a fabric which returns an atom or an action or a set of atoms and / or actions use `reatom` prefix, like `reatomArray: <T>() => atom<Array<T>>` or `reatomEffect: <T>(cb: () => Promise<T>) => Action<[], Promise<T>>`
