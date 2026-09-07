---
title: Form
description: Build type-safe forms with reatomForm — fieldsets, schema validation, and concurrent submit
---

:::tip[Are you ready for forms?]
Before learning `reatomForm`, familiarize yourself with [the reatomFieldSet concept](/handbook/forms/concepts/fieldset/), since most of `reatomForm` functionality is based on it.
:::

`reatomForm` is a small wrapper over `reatomFieldSet` that includes several important features that should be in any form:

1. The ability to submit a form
2. The ability to perform validation through validation schemas
3. The ability to add form-level validation rules
4. The ability to define some form options globally for all fields

Consequently, we can immediately determine that we are dealing with `reatomFieldSet` and therefore field initialization, aggregation atoms, and actions are already present inside.

## Submit

Forms have a built-in `submit` action, which itself is an [async action with the `withAsyncData` extension](/handbook/async/). When this action is triggered, the following happens:

1. First, validation of all fields is triggered (essentially, the field set's `validation.trigger` method is called)
2. If the validation `schema` is defined in the form options, then schema validation is invoked
3. If the form options have a `validateBeforeSubmit` function, it is called next
4. If both validation stages pass successfully, the asynchronous `onSubmit` callback from the form options is called. The first argument receives the state of all field values in structure (essentially the state of the field set atom itself)
5. The `form.submitted` atom becomes `true` if no error occurred in `onSubmit`

```ts "state"
const contactUsForm = reatomForm(
  {
    subject: reatomEnum(['support', 'complaint', 'other']).extend(withField()),
    message: '',
  },
  {
    name: 'contactUsForm',
    onSubmit: async (state) => {
      //             ^ { subject: 'support' | 'complaint' | 'other', message: string }
    },
  },
)

await contactUsForm.submit()
contactUsForm.submitted() // <- true, because there were no errors
```

:::caution[Handle `submit` call errors]
The action is asynchronous and expects **error throwing**, and often when calling it, developers forget to handle errors by adding a `try catch` block or `.catch(noop)`.
:::

Errors that occurred during form submission will be collected in the `submit.error` atom, but may also be reflected in the fields if they belong to them

### Custom params and return data

We leave the ability for the developer to define call parameters and return value for the `submit` action:

```ts "action: 'draft' | 'publish'" "return post" {15}
const blogPostForm = reatomForm(
  {
    title: '',
    content: '',
  },
  {
    name: 'blogPostForm',
    onSubmit: async (state, action: 'draft' | 'publish') => {
      const post =
        action === 'draft'
          ? wrap(await api.saveDraft(state))
          : wrap(await api.publishPost(state))

      return post
    },
  },
)

const post = await blogPostForm.submit('draft')
```

### Concurrency

Since the `withAsyncData` extension also adds `withAbort` to async actions, the `submit` action supports concurrent execution. This means we can easily implement submit debouncing just as it can be implemented with [reatomField validation](/handbook/forms/recipes/async-validation-debounce/):

```ts {9}
const exchangeRatesForm = reatomForm(
  {
    value: '',
    currency: '',
  },
  {
    name: 'exchangeRatesForm',
    onSubmit: async (state) => {
      await wrap(sleep(500))
      return wrap(api.getExchangeRates(state))
    },
  },
)
```

Subsequent calls to `submit` will be cancelled if the previous call has not yet completed.

### `reset` side-effects

Calling the form's `form.reset` action, in addition to calling the `reset` method of the form's field set itself, resets the `form.submitted` state to `false`, and also cancels the execution of the `submit` action by throwing an abort error

## Standard Schema validation

The [Standard Schema](https://standardschema.dev) contract is also supported by the `schema` parameter, so you can use many validation libraries that support it.

```ts "state"
const registerForm = reatomForm(
  {
    email: '',
    password: '',
    dateOfBirth: '',
  },
  {
    name: 'registerForm',
    schema: z.object({
      email: z.email(),
      password: z.string().min(6),
      dateOfBirth: z.coerce.number().int().positive(),
    }),
    onSubmit: async (state) => {
      //             ^ { email: string, password: string, age: number }
      return wrap(api.register(state))
    },
  },
)
```

Now the first argument in `onSubmit` will be the result of parsing and validating the form data by the validation schema, considering all further transformations (in other words, the `Output` type).

Errors issued by the validation schema will be distributed across fields according to their `path`, that is, according to the keys in the schema

### Validation behavior

Schema validation occurs automatically when validation of any form field is triggered, while validation occurs across the entire schema completely due to Standard Schema limitations, so editing one field can create a cascade of errors in all other fields that the user hasn't even touched. How to manage this behavior is described in the [Errors UX recipe](/handbook/forms/recipes/errors-ux/)

You can also invoke form validation by schema programmatically through the `form.triggerSchemaValidation` action, which will validate all fields by schema and assign validation errors to each field

## Default options for fields

All form fields acquire the options `validateOnChange`, `validateOnBlur`, `keepErrorOnChange`, `keepErrorDuringValidating` set on the form as default values, but each individual field can override these options. In other words, if a field has not defined one of these options, the form can define them itself, but not override already defined options

```ts
const applicationForm = reatomForm(
  (name) => ({
    name: '',
    body: '',
    images: reatomArray<File>([], `${name}.images`).extend(
      withField({
        validateOnBlur: false,
        validateOnChange: true,
        validate: ({ state }) =>
          !state.length ? 'Please add at least one image' : undefined,
      }),
    ),
  }),
  {
    name: 'applicationForm',
    validateOnBlur: true,
  },
)
```

In this example, all fields will be validated on blur, except for the `images` field: it has `validateOnBlur` disabled because for this type of input it doesn't make sense since it's not focusable, but `validateOnChange` is enabled
