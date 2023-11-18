---
title: Setup
description: Explaining initial setup
sidebar:
  order: 1
---

## Start from React template 

Here is a minimal project template with TypeScript, Vite, React and Reatom: [`reatom-react-ts`](https://artalar/reatom-react-ts/).

You can use [`degit`](https://github.com/rich-harris/degit) to quickly download it:

```sh
npx degit github:artalar/reatom-react-ts new-reatom-app
cd new-reatom-app
npm install
npm run dev
```

## Add Reatom to an existing project

Install [`@reatom/core`](https://www.reatom.dev/package/core/) if you are looking for a minimal and framework-agnostic state manager:

```sh
npm install @reatom/core
```

Or use [`@reatom/framework`](https://www.reatom.dev/package/framework/) which includes most of the Reatom ecosystem and is recommended for most applications.

For a guide on integration with a supported view framework, see the relevant adapter's docs:

- [React](https://reatom.dev/package/npm-react)
- [Svelte](https://reatom.dev/package/npm-svelte)
- [SolidJS](https://reatom.dev/package/npm-solid-js)

## ESLint

If you are using ESLint, see [`@reatom/eslint-plugin`](https://www.reatom.dev/package/eslint-plugin/) for a set of Reatom-specific rules.
