---
title: Headless UI models
description: Build accessible widgets with @reatom/ux — view-agnostic state and action factories you bind to any framework through plain prop records
---

`@reatom/ux` ports the behavior of accessible UI widgets — checkboxes, radios,
selects, comboboxes, tabs, toolbars, menus — into **headless models**: named
atoms, computeds, and actions with no React, Vue, Solid, or JSX coupling. You get
the keyboard handling, focus management, and ARIA contracts of a mature widget
library, expressed as Reatom state you can read, write, subscribe to, and test
like any other model.

The guiding idea is a strict separation of layers:

- **Layer 1 — the model.** A `reatom*` factory returns pure state and actions.
  It never touches the DOM.
- **Layer 2 — the DOM glue.** Optional extensions (`withCompositeFocus`, the
  `*Dom` factories) move real focus or read real elements when a model connects.
- **Layer 3 — the view.** Your framework spreads the model's **prop records**
  onto elements. `@reatom/jsx` uses `$spread`, React a plain spread, Vue
  `v-bind` — the model does not care which.

## The mental model

A model exposes state the usual Reatom way: a zero-argument call reads it, `.set`
writes it, and the model's actions run transitions.

```ts
import { reatomCheckbox } from '@reatom/ux'

const agree = reatomCheckbox({ name: 'agree' })

agree() // false — the current value
agree.toggle() // flip it through the model's action
agree.checked() // true — the derived tri-state flag
```

To render a model, take its **prop record** — a `computed` of a plain props
object, exposed as `model.props` — and spread it onto an element. The record
carries `checked`, `disabled`, the `aria-*` attributes, a `ref`, and the event
handlers, all kept in sync with the model.

```tsx
// @reatom/jsx
;<input $spread={agree.props.control} />
```

Because a prop record is just a `computed` returning an object, it is
framework-neutral by construction. Nothing in `@reatom/ux` imports a view
library.

## Controlled vs uncontrolled

Other libraries thread a `defaultValue` / `value` / `onChange` triad to decide
who owns a widget's state. In Reatom that question is already answered by atoms:
"controlled" simply means "someone else owns the atom". Pass a `valueAtom` and
the model reads and writes it instead of creating its own.

```ts
import { reatomForm } from '@reatom/core'
import { reatomCheckbox } from '@reatom/ux'

const form = reatomForm({ agree: false }, 'form')
const agree = reatomCheckbox({ valueAtom: form.fields.agree })
```

The shared atom might be a form field, a route search param, or an atom two
widgets read at once. There is no `store` prop and no event plumbing — an atom is
the entire contract.

## Groups and items

A model that holds several members exposes a memoized `item(value)` sub-model, so
a prop record keeps a stable identity across reads. Each item carries its own
`props` too.

```tsx
const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

fruits.item('apple').toggle()
fruits() // ['apple']

// each item renders from its own record
;<input $spread={fruits.item('apple').props.control} />
```

For a checkbox the `native` option decides whether the record targets a native
`<input type="checkbox">` (the default) or a custom element that needs `role`,
`tabIndex`, and keyboard handling.

## Composite widgets and focus

`radio`, `toolbar`, `tab`, `menu`, `select`, and `combobox` all build on
`composite` — the roving-tabindex navigation shared by APG widgets. The model
tracks the active item and answers arrow-key intents; moving **real DOM focus**
is a Layer 2 concern you opt into with `withCompositeFocus`.

```ts
import { reatomRadio, withCompositeFocus } from '@reatom/ux'

const plan = reatomRadio<'free' | 'pro'>({
  items: [
    { value: 'free', text: 'Free' },
    { value: 'pro', text: 'Pro' },
  ],
  name: 'plan',
})

// opt into DOM focus following the active item
plan.composite.extend(withCompositeFocus())
```

Keeping focus in Layer 2 is what lets the same model run in a unit test with no
DOM and in a browser with real focus, unchanged.

## Binding without a framework

Since a prop record is a plain object behind a `computed`, you can bind it by
hand — which is the clearest proof that the models carry no view dependency. A
tiny `spread` helper that assigns `ref`, attaches the `on*` handlers, and mirrors
the rest as attributes is enough to drive a real `<input>`. See the
[`reatom-ux-vanilla`](https://github.com/reatom/reatom/tree/v1001/examples/reatom-ux-vanilla)
example for a complete, no-framework page.

## Where to go next

- The [`@reatom/ux` package page](/package/ux) lists the factories and their
  options.
- [Atomization](/handbook/atomization) explains the naming and DTO patterns the
  models are built from.
- [Forms](/handbook/forms/introduction) pairs naturally with the controlled
  widgets above through a shared `valueAtom`.
