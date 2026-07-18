import { describe, expect, test, vi, viTest } from 'test'
import { z } from 'zod'

import {
  addCallHook,
  atom,
  getCalls,
  notify,
  reatomEnum,
  sleep,
  throwAbort,
  wrap,
} from '../'
import { fieldInitValidation, reatomField, withField } from '.'

test(`validateOnChange`, async () => {
  const name = 'validateOnChange'
  const field = reatomField('', {
    name: `${name}.field`,
    validateOnChange: true,
  })
  const changeFn = vi.fn()
  addCallHook(field.validation.trigger, changeFn)

  field.change('value')
  notify()
  expect(changeFn).toHaveBeenCalledTimes(1)
})

test(`validateOnBlur`, async () => {
  const field = reatomField('', { name: 'fieldAtom', validateOnBlur: true })
  const blurFn = vi.fn()
  addCallHook(field.validation.trigger, blurFn)

  field.focus.out()
  notify()
  expect(blurFn).toHaveBeenCalledTimes(1)
})

test(`validateOnConnect`, async () => {
  const field = reatomField('', {
    name: 'fieldAtom',
    validateOnConnect: true,
  })

  const connectFn = vi.fn()
  addCallHook(field.validation.trigger, connectFn)

  field.subscribe()
  notify()
  expect(connectFn).toHaveBeenCalledTimes(1)
})

test(`keepErrorOnChange`, async () => {
  const validate = () => {
    throw new Error('validation error')
  }

  const fieldWithKeep = reatomField('', {
    name: 'fieldKeep',
    validate,
    keepErrorOnChange: true,
  })

  const fieldWithoutKeep = reatomField('', {
    name: 'fieldNoKeep',
    validate,
    keepErrorOnChange: false,
  })

  fieldWithKeep.validation.trigger()
  fieldWithoutKeep.validation.trigger()
  notify()
  expect(fieldWithKeep.validation().error).toBe('validation error')
  expect(fieldWithoutKeep.validation().error).toBe('validation error')

  fieldWithKeep.change('new value')
  fieldWithoutKeep.change('new value')
  notify()
  expect(fieldWithKeep.validation().error).toBe('validation error')
  expect(fieldWithoutKeep.validation().error).toBeFalsy()
})

test(`keepErrorDuringValidating`, async () => {
  const validate = async () => {
    await wrap(sleep())
    throw new Error('validation error')
  }

  const fieldWithKeep = reatomField('', {
    name: 'fieldKeep',
    validate,
    keepErrorDuringValidating: true,
  })

  const fieldWithoutKeep = reatomField('', {
    name: 'fieldNoKeep',
    validate,
    keepErrorDuringValidating: false,
  })

  fieldWithKeep.validation.trigger()
  fieldWithoutKeep.validation.trigger()
  await wrap(sleep())
  expect(fieldWithKeep.validation().error).toBe('validation error')
  expect(fieldWithoutKeep.validation().error).toBe('validation error')

  fieldWithKeep.change('new value')
  fieldWithoutKeep.change('new value')

  fieldWithKeep.validation.trigger()
  fieldWithoutKeep.validation.trigger()
  notify()
  expect(fieldWithKeep.validation().error).toBe('validation error')
  expect(fieldWithoutKeep.validation().error).toBeFalsy()
})

test(`disabled state`, async () => {
  const field = reatomField('', {
    validateOnChange: true,
    validate: ({ state }) =>
      state == 'errorValue' ? 'validation error' : undefined,
  })

  field.change('errorValue')
  notify()
  expect(field.validation().error).toBe('validation error')

  field.disabled.set(true)
  notify()
  expect(field.validation()).toMatchObject(fieldInitValidation)

  field.disabled.set(false)
  notify()
  expect(field.validation().error).toBe('validation error')
})

test(`toState and fromState`, async () => {
  const label = 'label'

  const field = reatomField(
    { label, value: 1337 },
    {
      name: 'fieldAtom',
      fromState: (state) => state.value,
      toState: (value) => ({ label, value }),
    },
  )

  field.set({ label, value: 1000 })
  expect(field.value()).toEqual(1000)

  field.change(2000)
  expect(field()).toEqual({ label, value: 2000 })
})

