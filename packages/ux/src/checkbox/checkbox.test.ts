import { atom, context, effect, reatomField, reatomForm } from '@reatom/core'
import { beforeEach, expect, test, vi } from 'vitest'

import { checkboxProps } from './props'
import {
  isCheckboxItemChecked,
  nextCheckboxValue,
  reatomCheckbox,
  toAriaChecked,
  toNativeChecked,
} from './reatomCheckbox'

beforeEach(() => context.reset())

// --- pure transitions -------------------------------------------------------

test('isCheckboxItemChecked covers every state / item value pair', () => {
  // group item, array state
  expect(isCheckboxItemChecked(['apple'], 'apple')).toBe(true)
  expect(isCheckboxItemChecked(['apple'], 'orange')).toBe(false)
  expect(isCheckboxItemChecked([], 'apple')).toBe(false)
  // group item, scalar state (single select)
  expect(isCheckboxItemChecked('apple', 'apple')).toBe(true)
  expect(isCheckboxItemChecked('apple', 'orange')).toBe(false)
  expect(isCheckboxItemChecked(false, 'apple')).toBe(false)
  expect(isCheckboxItemChecked(1, 1)).toBe(true)
  // standalone checkbox
  expect(isCheckboxItemChecked(true)).toBe(true)
  expect(isCheckboxItemChecked(false)).toBe(false)
  expect(isCheckboxItemChecked('mixed')).toBe('mixed')
  // an array state belongs to a group, so a valueless checkbox is never checked
  expect(isCheckboxItemChecked(['apple'])).toBe(false)
  // a scalar group state can not check a valueless checkbox either
  expect(isCheckboxItemChecked('apple')).toBe(false)
})

test('nextCheckboxValue is a total transition', () => {
  // standalone: the reported flag becomes the state
  expect(nextCheckboxValue(false, undefined, true)).toBe(true)
  expect(nextCheckboxValue('mixed', undefined, true)).toBe(true)
  expect(nextCheckboxValue(true, undefined, false)).toBe(false)
  // array group: append / remove, never duplicate
  expect(nextCheckboxValue([], 'apple', true)).toEqual(['apple'])
  expect(nextCheckboxValue(['apple'], 'orange', true)).toEqual([
    'apple',
    'orange',
  ])
  expect(nextCheckboxValue(['apple'], 'apple', true)).toEqual(['apple'])
  expect(nextCheckboxValue(['apple', 'orange'], 'apple', false)).toEqual([
    'orange',
  ])
  expect(nextCheckboxValue([], 'apple', false)).toEqual([])
  // scalar group: checking replaces, unchecking the current item falls back to
  // `false`, matching Ariakit's `prevValue === value ? false : value`
  expect(nextCheckboxValue(false, 'apple', true)).toBe('apple')
  expect(nextCheckboxValue('orange', 'apple', true)).toBe('apple')
  expect(nextCheckboxValue('apple', 'apple', false)).toBe(false)
  expect(nextCheckboxValue('apple', 'apple', true)).toBe(false)
})

test('nextCheckboxValue does not mutate the previous array', () => {
  const state = ['apple']
  expect(nextCheckboxValue(state, 'orange', true)).toEqual(['apple', 'orange'])
  expect(state).toEqual(['apple'])
})

test('aria and native mappings of the tri-state flag', () => {
  expect(toAriaChecked(true)).toBe('true')
  expect(toAriaChecked(false)).toBe('false')
  expect(toAriaChecked('mixed')).toBe('mixed')

  expect(toNativeChecked(true)).toBe(true)
  expect(toNativeChecked(false)).toBe(false)
  // `'mixed'` has no native `checked` form, `indeterminate` expresses it
  expect(toNativeChecked('mixed')).toBe(false)
})

// --- standalone checkbox ----------------------------------------------------

test('standalone checkbox defaults to unchecked and toggles', () => {
  const agree = reatomCheckbox({ name: 'agree' })

  expect(agree()).toBe(false)
  expect(agree.checked()).toBe(false)
  expect(agree.mixed()).toBe(false)
  expect(agree.itemValue).toBe(undefined)
  expect(agree.editable()).toBe(true)

  expect(agree.toggle()).toBe(true)
  expect(agree()).toBe(true)
  expect(agree.checked()).toBe(true)

  agree.toggle()
  expect(agree()).toBe(false)
})

