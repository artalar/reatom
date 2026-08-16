import { type FieldElementRef, reatomForm } from '@reatom/core'
import type { Ref } from 'react'
import { expectTypeOf, test } from 'vitest'

import { bindField } from './'

const form = reatomForm({ text: '', flag: false }, 'typeForm')

test('text field: value is the field value, checked is undefined', () => {
  const bound = bindField(form.fields.text)

  expectTypeOf(bound.value).toEqualTypeOf<string>()
  expectTypeOf(bound.checked).toEqualTypeOf<undefined>()
  expectTypeOf(bound.error).toEqualTypeOf<string | undefined>()
  expectTypeOf(bound.ref).parameters.toEqualTypeOf<[FieldElementRef | null]>()
})

test('boolean field: value is undefined, checked is boolean', () => {
  const bound = bindField(form.fields.flag)

  expectTypeOf(bound.value).toEqualTypeOf<undefined>()
  expectTypeOf(bound.checked).toEqualTypeOf<boolean>()
})

test('bound props spread onto <input> without type errors', () => {
  // must compile for a text field (uses `value`)...
  expectTypeOf(<input {...bindField(form.fields.text)} />).toBeObject()
  // ...and for a boolean field (uses `checked`)
  expectTypeOf(
    <input type="checkbox" {...bindField(form.fields.flag)} />,
  ).toBeObject()
})

test('options accept passthrough handlers, callback and object refs', () => {
  const objectRef: Ref<FieldElementRef> = { current: null }
  bindField(form.fields.text, { ref: objectRef })

  bindField(form.fields.text, {
    ref: (element) => {
      expectTypeOf(element).toEqualTypeOf<FieldElementRef | null>()
    },
    onChange: (value) => void value,
    onBlur: (event) => void event,
    onFocus: (event) => void event,
  })
})