test(`fromState reactivity`, async () => {
  const decimalPlaces = atom(2, 'decimalPlaces')

  const priceField = reatomField<number, string>(100.5, {
    name: 'priceField',
    fromState: (state) => state.toFixed(decimalPlaces()),
    toState: (value) => {
      if (!value) return 0
      const parsed = parseFloat(value)
      const multiplier = Math.pow(10, decimalPlaces())
      return Math.round(parsed * multiplier) / multiplier
    },
  })

  expect(priceField()).toBe(100.5)
  expect(priceField.value()).toBe('100.50')

  priceField.change('100.12345')
  notify()
  expect(priceField()).toBe(100.12)
  expect(priceField.value()).toBe('100.12')

  decimalPlaces.set(4)
  notify()

  expect(priceField.value()).toBe('100.1200')

  priceField.change('99.123456789')
  notify()
  expect(priceField()).toBe(99.1235)
  expect(priceField.value()).toBe('99.1235')

  decimalPlaces.set(0)
  notify()
  expect(priceField.value()).toBe('99')

  priceField.change('88.7')
  notify()
  expect(priceField()).toBe(89)
  expect(priceField.value()).toBe('89')
})

test(`value atom should be writable`, async () => {
  const field = reatomField<Date | null, string>(null, {
    name: 'fieldAtom',
    fromState: (state) => (state ? state.toString() : ''),
    toState: (value) => {
      if (!value) return null
      const date = new Date(value)
      return !isNaN(date.getTime()) ? date : null
    },
  })

  expect(field()).toBeNull()
  expect(field.value()).toBe('')

  const date = new Date()

  field.set(date)
  expect(field.value()).toBe(date.toString())

  field.change('Oct 27 2025 25:00')
  expect(field()).toBe(null)
})

test('toState abort', () => {
  const numberField = reatomField(0, {
    fromState: (state) => state.toString(),
    toState: (value: string) => {
      const parsed = Number(value)
      return isNaN(parsed) ? throwAbort() : parsed
    },
  })

  numberField.change('-')
  expect(numberField()).toBe(0)

  numberField.change('-1')
  expect(numberField()).toBe(-1)

  numberField.change('-')
  expect(numberField()).toBe(-1)

  numberField.set(10)
  expect(numberField.value()).toBe('10')
})

test(`validation concurrency`, async () => {
  const field = reatomField(123, {
    validate: async ({ value }) => {
      await wrap(sleep(5))

      if (value === 0xdeadbeef) throw new Error('validation error')
    },
  })

  field.validation.trigger()
  expect(field.validation()).toMatchObject({
    triggered: true,
    error: undefined,
  })
  expect(field.validation().validating).toBeInstanceOf(Promise)

  field.change(1)
  notify()
  expect(field.validation()).toMatchObject(fieldInitValidation)

  field.validation.trigger()
  expect(field.validation()).toMatchObject({
    triggered: true,
    error: undefined,
  })
  expect(field.validation().validating).toBeInstanceOf(Promise)
  field.reset()
  expect(field.validation()).toMatchObject(fieldInitValidation)

  field.options.merge({ validateOnChange: true })
  notify()

  field.change(1)
  await wrap(sleep(1))
  field.change(0xdeadbeef)
  await wrap(sleep(1))
  field.change(3)
  notify()
  expect(field.validation()).toMatchObject({
    triggered: true,
    error: undefined,
  })
  expect(field.validation().validating).toBeInstanceOf(Promise)

  await wrap(sleep(5))

  expect(field.validation()).toMatchObject({
    validating: undefined,
    triggered: true,
    error: undefined,
  })
  expect(field.value()).toBe(3)
})