test('standalone checkbox cycles mixed to true', () => {
  const terms = reatomCheckbox({ value: 'mixed', name: 'terms' })

  expect(terms.checked()).toBe('mixed')
  expect(terms.mixed()).toBe(true)

  terms.toggle()
  expect(terms()).toBe(true)
  expect(terms.mixed()).toBe(false)

  terms.toggle()
  expect(terms()).toBe(false)

  // and back into the mixed state, which only a direct write can produce
  terms.set('mixed')
  expect(terms.checked()).toBe('mixed')
  terms.toggle()
  expect(terms()).toBe(true)
})

test('change applies the flag a native event reports', () => {
  const agree = reatomCheckbox({ name: 'agree' })

  // a native `change` event carries the already flipped property
  expect(agree.change(true)).toBe(true)
  expect(agree()).toBe(true)
  // an idempotent event does not flip the state back
  agree.change(true)
  expect(agree()).toBe(true)
  agree.change(false)
  expect(agree()).toBe(false)
})

test('name nesting follows the model structure', () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

  expect(fruits.name).toBe('fruits')
  expect(fruits.checked.name).toBe('fruits.checked')
  expect(fruits.toggle.name).toBe('fruits.toggle')
  expect(fruits.disabled.name).toBe('fruits.disabled')
  expect(fruits.item('apple').name).toBe('fruits#apple')
  expect(fruits.item('apple').checked.name).toBe('fruits#apple.checked')
  expect(fruits.item('apple').change.name).toBe('fruits#apple.change')
})

// --- group ------------------------------------------------------------------

test('group items share one value atom', () => {
  const fruits = reatomCheckbox<Array<string>>({
    value: ['apple'],
    name: 'fruits',
  })
  const apple = fruits.item('apple')
  const orange = fruits.item('orange')

  expect(apple.checked()).toBe(true)
  expect(orange.checked()).toBe(false)

  orange.toggle()
  expect(fruits()).toEqual(['apple', 'orange'])
  expect(orange.checked()).toBe(true)

  apple.toggle()
  expect(fruits()).toEqual(['orange'])
  expect(apple.checked()).toBe(false)

  // a write to the shared atom is reflected by every item
  fruits.set(['apple'])
  expect(apple.checked()).toBe(true)
  expect(orange.checked()).toBe(false)
})

test('item sub-models are memoized per value', () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })

  expect(fruits.item('apple')).toBe(fruits.item('apple'))
  expect(fruits.item('apple')).not.toBe(fruits.item('orange'))
  // guards are shared by reference, not copied per item
  expect(fruits.item('apple').disabled).toBe(fruits.disabled)
  expect(fruits.item('apple').readOnly).toBe(fruits.readOnly)
  expect(fruits.item('apple').editable).toBe(fruits.editable)
})

test('item values may be numbers', () => {
  const scores = reatomCheckbox<Array<number>>({ value: [], name: 'scores' })

  scores.item(1).toggle()
  scores.item(2).toggle()
  expect(scores()).toEqual([1, 2])

  scores.item(1).toggle()
  expect(scores()).toEqual([2])
})

test('single-select group unsets on re-toggle', () => {
  const size = reatomCheckbox<string | false>({ value: false, name: 'size' })
  const small = size.item('small')
  const large = size.item('large')

  small.toggle()
  expect(size()).toBe('small')
  expect(small.checked()).toBe(true)

  large.toggle()
  expect(size()).toBe('large')
  expect(small.checked()).toBe(false)

  large.toggle()
  expect(size()).toBe(false)
  expect(large.checked()).toBe(false)
})

test('group root is the tri-state "check all" checkbox', () => {
  const fruits = reatomCheckbox<Array<string> | CheckboxAllState>({
    value: [],
    name: 'fruits',
  })

  // the root has no item value, so an array state reads as unchecked
  expect(fruits.checked()).toBe(false)
  fruits.item('apple').toggle()
  expect(fruits.checked()).toBe(false)

  // a "check all" control writes the shared atom directly
  fruits.set('mixed')
  expect(fruits.checked()).toBe('mixed')
  fruits.toggle()
  expect(fruits()).toBe(true)
})

type CheckboxAllState = boolean | 'mixed'

// --- guards -----------------------------------------------------------------

