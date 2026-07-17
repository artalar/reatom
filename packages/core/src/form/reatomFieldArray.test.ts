import { describe, expect, test, vi } from 'test'
import { z } from 'zod'

import { addCallHook, atom, notify, sleep, wrap } from '../'
import { reatomFieldArray } from '.'

test(`validateOnChange`, async () => {
  const fieldArray = reatomFieldArray([''], {
    name: 'validateOnChange.fieldArray',
    validateOnChange: true,
  })
  const changeFn = vi.fn()
  addCallHook(fieldArray.validation.trigger, changeFn)

  fieldArray.create('')
  notify()
  expect(changeFn).toHaveBeenCalledTimes(1)
})

test(`validateOnBlur`, async () => {
  const fieldArray = reatomFieldArray([''], {
    name: 'fieldArray',
    validateOnBlur: true,
  })
  const blurFn = vi.fn()
  addCallHook(fieldArray.validation.trigger, blurFn)

  fieldArray.focus.out()
  notify()
  expect(blurFn).toHaveBeenCalledTimes(1)
})

test(`validateOnConnect`, async () => {
  const contactsFieldArray = reatomFieldArray(
    [{ name: '', address: '', enabled: true }],
    {
      name: 'contacts',
      validateOnChange: true,
      validateOnConnect: true,
      validate: ({ state }) => {
        return state.every((group) => !group.enabled())
          ? 'minOneEnabled'
          : undefined
      },
    },
  )

  contactsFieldArray.array.subscribe()
  await wrap(sleep())

  expect(contactsFieldArray.validation().error).toBe(undefined)

  contactsFieldArray.array()[0]?.enabled.set(false)
  await wrap(sleep())
  expect(contactsFieldArray.validation().error).toBe('minOneEnabled')

  contactsFieldArray.create({
    name: 'John Doe',
    address: '123 Main St',
    enabled: true,
  })
  await wrap(sleep())
  expect(contactsFieldArray.validation().error).toBe(undefined)
})

test(`keepErrorOnChange`, async () => {
  const validate = () => {
    throw new Error('validation error')
  }

  const fieldArrayWithKeep = reatomFieldArray([''], {
    name: 'fieldArrayKeep',
    validate,
    keepErrorOnChange: true,
  })

  const fieldArrayWithoutKeep = reatomFieldArray([''], {
    name: 'fieldArrayNoKeep',
    validate,
    keepErrorOnChange: false,
  })

  fieldArrayWithKeep.validation.trigger()
  fieldArrayWithoutKeep.validation.trigger()
  notify()
  expect(fieldArrayWithKeep.validation().error).toBe('validation error')
  expect(fieldArrayWithoutKeep.validation().error).toBe('validation error')

  fieldArrayWithKeep.create('new value')
  fieldArrayWithoutKeep.create('new value')
  notify()
  expect(fieldArrayWithKeep.validation().error).toBe('validation error')
  expect(fieldArrayWithoutKeep.validation().error).toBeFalsy()
})

test(`keepErrorDuringValidating`, async () => {
  const validate = async () => {
    await wrap(sleep())
    throw new Error('validation error')
  }

  const fieldArrayWithKeep = reatomFieldArray([''], {
    name: 'fieldArrayKeep',
    validate,
    keepErrorDuringValidating: true,
  })

  const fieldArrayWithoutKeep = reatomFieldArray([''], {
    name: 'fieldArrayNoKeep',
    validate,
    keepErrorDuringValidating: false,
  })

  fieldArrayWithKeep.validation.trigger()
  fieldArrayWithoutKeep.validation.trigger()
  await wrap(sleep())
  expect(fieldArrayWithKeep.validation().error).toBe('validation error')
  expect(fieldArrayWithoutKeep.validation().error).toBe('validation error')

  fieldArrayWithKeep.create('new value')
  fieldArrayWithoutKeep.create('new value')

  fieldArrayWithKeep.validation.trigger()
  fieldArrayWithoutKeep.validation.trigger()
  notify()
  expect(fieldArrayWithKeep.validation().error).toBe('validation error')
  expect(fieldArrayWithoutKeep.validation().error).toBeFalsy()
})

test(`correct dirty check`, () => {
  const fieldArray = reatomFieldArray(['a', 'b', 'c'])
  expect(fieldArray.focus().dirty).toBeFalsy()

  const element = fieldArray.create('b')

  expect(fieldArray.focus().dirty).toBeTruthy()

  fieldArray.remove(element)

  expect(fieldArray.focus().dirty).toBeFalsy()
})