// FIXME see #1235
test.skip(`validation concurrency with conditional debounce`, async () => {
  const TAKEN_NAME = 'taken_name'

  const nameField = reatomField('', {
    name: 'nameField',
    validate: async ({ state }): Promise<string | undefined> => {
      if (state.length < 4)
        return getCalls(nameField.focus.out).length ? 'short' : undefined

      await wrap(sleep(1))
      return state === TAKEN_NAME ? 'taken' : undefined
    },
    validateOnBlur: true,
    validateOnChange: true,
  })

  nameField.change('e')
  await wrap(sleep())
  expect(nameField.validation()).toMatchObject({ error: undefined })

  nameField.focus.out()
  await wrap(sleep())
  expect(nameField.validation()).toMatchObject({ error: 'short' })

  nameField.change(TAKEN_NAME)
  await wrap(sleep())
  nameField.change(TAKEN_NAME + 'h')
  await wrap(sleep())
  await wrap(
    expect(nameField.validation().validating).resolves.toMatchObject({
      errors: [],
    }),
  )
  expect(nameField.validation()).toMatchObject({
    error: undefined,
    validating: undefined,
  })

  nameField.change(TAKEN_NAME)
  await wrap(sleep())
  nameField.change('ek')
  await wrap(sleep(1))
  expect(nameField.validation()).toMatchObject({
    error: 'short',
    validating: undefined,
  })

  nameField.change(TAKEN_NAME)
  await wrap(sleep())
  await wrap(
    expect(nameField.validation().validating).resolves.toMatchObject({
      errors: [{ message: 'taken' }],
    }),
  )
  expect(nameField.validation()).toMatchObject({
    validating: undefined,
    error: 'taken',
  })
})

test(`withField and initState derivation`, async () => {
  const field = reatomEnum(['lel', 'kek', 'shmek'], 'fieldAtom').extend(
    withField(),
  )

  expect(field()).toBe('lel')
  field.setKek()
  notify()
  expect(field()).toBe('kek')
  expect(field.focus().touched).toBe(true)

  field.reset()
  expect(field()).toBe('lel')

  expect(field.value.name).toBe('fieldAtom.value')
})

test(`initState atom`, () => {
  {
    const field = reatomField(123, 'field')

    expect(field.initState()).toBe(123)
    expect(field()).toBe(123)
  }
  {
    const field = reatomField(123, 'field')

    expect(field()).toBe(123)
    expect(field.initState()).toBe(123)
  }
  {
    const field = reatomField(123, 'field')

    field.initState.set(100)
    expect(field.initState()).toBe(100)
    expect(field()).toBe(100)
  }
})

test(`reset with initState`, async () => {
  const field = reatomField(123, 'field')

  field.initState.set(100)
  expect(field()).toEqual(100)

  field.change(2000)
  expect(field()).toEqual(2000)

  field.reset()
  expect(field()).toEqual(100)

  field.reset(1000)
  expect(field()).toEqual(1000)
  expect(field() === field.initState()).toBe(true)
})

describe(`standard schema validation`, () => {
  test('static', async () => {
    const field = reatomField(123, {
      name: 'field',
      validate: z.number().min(100, 'min'),
    })

    field.validation.trigger()
    notify()
    expect(field.validation().error).toBeUndefined()

    field.change(50)
    field.validation.trigger()
    notify()
    expect(field.validation().error).toBe('min')

    const asyncField = reatomField(123, {
      name: 'asyncField',
      validate: z.number().refine(async (value) => {
        try {
          await wrap(sleep(1))
          return value >= 100
        } catch {
          // TODO zod's refine leak unhandled promise rejection =(
          return false
        }
      }, 'min'),
    })

    asyncField.validation.trigger()
    notify()
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncField.validation().validating)

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncField.reset(150)
    asyncField.validation.trigger()

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    asyncField.reset(90)
    asyncField.validation.trigger.abort()
    notify()

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    await wrap(sleep(1))

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncField.reset(90)
    asyncField.validation.trigger()
    notify()
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncField.validation().validating)

    expect(asyncField.validation()).toMatchObject({
      error: 'min',
      validating: undefined,
    })
  })

  test('dynamic', async () => {
    const field = reatomField(90, {
      name: 'field',
      validateOnChange: true,
      validate: ({ focus }) =>
        focus.dirty ? z.number().min(100, 'min') : undefined,
    })

    field.change(90)
    notify()
    expect(field.validation().error).toBeUndefined()

    field.change(91)
    notify()
    expect(field.validation().error).toBe('min')

    const asyncField = reatomField(90, {
      name: 'asyncField',
      validateOnChange: true,
      validate: async ({ focus }) => {
        await wrap(sleep(1))
        return focus.dirty
          ? z.number().refine(async (value) => {
              await wrap(sleep(1))
              return value >= 100
            }, 'min')
          : undefined
      },
    })

    asyncField.validation.trigger()
    notify()
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncField.validation().validating)
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncField.change(91)
    notify()
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    asyncField.validation.trigger.abort()
    await wrap(asyncField.validation().validating)

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    await wrap(sleep(1))

    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: undefined,
    })

    asyncField.change(92)
    notify()
    expect(asyncField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(asyncField.validation().validating)
    expect(asyncField.validation()).toMatchObject({
      error: 'min',
      validating: undefined,
    })
  })
})

