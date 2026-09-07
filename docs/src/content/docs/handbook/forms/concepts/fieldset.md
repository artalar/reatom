---
title: Fieldset
description: Group related fields with reatomFieldSet — shared validation, focus, and aggregate state
---

Field sets allow you to group related fields together and manage them as a single unit. This is an 80% of `reatomForm` functionality since `reatomForm` is fully based on top of `reatomFieldSet`. This is also useful for organizing complex forms into logical sections such as [wizard (multi-step) forms](/handbook/forms/recipes/wizard-forms), [compound fields](/handbook/forms/recipes/compound-fields), or for tracking the combined state of multiple fields without creating a full form.

## Initialization

When creating a fieldset, you can initialize fields in several ways:

### Primitive values

By passing a primitive value, you implicitly initialize a `reatomField` with that value as its default.
This way is suitable when no individual options are needed for the field.

```ts
const fieldSet = reatomFieldSet(
  {
    username: '', // String field
    age: 25, // Number field
    isActive: true, // Boolean field
    birthDate: new Date(), // Date field
  },
  'fieldSet',
)
```

### Existing `reatomField` instances

You are free to attach existing fields to the field set. However, note that in this case, the fields will not receive naming scoped to the field set domain.

```ts
const usernameField = reatomField('', 'usernameField').extend(
  withLocalStorage(),
)
const ageField = reatomField(25, 'ageField')

const fieldSet = reatomFieldSet(
  {
    username: usernameField,
    age: ageField,
  },
  'fieldSet',
)
```

For better debugging experience, it is recommended to initialize fields directly within the field set's initialization tree, initializing the name similar to how it is done in model factories.
For this purpose, the field set's `initState` accepts a callback with the `name` parameter:

```ts
const fieldSet = reatomFieldSet(
  (name) => ({
    username: reatomField('', `${name}.username`).extend(withLocalStorage()),
    age: reatomField(25, `${name}.age`),
  }),
  'fieldSet',
)
```

Mind that you can also pass regular atoms extended by `withField` since they are full-fledged `reatomField` instances.

```ts
const form = reatomFieldSet(
  (name) => ({
    active: reatomBoolean(false, `${name}.active`).extend(withField()),
  }),
  'fieldSet',
)
```

### ~~Field options object~~

:::caution
**Deprecated**. This legacy method of field initialization will be removed in the future major release due to type inference bugs and complexity. Use direct `reatomField` or `reatomFieldArray` definitions instead
:::

By passing an object with `initState` property, you can initialize a `reatomField`/`reatomFieldArray` with a value as its default, and pass additional options for the field.

```ts
const form = reatomForm(
  {
    username: {
      initState: '',
      validateOnChange: true,
      validate: ({ state }) => (state.length < 3 ? 'too short' : undefined),
    },
    age: {
      initState: 25,
      validateOnBlur: true,
    },
  },
  'form',
)

form.username // <- FieldAtom<string, string>
form.age // <- FieldAtom<number, number>
```

## Aggregate Atoms

`reatomFieldSet` itself returns a computed atom that structurally contains all current values of the fields belonging to the field set.

```ts
form() // <- { username: string, age: number }
```

The fact that an atom is returned allows us to extend the field set with new behavior through the [extension system](/handbook/extensions/) by calling `.extend`

Field sets also create special `validation` and `focus` atoms, which are computed from all nested fields.

### `focus` atom

An aggregate of all `focus` atoms of all fields in the field set. If at least one field in the field set is `dirty`/`touched`/`active`, then the field set will also be considered `dirty`/`touched`/`active`.

### `validation` atom

```ts
export interface FieldSetFieldError extends FieldError {
  field: FieldAtom
}

export interface FieldSetValidation {
  errors: FieldSetFieldError[]
  triggered: boolean
  validating: undefined | Promise<{ errors: FieldSetFieldError[] }>
}
```

The behavior of the `validation` atom of a field set is slightly more complex due to validation mechanics.

1. **A field set is considered `triggered` if ALL fields in it have been `triggered`**. Therefore, you need to be careful if you tie the disabling of a form's submit button to the `triggered` state of the field set: the button may be disabled even if all required fields in the form have already been filled, because some optional field may remain untouched, and therefore validation for such a field will not be `triggered`
   > Some experts consider disabling submit buttons an <a href="https://gomakethings.com/dont-disable-buttons/" target="_blank">anti-pattern</a>