describe(`standard schema validation`, () => {
  test('static', async () => {
    const fieldArray = reatomFieldArray(['a', 'b', 'c'], {
      name: 'fieldArray',
      validate: z.array(z.any()).min(2, 'min'),
    })

    fieldArray.validation.trigger()
    notify()
    expect(fieldArray.validation().error).toBeUndefined()

    fieldArray.remove(fieldArray.array()[0]!)
    fieldArray.remove(fieldArray.array()[0]!)
    fieldArray.validation.trigger()
    notify()
    expect(fieldArray.validation().error).toBe('min')

    const asyncFieldArray = reatomFieldArray(['a', 'b', 'c'], {
      name: 'asyncFieldArray',
      validate: z.array(z.any()).refine(async (value) => {
        try {
          await wrap(sleep(1))
          return value.length >= 2
        } catch {
          return false
        }
      }, 'min'),
    })

    asyncFieldArray.validation.trigger()
    notify()
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncFieldArray.validation().validating)

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncFieldArray.reset(['a'])
    asyncFieldArray.validation.trigger()
    notify()

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    asyncFieldArray.reset(['x', 'y', 'z'])
    asyncFieldArray.validation.trigger.abort()
    notify()

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    await wrap(sleep(1))

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncFieldArray.reset(['single'])
    asyncFieldArray.validation.trigger()
    notify()
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncFieldArray.validation().validating)

    expect(asyncFieldArray.validation()).toMatchObject({
      error: 'min',
      validating: undefined,
    })
  })

  test('dynamic', async () => {
    const fieldArray = reatomFieldArray(['a'], {
      name: 'fieldArray',
      validateOnChange: true,
      validate: ({ focus }) => {
        if (focus.dirty) return z.array(z.any()).min(2, 'min')
        return undefined
      },
    })

    fieldArray.create('b')
    notify()
    expect(fieldArray.validation().error).toBeUndefined()

    fieldArray.remove(fieldArray.array()[0]!)
    notify()
    expect(fieldArray.validation().error).toBe('min')

    const asyncFieldArray = reatomFieldArray(['a'], {
      name: 'asyncFieldArray',
      validateOnChange: true,
      validate: async ({ focus }) => {
        await wrap(sleep(1))
        if (focus.dirty)
          return z.array(z.any()).refine(async (value) => {
            await wrap(sleep(1))
            return value.length >= 2
          }, 'min')
        return undefined
      },
    })

    asyncFieldArray.validation.trigger()
    notify()
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncFieldArray.validation().validating)
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncFieldArray.remove(asyncFieldArray.array()[0]!)
    notify()
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    asyncFieldArray.validation.trigger.abort()
    await wrap(asyncFieldArray.validation().validating)

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    await wrap(sleep(1))

    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncFieldArray.create('x')
    notify()
    expect(asyncFieldArray.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncFieldArray.validation().validating)
    expect(asyncFieldArray.validation()).toMatchObject({
      error: 'min',
      validating: undefined,
    })
  })
})

describe(`reactivity of validate function`, () => {
  test(`basic`, () => {
    const minLength = atom(2, 'minLength')

    const fieldArray = reatomFieldArray(['a'], {
      name: 'fieldArray',
      validateOnChange: true,
      validate: ({ value }) => {
        if (value.length < minLength()) return 'too few items'
        return undefined
      },
    })

    fieldArray.create('b')
    notify()
    expect(fieldArray.validation.errors()).toHaveLength(0)

    fieldArray.remove(fieldArray.array()[0]!)
    notify()
    expect(fieldArray.validation().error).toBe('too few items')

    minLength.set(1)
    notify()
    expect(fieldArray.validation.errors()).toHaveLength(0)
  })

  test(`cross-field validation`, () => {
    const requiredCount = atom(2, 'requiredCount')

    const fieldArray = reatomFieldArray(['a'], {
      name: 'fieldArray',
      validateOnChange: true,
      validate: ({ value }) => {
        if (value.length < requiredCount()) return 'Need more items'
        return undefined
      },
    })

    expect(fieldArray.validation.errors()).toHaveLength(0)

    fieldArray.create('b')
    notify()
    expect(fieldArray.validation.errors()).toHaveLength(0)

    requiredCount.set(3)
    notify()
    expect(fieldArray.validation().error).toBe('Need more items')

    fieldArray.create('c')
    notify()
    expect(fieldArray.validation.errors()).toHaveLength(0)
  })
})

describe(`reset after element removal (#1309)`, () => {
  const setup = (name: string) => {
    const fieldArray = reatomFieldArray(['first', 'second', 'third'], { name })
    const values = () => fieldArray.array().map((element) => element())
    return { fieldArray, values }
  }

  const cases = [
    { position: 'head', index: 0, afterRemove: ['second', 'third'] },
    { position: 'middle', index: 1, afterRemove: ['first', 'third'] },
    { position: 'tail', index: 2, afterRemove: ['first', 'second'] },
  ]

  for (const { position, index, afterRemove } of cases) {
    test(`restores ${position} element`, () => {
      const { fieldArray, values } = setup(`resetAfterRemoval.${position}`)

      fieldArray.remove(fieldArray.array()[index]!)
      notify()
      expect(fieldArray().size).toBe(2)
      expect(values()).toEqual(afterRemove)

      fieldArray.reset()
      notify()
      expect(fieldArray().size).toBe(3)
      expect(values()).toEqual(['first', 'second', 'third'])
    })
  }

  test(`restores all elements after multiple removals`, () => {
    const { fieldArray, values } = setup('resetAfterRemoval.multiple')

    fieldArray.remove(fieldArray.array()[2]!)
    fieldArray.remove(fieldArray.array()[0]!)
    notify()
    expect(fieldArray().size).toBe(1)
    expect(values()).toEqual(['second'])

    fieldArray.reset()
    notify()
    expect(fieldArray().size).toBe(3)
    expect(values()).toEqual(['first', 'second', 'third'])
  })
})