test('reactivity of own meta', async () => {
  const MASKED_FIELD_PLACEHOLDER = '•••••••••••••••'

  const myField = reatomField('', {
    name: 'myField',
    fromState(value, self) {
      if (value === '' && self.focus().active === false) {
        return MASKED_FIELD_PLACEHOLDER
      }
      return value
    },
    toState(value) {
      if (value === MASKED_FIELD_PLACEHOLDER) {
        return ''
      }
      return value
    },
  })

  expect(myField()).toBe('')
  expect(myField.value()).toBe(MASKED_FIELD_PLACEHOLDER)

  myField.change('123')
  expect(myField()).toBe('123')
  expect(myField.value()).toBe('123')

  myField.focus.in()
  expect(myField()).toBe('123')
  expect(myField.value()).toBe('123')
  myField.change('')
  expect(myField()).toBe('')
  expect(myField.value()).toBe('')

  myField.focus.out()
  expect(myField()).toBe('')
  expect(myField.value()).toBe(MASKED_FIELD_PLACEHOLDER)
})

describe(`reactivity of validate function`, () => {
  test(`basic`, () => {
    const passwordField = reatomField('', 'passwordField')

    const confirmField = reatomField('', {
      name: 'confirmField',
      validateOnChange: true,
      validate: () => {
        if (
          !passwordField.validation().error &&
          passwordField.value() != confirmField.value()
        )
          return 'Passwords do not match'
        return undefined
      },
    })

    passwordField.change('pass')
    notify()
    expect(confirmField.validation.errors()).toHaveLength(0)

    confirmField.change('password')
    notify()
    expect(confirmField.validation().error).toBeTruthy()

    passwordField.change('password')
    notify()
    expect(confirmField.validation.errors()).toHaveLength(0)
  })

  test.skip('concurrency', async () => {
    const burgerField = reatomField('Hamburger', 'burgerField')

    const fetchBurgerCookingTime = async (burger: string) => {
      await sleep(1)
      if (burger === 'Hamburger') return 10
      else return 5
    }

    const pickupTimeField = reatomField(0, {
      name: 'pickupTimeField',
      validateOnChange: true,
      validate: async () => {
        const burger = burgerField.value()
        const pickupTime = pickupTimeField.value()

        const cookingTime = await wrap(fetchBurgerCookingTime(burger))
        if (cookingTime > pickupTime) return 'cookTooLong'
        return undefined
      },
    })

    pickupTimeField.change(8)
    await wrap(sleep())

    await wrap(
      expect(pickupTimeField.validation().validating).resolves.toMatchObject({
        errors: [
          {
            source: 'validation',
            message: 'cookTooLong',
          },
        ],
      }),
    )

    burgerField.change('Cheeseburger')
    await wrap(sleep())

    await wrap(
      expect(pickupTimeField.validation().validating).resolves.toMatchObject({
        errors: [],
      }),
    )

    burgerField.change('Krabby Patty')
    await wrap(sleep())
    pickupTimeField.change(3)
    await wrap(sleep())

    expect(pickupTimeField.validation()).toMatchObject({
      error: undefined,
      validating: expect.any(Promise),
    })

    await wrap(
      expect(pickupTimeField.validation().validating).resolves.toMatchObject({
        errors: [
          {
            source: 'validation',
            message: 'cookTooLong',
          },
        ],
      }),
    )
  })
})