test('disabled blocks every transition', () => {
  const fruits = reatomCheckbox<Array<string>>({
    value: ['apple'],
    disabled: true,
    name: 'fruits',
  })
  const apple = fruits.item('apple')
  const orange = fruits.item('orange')

  expect(fruits.editable()).toBe(false)

  expect(orange.toggle()).toEqual(['apple'])
  expect(fruits()).toEqual(['apple'])
  apple.change(false)
  expect(fruits()).toEqual(['apple'])

  fruits.disabled.set(false)
  orange.toggle()
  expect(fruits()).toEqual(['apple', 'orange'])
})

test('readOnly blocks user intent but not direct writes', () => {
  const agree = reatomCheckbox({ readOnly: true, name: 'agree' })

  expect(agree.editable()).toBe(false)
  agree.toggle()
  expect(agree()).toBe(false)
  agree.change(true)
  expect(agree()).toBe(false)

  // "read-only" constrains the user, not the owner of the state
  agree.set(true)
  expect(agree()).toBe(true)

  agree.readOnly.set(false)
  agree.toggle()
  expect(agree()).toBe(false)
})

test('editable folds both guards', () => {
  const agree = reatomCheckbox({ name: 'agree' })

  expect(agree.editable()).toBe(true)
  agree.disabled.set(true)
  expect(agree.editable()).toBe(false)
  agree.readOnly.set(true)
  agree.disabled.set(false)
  expect(agree.editable()).toBe(false)
  agree.readOnly.set(false)
  expect(agree.editable()).toBe(true)
})

// --- adopted value atom -----------------------------------------------------

test('an adopted atom stays the single source of truth', () => {
  const source = atom<boolean | 'mixed'>(false, 'source')
  const agree = reatomCheckbox({ valueAtom: source, name: 'agree' })

  expect(agree()).toBe(false)

  // model → atom
  agree.toggle()
  expect(source()).toBe(true)
  expect(agree()).toBe(true)

  // atom → model
  source.set('mixed')
  expect(agree()).toBe('mixed')
  expect(agree.checked()).toBe('mixed')

  // a write to the model reaches the adopted atom, including updater functions
  agree.set((state) => (state === 'mixed' ? false : state))
  expect(source()).toBe(false)

  // the model does not pollute the adopted atom
  expect('toggle' in source).toBe(false)
  expect('checked' in source).toBe(false)

  // the model keeps its own name, so nested units and prop records stay named
  expect(agree.name).toBe('agree')
  expect(agree.checked.name).toBe('agree.checked')
})

test('two models can share one adopted atom', () => {
  const source = atom<Array<string>>([], 'source')
  const left = reatomCheckbox<Array<string>>({
    valueAtom: source,
    name: 'left',
  })
  const right = reatomCheckbox<Array<string>>({
    valueAtom: source,
    name: 'right',
  })

  left.item('apple').toggle()
  expect(right.item('apple').checked()).toBe(true)

  right.item('apple').toggle()
  expect(left.item('apple').checked()).toBe(false)
  expect(source()).toEqual([])

  // the guards stay per-model
  left.disabled.set(true)
  left.item('apple').toggle()
  expect(source()).toEqual([])
  right.item('apple').toggle()
  expect(source()).toEqual(['apple'])
})

test('an adopted atom is reactive through the model', async () => {
  const source = atom<boolean | 'mixed'>(false, 'source')
  const agree = reatomCheckbox({ valueAtom: source, name: 'agree' })
  const track = vi.fn()
  const tracker = effect(() => track(agree.checked()), 'agree.track')

  await null
  expect(track).toHaveBeenLastCalledWith(false)

  source.set(true)
  await null
  expect(track).toHaveBeenLastCalledWith(true)

  agree.toggle()
  await null
  expect(track).toHaveBeenLastCalledWith(false)

  tracker.unsubscribe()
})

test('passing both value and valueAtom is a programming error', () => {
  const source = atom(false, 'source')
  expect(() =>
    reatomCheckbox({ value: true, valueAtom: source, name: 'agree' }),
  ).toThrow('pass either "value" or "valueAtom"')
})

// --- form integration -------------------------------------------------------

test('a reatomForm field can back a checkbox', () => {
  const form = reatomForm(
    { agree: reatomField(false, { name: 'form.fields.agree' }) },
    'form',
  )
  const agree = reatomCheckbox({ valueAtom: form.fields.agree, name: 'agree' })

  expect(agree()).toBe(false)
  expect(form.fields.agree.focus().dirty).toBe(false)

  agree.toggle()
  expect(form.fields.agree()).toBe(true)
  // the field observed the write, so its own tracking still works
  expect(form.fields.agree.focus().dirty).toBe(true)

  form.reset()
  expect(agree()).toBe(false)
  expect(agree.checked()).toBe(false)
})

