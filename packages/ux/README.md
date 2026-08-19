# `@reatom/ux`

Headless UI behavior models for Reatom — view-library-agnostic state and action
factories inspired by [Ariakit](https://github.com/ariakit/ariakit) and informed
by [`@chromvoid/headless-ui`](https://github.com/chromvoid/headless-ui).

Models are created during DTO atomization: named atoms, actions, and computeds
with no React/Vue/Solid/JSX coupling. Bind them later with `bindField`-style
helpers, `$spread` in `@reatom/jsx`, or any other adapter.

> Ariakit store inventory is ported (see [`PORTING_STATUS.md`](PORTING_STATUS.md)).
> Package remains `private` pending handbook docs and examples. Port template:
> [`PORTING_PLAN.md`](PORTING_PLAN.md).

## Installation

```sh
npm install @reatom/ux @reatom/core
```

## Mental model

A `reatom*` factory returns a **model**: named atoms, computeds, and actions with
no view coupling. Read state with a zero-argument call, write it with `.set`, and
run transitions through the model's actions.

```ts
import { reatomCheckbox } from '@reatom/ux'

const agree = reatomCheckbox({ name: 'agree' })

agree() // false — the current value
agree.toggle() // flip it through the model's action
agree.checked() // true — the tri-state flag, derived
```

A model never touches the DOM. To render one, take its **prop record** — a
`computed` of a plain props object exposed as `model.props` — and spread it onto
an element. `@reatom/jsx` does this with `$spread`, React with a plain spread,
Vue with `v-bind`.

```tsx
import { reatomCheckbox } from '@reatom/ux'

const agree = reatomCheckbox({ name: 'agree' })

// @reatom/jsx
;<input $spread={agree.props.control} />
```

Group items carry their own record too, at `item(value).props`.

```tsx
const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
;<input $spread={fruits.item('apple').props.control} />
```

The `native` model option decides whether the record targets a native
`<input type="checkbox">` (the default) or a custom element with `role` and
keyboard handling. When one model needs both bindings at once, build an extra
record with the standalone `checkboxProps(model, options)`.

The record carries `checked`, `disabled`, the `aria-*` attributes, a `ref`, and
the event handlers, all kept in sync with the model.

## Controlled vs uncontrolled

"Controlled" in Reatom is just "someone else owns the atom". Pass a `valueAtom`
and the model reads and writes it instead of creating its own — a form field, a
route search param, or an atom shared between two widgets.

```ts
import { reatomForm } from '@reatom/core'
import { reatomCheckbox } from '@reatom/ux'

const form = reatomForm({ agree: false }, 'form')
const agree = reatomCheckbox({ valueAtom: form.fields.agree })
```

There is no `defaultValue` / `value` / `onChange` triad and no `store` prop: an
atom is the entire contract.

## Groups and items

A model that holds several members exposes a memoized `item(value)` sub-model, so
a prop record keeps a stable identity across reads.

```ts
const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

fruits.item('apple').toggle()
fruits() // ['apple']
fruits.item('orange').checked() // false
```

Composite widgets (`radio`, `toolbar`, `tab`, `menu`, `select`, `combobox`) share
the roving-tabindex navigation of `composite`. Move real DOM focus with
`withCompositeFocus`.

```ts
import { reatomRadio, withCompositeFocus } from '@reatom/ux'

const plan = reatomRadio<'free' | 'pro'>({
  items: [
    { value: 'free', text: 'Free' },
    { value: 'pro', text: 'Pro' },
  ],
  name: 'plan',
})
plan.composite.extend(withCompositeFocus())
```

## Attribution

Behavior, accessibility invariants, and DOM quirk knowledge are ported from
[Ariakit](https://github.com/ariakit/ariakit) (MIT, © Ariakit FZ-LLC / Diego Haz
and contributors). Reatom-first modeling ideas and APG contract patterns are
noted from [`@chromvoid/headless-ui`](https://github.com/chromvoid/headless-ui)
(MIT, © Chromvoid contributors). Full respect to both projects and their authors.
