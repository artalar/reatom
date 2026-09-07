---
title: Field atom
description: Independent form fields with validation, focus, change, and reset — reatomField as a composable field model
---

In many form validation libraries, fields exist only within forms and their lifecycle is tied to the form's lifecycle, while access to fields is typically done through string dot notation, and field configuration has no single source of truth and can be spread across the entire application.

In Reatom, fields are independent entities with their own related states and methods that are fully open to configuration and composition. `reatomField` itself is a field state atom, to which other related states are assigned, such as `validation`, `focus` and others, as well as various methods like `change` and `reset`. Let's examine each aspect of `reatomField` in more detail to build a complete picture and reactive model in your head.

```ts
import { reatomField } from '@reatom/core'

const fieldAtom = reatomField(0, 'fieldAtom')

fieldAtom() // -> number
fieldAtom.value() // -> number
fieldAtom.focus() // -> { active: boolean, dirty: boolean, touched: boolean }
fieldAtom.validation() // -> { error: string | undefined, triggered: boolean }

fieldAtom.change(123)
fieldAtom.reset()
```

## State and value

The state is the key atom of the field, which `reatomField` returns as its value. Additionally, a `value` atom is attached to this atom, which is computed from the `state` atom (i.e., from the field's state itself). The key difference between `state` and `value` is their purpose - `state` undergoes validation and should contain the pure field value, which is the definitive value from a business logic perspective, while `value` is a derived value primarily intended for UI display.

A couple of examples illustrating the dichotomy between these states for better understanding:

- In a select component, `state` will contain the actual value of the selected element, while `value` will contain the element's text (i.e., its label)
- In a text field for selecting a birth date, the `state` will contain either a `Date` object or `null` if the value is invalid, while `value` will contain a string with arbitrary user input, which will be used for rendering in the text field. Thus, if the user enters a valid date, the `state` will receive a valid `Date`

To configure the `state -> value` transformation, you can define the `fromState` callback in the field creation options, and for the reverse transformation there is a `toState` callback.

```ts
const dateField = reatomField<Date | null, string>(null, {
  name: 'dateField',
  fromState: (state) => (state ? state.toString() : ''),
  toState: (value) => {
    if (!value) return null
    const date = new Date(value)
    return !isNaN(date.getTime()) ? date : null
  },
})
```

### `toState` abort

You can cancel state computation on `change` action call by throwing an abort error inside the callback. This is useful to make `state` and `value` independent of each other while preserving consistency when possible:

```ts
const numberField = reatomField(0, {
  fromState: (state) => state.toString(),
  toState: (value: string) => {
    const parsed = Number(value)
    return isNaN(parsed) ? throwAbort() : parsed
  },
})
```

For this atom, any `value` string will be valid, but `state` will only be changed once the `value` becomes transformable to `state`.

### `fromState` reactivity

Since the `fromState` transformer executes in the context of computing the `value` computed atom, it's possible to reactively use atoms inside it, which allows maintaining the field state more consistently by adding new dependencies to `value`:

```ts {5}
const dateMask = atom('MM.DD.YYYY', 'dateMask')

const dateField = reatomField<Date | null, string>(null {
  name: 'dateField',
  fromState: (state) => (state ? dayjs(state).format(dateMask()) : ''),
  toState: (value) => {
    if (!value) return null
    const date = dayjs(value, dateMask())
    return date.isValid() ? date.toDate() : null
  },
})

dateField.change('08.20.2024')
dateField.value() // -> '08.20.2024'

dateMask.set('DD.MM.YYYY')

dateField.value() // -> '20.08.2024'
```

As you can see, both `dateField` and `dateField.value` are now bound to the `dateMask` atom. This means that whenever the mask format changes, the field value automatically transforms to match the new format, keeping both states synchronized without any manual intervention.

### `initState` atom

This atom contains the initial field value that was passed as an argument to the `reatomField` constructor. This is a separate state against which the field's dirty status is calculated, and which will be set as the current value for the field after calling the field's `reset` method.

You can also modify this state using the `reset` method by passing an argument to it:

```ts
const usernameField = reatomField('later', 'usernameField')

const saveUsername = action(async (username: string) => {
  await wrap(syncUsername(username))
  usernameField.reset(username)
}, 'saveUsername').extend(withAsync())
```

## Focus atom

All states related to field interaction are stored here.

```ts
export interface FieldFocus {
  /** The field is focused. */
  active: boolean

  /** The field state is not equal to the initial state. */
  dirty: boolean

  /** The field has ever gained and lost focus. */
  touched: boolean
}
```

By combining these statuses you can derive additional meta information:

- `!touched && active` - the field got focus for the first time
- `touched && active` - the field got focus again

```ts
export interface FocusAtom extends AtomLike<FieldFocus> {
  /** Action for handling field focus. */
  in: Action<[], FieldFocus>

  /** Action for handling field blur. */
  out: Action<[], FieldFocus>
}
```

Without these methods, we cannot maintain the `focus` atom in a consistent state. In rendering frameworks, these actions should be used as `focus` and `blur` events, otherwise, in addition to the inconsistency of the `focus` atom, we may lose the ability to validate the field when focus is lost.

## Validation atom

This atom stores states related to field state validation. In addition to the validation error text of the field itself, it contains `triggered`, which always shows when validation was triggered and completed. But validation can also be asynchronous, so `validating` can contain a validation promise that will return a non-empty list of errors if validation fails.

```ts
export interface FieldValidation {
  /** Message of the first validation error, computed from errors atom */
  error: undefined | string

  /** The validation actuality status. */
  triggered: boolean

  /** The field async validation status. */
  validating: undefined | Promise<{ errors: FieldError[] }>
}
```

But these are read-only states and we cannot change them directly. Therefore, actions are provided that allow changing their state.
By mutating the `errors` atom, we can influence the computation of the `validation` atom's state, and this is especially pleasant because the `errors` atom is one of the basic `reatomArray` primitives, having convenient methods like `push`, `unshift` and others.

```ts
export interface ValidationAtom extends AtomLike<FieldValidation> {
  /** Action to trigger field validation. */
  trigger: Action<[], FieldValidation> & AbortExt

  /** Full list of all errors related to the field */
  errors: ArrayAtom<FieldError>

  /** Action to clear all errors by passed sources. */
  clearErrors: Action<[...sources: FieldErrorSource[]], FieldValidation>
}
```

The `trigger` action activates the field validation callback and returns the new state of the `validation` atom. It's worth noting that despite field validation being potentially asynchronous, the `trigger` action itself does not return a promise, but returns the `.validating` prop which will provide a promise in case of asynchronous validation:

```ts
const result = await field.validation.trigger().validating
```

## Validation and concurrency

Like all form fields in the world, a field can have validation rules defined. For `reatomField`, validation rules consist of two parts: field validity checking through the `validate` callback in form creation options and defining validation trigger conditions.
Speaking of the `validate` callback, it allows using both synchronous and asynchronous functions and even Standard Schema compatible validation schemas.

### Validation triggers

By default, validation does not happen automatically and is only called programmatically through the `field.validation.trigger()` action, but it's possible to configure validation triggers on certain events in the field creation options:

- `validateOnChange` - validation on value change
- `validateOnBlur` - validation on blur
- `validateOnConnect` - validation on connect (in other words, when "mounted")

### Validation callback

In any validation callback, you can either throw errors or return their message as string or a `FieldError` object, which allows setting arbitrary error sources and even metadata:

```ts
const usernameField = reatomField({
  validate: ({ state }) => {
    if (!state) return 'Username is required'

    if (state.length < 3) {
      return {
        message: 'Username is too short',
        source: 'validation',
        meta: { minLength: 3 },
      }
    }
  },
})
```

Also, since validation callback execution is an effect, the validation callback allows automatically tracking dependencies and re-calling itself when these dependencies change, just like all effects or computed values do. We call this [reactive validation](/handbook/forms/concepts/reactive-validation) and this pattern allows very elegant implementation of [dependent validation](/handbook/forms/recipes/dependent-validation)

### Async validation callback

The main feature of the async callback lies in concurrency handling. Each subsequent call of the async callback cancels the execution of the pending promise from the previous call. This opens up many possibilities, including implementing [debounce validation](/handbook/forms/recipes/async-validation-debounce)

### Combining both async and sync

Moreover, it's possible to combine both synchronous and asynchronous validation in one field and this won't color the validation function in case of synchronous validation:

```ts
const usernameField = reatomField({
  validate: ({ state }) => {
    if (!state) return 'Username is required' // `validation` atom will receive error synchronously

    const checkUsernameIsFree = async () => {
      const response = wrap(
        await fetch(`/api/check-username?username=${state}`),
      )
      const data = await wrap(response.json())
      return !!data
    }

    // `validation` atom won't receive error synchronously,
    // but validation promise will be available in `.validating`
    return checkUsernameIsFree()
  },
})
```

When combining synchronous and asynchronous validations, pay attention to the function's return type. The callback itself should never be asynchronous, but should return some promise in some of the validation code execution branches

### Standard schema

Using such schemas is quite straightforward, you just need to pass a standard-compatible object there. The nicest thing here is that even in asynchronous validation schemas, Reatom will resolve concurrency by interrupting async function execution at `wrap` call sites.

:::caution[Zod implementation caution]
You cannot throw errors in `.refine` <a href="https://zod.dev/api?id=refine" target="_blank">according to documentation</a> and the throwed error will not be propagated to the `reatomField` internals so we need a bunch of boilerplate to handle this.
:::

```ts
const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .superRefine(async (value, { addIssue }) => {
    try {
      const response = await wrap(
        fetch(`/api/check-username?username=${value}`),
      )
      const data = await wrap(response.json())
      if (!data) {
        addIssue({
          code: 'custom',
          message: 'Username is already taken',
        })
      }
    } catch (error) {
      if (!isAbort(error)) {
        addIssue({
          code: 'custom',
          message: 'Error checking username',
        })
      }
    }
  })

const usernameField = reatomField({
  validate: usernameSchema,
})
```

You can easily use standard schemas conditionally too:

```ts
const usernameField = reatomField({
  validate: async ({ focus }) => (focus.touched ? usernameSchema : undefined),
})
```

### Error sources

Any validation error in forms has a property `source`, which indicates what caused the validation error. By default, any errors that occurred during field validation through the `validate` option will receive the value `validation` as the `source`. Also, errors can appear in the field whose `source` value will be `schema`, in case the error occurred during validation by the schema from the [form](/handbook/forms/concepts/form/) that contains this field. Otherwise, nothing prevents you from using any other values as `source` if necessary

## Disabling fields

When fields are disabled, their validation stops being triggered and they are [excluded from the validation and focus process of `reatomFieldSet`](/handbook/forms/concepts/fieldset/#fieldslist-and-fieldarrayslist). Additionally, when the field is properly bound to a DOM or other input (i.e., through the `bindField` method), the associated element also becomes disabled at the UI level.

Nothing prevents you from adding external reactive dependencies to the field's disabled state if your form logic requires it:

```ts
const cartPrice = computed(
  () => products().reduce((sum, p) => sum + p.price, 0),
  'cartPrice',
)

const promoCodeField = reatomField<number | null>(null, 'promoCodeField')
promoCodeField.disabled.extend(withComputed(() => cartPrice() < 100))
```

## Managing input element references

Each field has its own associated `elementRef` atom, which contains a reference to the corresponding field element. This can be either a DOM element or any other element depending on the environment in which the field operates.

```ts
const usernameField = reatomField('', {
  elementRef: document.querySelector('#username'),
})
```

However, the approach with a default `elementRef` value is only suitable when the DOM element is already created and known at the time of field creation. A much more common case is when the element is assigned upon the creation of the corresponding component:

```tsx
<input
  placeholder="Username"
  {...bindField(usernameField)} // <- automatically binds elementRef
/>
```

## `withField` extension

This extension is a convenient way to make any atom as a form field without losing its original properties

```ts
const priorityField = reatomEnum(
  ['unset', 'low', 'high'],
  'priorityField',
).extend(
  withField({
    validate: ({ state }) =>
      state === 'unset' ? 'Priority is required' : undefined,
  }),
)

// These actions are still available:
priorityField.setLow()
priorityField.setHigh()
priorityField.setUnset()
```