test('a checkbox group can back a multi-value field', () => {
  const field = reatomField<Array<string>>([], 'field')
  const fruits = reatomCheckbox<Array<string>>({
    valueAtom: field,
    name: 'fruits',
  })

  fruits.item('apple').toggle()
  fruits.item('orange').toggle()
  expect(field()).toEqual(['apple', 'orange'])
  expect(field.focus().dirty).toBe(true)

  field.reset()
  expect(fruits()).toEqual([])
  expect(fruits.item('apple').checked()).toBe(false)
})

// --- prop records: native checkbox ------------------------------------------

test('native checkbox props carry the native attributes, not the role', () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
  const { control } = checkboxProps(fruits.item('apple'), {
    nativeName: 'fruits',
    labelledBy: 'fruits-apple-label',
    describedBy: 'fruits-hint',
  })

  expect(control()).toMatchObject({
    role: undefined,
    type: 'checkbox',
    name: 'fruits',
    value: 'apple',
    checked: false,
    disabled: undefined,
    tabIndex: undefined,
    'aria-checked': 'false',
    'aria-disabled': undefined,
    'aria-readonly': undefined,
    'aria-labelledby': 'fruits-apple-label',
    'aria-describedby': 'fruits-hint',
  })
  // the browser activates a native checkbox on its own
  expect(control().onKeyDown).toBe(undefined)
  expect(typeof control().onChange).toBe('function')
  expect(typeof control().onClick).toBe('function')
  expect(typeof control().ref).toBe('function')
})

test('aria-checked follows the tri-state flag', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms)

  expect(control()['aria-checked']).toBe('false')
  expect(control().checked).toBe(false)

  terms.toggle()
  expect(control()['aria-checked']).toBe('true')
  expect(control().checked).toBe(true)

  terms.set('mixed')
  expect(control()['aria-checked']).toBe('mixed')
  // `'mixed'` has no native `checked` form
  expect(control().checked).toBe(false)
})

test('a native change event drives the model with its own checked flag', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms)

  control().onChange({ currentTarget: { checked: true } })
  expect(terms()).toBe(true)

  // an idempotent event does not flip the state back
  control().onChange({ currentTarget: { checked: true } })
  expect(terms()).toBe(true)

  control().onChange({ currentTarget: { checked: false } })
  expect(terms()).toBe(false)
})

test('a native click is ignored, because the change event follows it', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms)

  control().onClick({})
  expect(terms()).toBe(false)
})

test('a disabled native checkbox stops the change event', () => {
  const terms = reatomCheckbox({ disabled: true, name: 'terms' })
  const { control } = checkboxProps(terms)
  const preventDefault = vi.fn()
  const stopPropagation = vi.fn()

  control().onChange({
    currentTarget: { checked: true },
    preventDefault,
    stopPropagation,
  })

  expect(terms()).toBe(false)
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(stopPropagation).toHaveBeenCalledOnce()
  expect(control().disabled).toBe(true)
  expect(control()['aria-disabled']).toBe(undefined)
})

test('a read-only checkbox refuses the change but stays enabled', () => {
  const terms = reatomCheckbox({ readOnly: true, name: 'terms' })
  const { control } = checkboxProps(terms)
  const preventDefault = vi.fn()

  control().onChange({ currentTarget: { checked: true }, preventDefault })

  expect(terms()).toBe(false)
  // read-only is not disabled: the event is not cancelled, the DOM is written
  // back by `reatomCheckboxElementSync` instead
  expect(preventDefault).not.toHaveBeenCalled()
  expect(control().disabled).toBe(undefined)
  expect(control()['aria-readonly']).toBe('true')
})

test('the ref assigns the model element handle', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms)
  const element = { tagName: 'INPUT' } as unknown as HTMLElement

  control().ref(element)
  expect(terms.element()).toBe(element)

  control().ref(null)
  expect(terms.element()).toBe(null)
})

// --- prop records: custom checkbox ------------------------------------------

test('custom checkbox props add the role, tabindex, and keyboard handling', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms, { native: false })

  expect(control()).toMatchObject({
    role: 'checkbox',
    type: undefined,
    name: undefined,
    value: undefined,
    tabIndex: 0,
    'aria-checked': 'false',
  })
  expect(typeof control().onKeyDown).toBe('function')

  terms.disabled.set(true)
  expect(control()).toMatchObject({
    tabIndex: -1,
    'aria-disabled': 'true',
    // a non-native element has no `disabled` property to set
    disabled: undefined,
  })
})

