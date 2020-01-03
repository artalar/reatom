# File Structure

Reatom does not dictate the organization of the file system. In this guide we are just trying to help those who can not decide how and where to store the code.

From this guide you will learn:

- where to store atoms
- where to store actions
- where to store types (if you using it)

## Single file organization

In most cases, you can store atoms and actions in a single file. Don't be afraid to store actions and atoms in one file. This is not an antipattern.

Reatom guarantees unique identifiers for entities, so you won't have conflicts with another model.

## Multi file organization

When there is a lot of code in a file, you can split your module into several. Each of which has its own function.

The need for partitioning may be necessary in the case of TypeScript to reduce the number of lines of code in file.

```sh
model
├── actions.ts
├── atoms.ts
├── index.ts
├── types.ts
└── service.ts
```

```js
// model/index.ts

export * from './actions'
export * from './atoms'
export * from './types'
export * from './service'
```

> **NOTE.** `service.ts` stores asynchronous actions. Due to the fact that in them use atoms and actions, then may be cyclic dependencies. For this reason, this code is better to take out of `actions.ts`.

> **NOTE.** We recommend you to import the entities from the index model. Via `index.ts` we make public API to the model.

## Feature slices

In a large application is convenient to use atomic design / feature slices an approach for grouping entities by meaning.

```sh
src
├── features
│   ├── auth
│   │   ├── model
│   │   └── ui
│   └── todoapp
│       ├── model
│       └── ui
└── model
```

Each feature contains `model` and `ui`.
Model stored all atoms and actions for this feature.
Ui contains all components worked with this model.

In root level in `src/model` stored global actions and atoms shared between all features
