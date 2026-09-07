---
title: Field array
description: Dynamic field lists with reatomFieldArray — add, remove, reorder, and validate array fields
---

In Reatom, a dynamic field list shares most traits with `reatomField` and is based on the `reatomLinkedList` primitive, which provides extremely high rendering performance and editing operations for dynamic field lists.

However, since fields and forms in Reatom are initialized outside the UI layer, and the initialized fields can receive various settings for establishing external reactive connections/persistence/etc, dynamic field initialization differs significantly from other libraries, and here we will examine this in detail.

## Initialization

There are several ways to initialize array fields:

### Array Literals

The simplest way is to specify array literals, which must have type information for correct type inference:

```ts
const emailsFieldArray = reatomFieldArray(['mail@example.com'], 'emails')
```

In this case, `reatomFieldArray` will know that you passed an array with a default `string` value, and this will be enough to build a dynamic field list with a single default item:

```ts
emailsFieldArray.array() // -> [FieldAtom<string>]
```

But a default value is not always available. In that case, you can explicitly specify generics in `reatomFieldArray` or use typed arrays—it all depends on the use case:

```ts
const emailsFieldArray = reatomFieldArray<string>([], 'emails')
// OR
const emailsFieldArray = reatomFieldArray(new Array<string>(), 'emails')
```

#### Behavior when specifying object literals

Everything works quite obviously when specifying an array of primitive values. But what if we specify an array of objects containing primitives, or even other nested objects?

```ts
const contactsFieldArray = reatomFieldArray(
  [{ name: 'John Doe', phone: '+14151234567' }],
  'contacts',
)

contactsFieldArray.array() // -> [{ name: FieldAtom<string>, phone: FieldAtom<string> }]
```

The object fields simply... [got atomized](/handbook/atomization/)! This means that object keys at any nesting level will be automatically wrapped in `reatomField`.

Let's say that's the case, but what if you need to configure a field during its creation: specify an individual validation function, configure value transformation, add persistence? The following initialization method is suitable for this.

### Item Factory

When it comes to configuring a dynamically created field, the item factory, or the `create` parameter of `reatomFieldArray`, comes to the rescue:

```ts
const contactsFieldArray = reatomFieldArray(
  (params: { name: string; phone: string; hidden: boolean }, elementName) => ({
    name: params.name,
    phone: reatomField(params.phone, {
      name: `${elementName}.phone`,
      validate: z.e164(), // zod built-in E.164 phone number validator
      validateOnBlur: true,
    }),
    hidden: reatomBoolean(params.hidden, `${elementName}.hidden`).extend(
      withField(),
    ),
  }),
  'contacts',
)

const newItem = contactsFieldArray.create({
  name: 'John Doe',
  phone: '+14151234567',
  hidden: false,
})

newItem.name() // -> FieldAtom<string>
newItem.phone() // -> FieldAtom<string>
newItem.hidden() // -> BooleanAtom & FieldExt<boolean>
```

Here we specified a function that describes how each element of the dynamic list will be created. Notable points here:

- We explicitly specified the `params` type to nominally indicate what the "parameters" for creating an element would look like during the element creation operation, or when initializing the original list elements. By the way, this could again be avoided in favor of type inference if at least one default list element was specified:

```diff lang="ts"
const contactsFieldArray = reatomFieldArray(
+  [{ name: '', phone: '', hidden: false }],
  {
    name: 'contacts',
+    create: (params, name) => ({
      name: params.name,
      phone: reatomField(params.phone, {
        name: `${name}.phone`,
        validate: z.e164(), // zod built-in E.164 phone number validator
        validateOnBlur: true
      }),
      hidden: reatomBoolean(params.hidden, `${name}.hidden`).extend(withField())
    }),
  }
)
```

- We left the `name` field with a primitive value from the `params.name` parameter. And this still means that for this part of the element **atomization will occur and a `reatomField` will be created in its place**. This is useful to avoid writing extra code for field initialization if no specific configuration is required.
- Technically, `FieldAtom` as a result of calling `reatomField` is also an object, but atomizing each property of this object would be a bug and unexpected behavior. Therefore, like primitive values, **`reatomField` is the atomization termination point**, and based on this, you can create fields with object values without automatic atomization of their keys.

```ts
const groupsFieldArray = reatomFieldArray(
  [{ name: '', permissions: ['read'] }],
  {
    name: 'groups',
    create: (params, name) => ({
      name: params.name,
      permissions: reatomField(params.permissions, `${name}.permissions`),
    }),
  },
)

const group = groupsFieldArray.create({
  name: 'admin',
  permissions: ['read', 'write', 'delete'],
})

group.name() // -> FieldAtom<string>
group.permissions() // -> FieldAtom<string[]>
```