2. In the `errors` state, as expected, all errors from all fields are accumulated, but with a reference to the field in which the error occurred
3. If at least one field of the field set is in the process of asynchronous validation, **then `validating` will store a `Promise`** that will wait for the completion of all asynchronous validations. The result will return a list of all errors as in the `errors` state

Just like with a regular field, this atom has a `trigger` action assigned to it, which sequentially calls `trigger` on all fields in the field set

### Behavior with disabled fields

When fields are disabled, they no longer automatically trigger their own validation. In field sets, these disabled fields are excluded from the `validation` and `focus` computations, meaning they are not considered in the validation process according to the schema/etc. This ensures that disabled fields do not affect the validation status of the form or field set they belong to.

### `fieldsList` and `fieldArraysList`

These computed atoms contain a flat list of all `reatomField` and `reatomFieldArray` instances in the field set. Their size can change if dynamic field lists (`reatomFieldArray`) change their number of fields.

They serve as the foundation for the `validation` and `focus` atoms described above, and can be the basis for your own aggregates, or if you want to implement the [auto focus on error pattern](/handbook/forms/recipes/focus-management/)

### `init` action

Like in a regular `reatomField`, you can bulk update the `initState` of all fields in the field set by passing a nested structure of new initial field values.

```ts
registerForm.init({
  username: 'newUsername',
  email: 'newEmail',
})
```

This will not affect the visible state of the fields, but will affect what value they receive when the `reset` action is called

### `reset` action

This is the same as the `reset` method in `reatomField`, but for a field set. It will reset all fields in the field set to their initial values, and can also set initial values for them if you pass a structure of new initial field values like in the `init` action:

```ts
registerForm.reset({
  username: 'newUsername',
  email: 'newEmail',
})
```

## Field Sets as Lenses

> This section is directly related to the main primitive [`reatomForm`](/handbook/forms/concepts/form). If you are not yet familiar with this API, it is recommended to familiarize yourself with it before studying this section.

One of the most useful properties, besides the fact that field sets allow you to create independent fragments of full-fledged forms consisting of groups of fields with their own separate isolated logic, is that **field sets can be used as lenses**.

Let's assume we have the following form:

```ts
import { reatomForm, reatomFieldSet } from '@reatom/core'
import { z } from 'zod'

const checkoutForm = reatomForm(
  {
    personal: { firstName: '', lastName: '', email: '' },
    shipping: { address: '', city: '', zipCode: '' },
  },
  {
    name: 'checkoutForm',
    validateOnBlur: true,
    schema: z.object({
      personal: z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
      }),
      shipping: z.object({
        address: z.string(),
        city: z.string(),
        zipCode: z.string(),
      }),
    }),
  },
)
```

When implementing wizard forms, we need to separate form filling into different steps, and the completeness/errors and other states of each step need to be tracked independently of each other. Field sets can help us with this: we will split the form so that each step is a separate field set, essentially creating lenses that focus on a separate group of form fields:

```ts "personal," "shipping,"
const personalInfoSet = reatomFieldSet(
  checkoutForm.fields.personal,
  'checkoutForm.personalInfoSet',
)

const shippingInfoSet = reatomFieldSet(
  checkoutForm.fields.shipping,
  'checkoutForm.shippingInfoSet',
)
```

But the most convenient way to implement this is through `.extend`:

```ts
const checkoutForm = reatomForm({
  // ...
}).extend((target) => ({
  personalInfoSet: reatomFieldSet(
    target.fields.personal,
    `${target.name}.personalInfoSet`,
  ),
  shippingInfoSet: reatomFieldSet(
    target.fields.shipping,
    `${target.name}.shippingInfoSet`,
  ),
}))

checkoutForm.personalInfoSet.focus() // <- { active: false, dirty: false, touched: false }
checkoutForm.shippingInfoSet.validation() // <- { errors: [], triggered: false, validating: undefined }
```

Now we can use the `validation` atom to display the submit availability status, reset button for fields only for this step, and for validating the step according to the parent form's validation schema