test('a custom checkbox toggles on click', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms, { native: false })

  control().onClick({})
  expect(terms()).toBe(true)
  control().onClick({})
  expect(terms()).toBe(false)

  // a caller that already handled the event wins
  control().onClick({ defaultPrevented: true })
  expect(terms()).toBe(false)
})

test('a disabled custom checkbox cancels the click event', () => {
  const terms = reatomCheckbox({ disabled: true, name: 'terms' })
  const { control } = checkboxProps(terms, { native: false })
  const preventDefault = vi.fn()
  const stopPropagation = vi.fn()

  control().onClick({ preventDefault, stopPropagation })

  expect(terms()).toBe(false)
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(stopPropagation).toHaveBeenCalledOnce()
})

test('a custom checkbox toggles on Space and Enter', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms, { native: false })
  const onKeyDown = control().onKeyDown!
  const preventDefault = vi.fn()

  onKeyDown({ key: ' ', preventDefault })
  expect(terms()).toBe(true)
  // Space would scroll the page and produce a synthetic click on a button
  expect(preventDefault).toHaveBeenCalledOnce()

  // `clickOnEnter` defaults to `!native`
  onKeyDown({ key: 'Enter' })
  expect(terms()).toBe(false)

  onKeyDown({ key: 'Tab' })
  onKeyDown({ key: 'a' })
  onKeyDown({ key: 'Escape' })
  expect(terms()).toBe(false)
})

test('clickOnEnter can be turned off', () => {
  const terms = reatomCheckbox({ name: 'terms' })
  const { control } = checkboxProps(terms, {
    native: false,
    clickOnEnter: false,
  })
  const onKeyDown = control().onKeyDown!

  onKeyDown({ key: 'Enter' })
  expect(terms()).toBe(false)

  onKeyDown({ key: ' ' })
  expect(terms()).toBe(true)
})

test('a guarded custom checkbox ignores the keyboard without cancelling it', () => {
  const terms = reatomCheckbox({ disabled: true, name: 'terms' })
  const { control } = checkboxProps(terms, { native: false })
  const onKeyDown = control().onKeyDown!
  const preventDefault = vi.fn()

  onKeyDown({ key: ' ', preventDefault })
  expect(terms()).toBe(false)
  expect(preventDefault).not.toHaveBeenCalled()

  terms.disabled.set(false)
  terms.readOnly.set(true)
  onKeyDown({ key: ' ', preventDefault })
  expect(terms()).toBe(false)
  expect(preventDefault).not.toHaveBeenCalled()
})

// --- prop records: reactivity ----------------------------------------------

test('records are memoized while shallowly equal and re-emit on change', async () => {
  const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
  const apple = checkboxProps(fruits.item('apple'))
  const records: Array<unknown> = []
  const un = apple.control.subscribe((record) => records.push(record))

  expect(records).toHaveLength(1)

  // an unrelated item changes the shared value atom, but not apple's props
  fruits.item('orange').toggle()
  await null
  expect(records).toHaveLength(1)
  expect(apple.control()).toBe(records[0])

  fruits.item('apple').toggle()
  await null
  expect(records).toHaveLength(2)
  expect(apple.control()['aria-checked']).toBe('true')

  // handlers keep their identity across updates
  expect(apple.control().onChange).toBe(
    (records[0] as { onChange: unknown }).onChange,
  )

  un()
})

test('every item of a group gets its own record', () => {
  const fruits = reatomCheckbox<Array<string>>({
    value: ['apple'],
    name: 'fruits',
  })
  const apple = checkboxProps(fruits.item('apple'), { nativeName: 'fruits' })
  const orange = checkboxProps(fruits.item('orange'), { nativeName: 'fruits' })

  expect(apple.control.name).toBe('fruits#apple.props.control')
  expect(apple.control().value).toBe('apple')
  expect(apple.control()['aria-checked']).toBe('true')
  expect(orange.control().value).toBe('orange')
  expect(orange.control()['aria-checked']).toBe('false')

  orange.control().onChange({ currentTarget: { checked: true } })
  expect(fruits()).toEqual(['apple', 'orange'])
  expect(orange.control()['aria-checked']).toBe('true')
})