## Validation behavior

Although `reatomFieldArray` is a list of dynamic fields, this model is not aggregational like [`reatomFieldSet`](/handbook/forms/concepts/fieldset/#aggregate-atoms). This model contains its own separate `validation`, `focus` atoms and its own `initState` separately from the underlying fields or other dynamic field lists.

Therefore, there are some nuances in ensuring `reatomFieldArray` validation when working with validation schemas. Since `reatomFieldArray` is based on `reatomLinkedList`, the SoT state of field array is not an array but a `LinkedList` instance—a special structure that will always contain non-deatomized data, making schema validation not straightforward.

```ts
const emailsFieldArray = reatomFieldArray(['test@mail.com'], {
  name: 'emails',
  validate: z.array(z.any()).min(2, 'min'),
  validateOnChange: true,
})
```

Schema validation works well here for validating the number of elements in the list, provided that we specify a `z.any()` contract for each element. It is also possible to describe a contract for a primitive field list using `z.transform`, but this won't make sense because the schema won't be able to react to state changes inside the dynamic list.

If the field list invariant depends on states inside the list, [reactive validation callback](/handbook/forms/concepts/reactive-validation/) will work:

```ts
const contactsFieldArray = reatomFieldArray(
  [{ name: '', address: '', enabled: true }],
  {
    name: 'contacts',
    validateOnChange: true,
    validateOnConnect: true,
    validate: ({ state }) => {
      return state.every((group) => !group.enabled())
        ? 'At least one contact should be enabled'
        : undefined
    },
  },
)
```

How this will work:

- `validateOnConnect` activates the first validation when the component that renders the field list is mounted
- The validation callback will be called to process validation, where a subscription to the `enabled` field will occur in a loop along with the first validation of the initial values
- Subsequent validations will occur when new elements are added and when the `enabled` field of each element changes

## Available Methods

Since field array or array literal in the fields definition are a syntactic sugar over `reatomLinkedList`, it provides several methods to manipulate the array of fields:

- `create(value)`: Adds a new field with the given value to the end of the array
- `remove(field)`: Removes a specific field from the array
- `clear()`: Removes all fields from the array
- `array()`: Returns an array of all fields, which you should use to iterate over the fields
- `swap(field1, field2)`: Swaps the positions of two fields in the array
- `move(field, targetField)`: Moves a field to a position after the target field (use null to move to the beginning)
- `find(predicate)`: Finds a field in the array that matches the predicate function

When rendering field arrays in UI components, you should always use the `.array()` method to iterate over the fields.

```ts
import { reatomForm } from '@reatom/core'

const emailsFieldArray = reatomFieldArray<string>([], 'emails')

// Add a new email field
emailsFieldArray.create('')

// Access the array of email fields
const emailFields = emailsFieldArray.array()

// Iterate over the fields to render them
// In React, this would look like:
// {emailFields.map((emailField) => (
//   <EmailFieldComponent key={emailField.name} field={emailField} />
// ))}

// Remove a specific email field
emailsFieldArray.remove(emailFields[0])

// Clear all email fields
emailsFieldArray.clear()
```

Since we use the "field as model" approach and each field is an object, we can achieve maximum type safety by working directly with objects. But the cherry on top is atomization, a principle used by array fields that allows maintaining a high-quality type-safe experience at any level of nesting in your forms.

## Nested Array Fields

You can also create nested array structures:

```ts
const addressesFieldArray = reatomFieldArray([
  {
    street: '',
    city: '',
    tags: ['home'],
  },
])

// Access nested fields
const addresses = addressesFieldArray.array()
const firstAddressTags = addresses[0]?.tags.array()
```

And you can use `FieldArrayItem` type helper to infer type of the field array item:

```tsx
import { reatomComponent, type FieldArrayItem } from '@reatom/core'

type AddressFieldType = FieldArrayItem<typeof form.fields.addresses>

const AddressField = reatomComponent(
  ({ element }: { element: AddressFieldType }) => {
    // ...
  },
)

type AddressTagFieldType = FieldArrayItem<AddressFieldType['tags']>

const AddressTagField = reatomComponent(
  ({ element }: { element: AddressTagFieldType }) => {
    // ...
  },
)
```

## Known limitations

Currently, the `dirty` state calculation does not work quite accurately because `reatomLinkedList` does not yet support multiple lists with overlapping elements (when one element can be in two or more linked lists simultaneously). Currently, the dirty check is limited to only checking the number of elements between `initState` and the current field array state. This can lead to situations where, for example, when moving/swapping elements, the field will be considered untouched.
