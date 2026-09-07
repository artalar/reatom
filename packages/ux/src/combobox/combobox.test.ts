import type { Atom } from '@reatom/core'
import {
  atom,
  context,
  effect,
  getCalls,
  notify,
  peek,
  reatomField,
} from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { reatomComposite } from '../composite/reatomComposite'
import { reatomTag } from '../tag/reatomTag'
import type { ComboboxSelectedValue } from './comboboxValue'
import { comboboxItemRole, isComboboxMultiSelectableRole } from './props'
import type { Combobox } from './reatomCombobox'
import { reatomCombobox } from './reatomCombobox'
import { withComboboxAutoSelect } from './reatomComboboxDom'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but the composite derivations
 * depend on whether an item _has_ an element, and two handlers call `focus()`.
 * Everything that needs a real element — the caret, DOM focus, the deferred
 * show on `mouseup` — is in `combobox.test.browser.ts`.
 */
const element = (): HTMLElement & { focused: number } => {
  const fake = {
    focused: 0,
    focus: () => void fake.focused++,
    // `hasFocus` reads it, and nothing has DOM focus in a node test
    ownerDocument: { activeElement: null },
  }
  return fake as unknown as HTMLElement & { focused: number }
}

/**
 * A self-targeted event, which is what every combobox handler expects. `init`
 * has a default rather than being optional so that its keys stay _required_ in
 * the result — an optional spread would widen `key` to `key?: string`, which no
 * keyboard handler accepts.
 */
const event = <T extends object>(target: unknown, init: T = {} as T) => ({
  target,
  currentTarget: target,
  preventDefault() {
    prevented.add(this)
  },
  ...init,
})

/** Events whose default was prevented, so a test can assert on it. */
const prevented = new WeakSet<object>()

/** Puts a value and a caret on a fake input, as the browser would. */
const typed = (input: HTMLElement, value: string, caret = value.length) =>
  Object.assign(input, { value, selectionStart: caret, selectionEnd: caret })

/**
 * Mounts a combobox the way a view adapter does: one element per item value, in
 * order, then the input. The input is the composite element, not an item — that
 * is what `includesBaseElement` means.
 */
const mount = (combobox: Combobox, values: Array<string> = []) => {
  const items = new Map<string, ReturnType<typeof element>>()

  for (const value of values) {
    const el = element()
    items.set(value, el)
    combobox.props.item(value)().ref(el)
  }

  const input = element()
  typed(input, peek(combobox))
  combobox.props.input().ref(input)

  return { input, items }
}

/** Types into the input, i.e. what a keystroke does end to end. */
const type = (
  combobox: Combobox,
  input: HTMLElement,
  value: string,
  inputType = 'insertText',
) => {
  typed(input, value)
  combobox.props.input().onInput(event(input, { inputType }))
}

// --- the model ---------------------------------------------------------------

test('a combobox is a composite of the items plus the popover that holds them', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  expect(fruit()).toBe('')
  expect(fruit.selectedValue()).toBe('')
  expect(fruit.activeValue()).toBe(undefined)
  expect(fruit.multiSelectable()).toBe(false)
  expect(fruit.popover()).toBe(false)
  expect(fruit.tag).toBe(null)

  // the input is the composite element, so its id is the widget id
  expect(fruit.composite.id()).toBe('fruit')
  expect(fruit.popover.contentId()).toBe('fruit-list')

  // nothing is registered until the view renders the elements
  expect(fruit.composite.items.ids()).toEqual([])
})

test("Ariakit's five composite overrides and the popover placement", () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  // `createComboboxStore` differs from `createCompositeStore` in exactly these
  expect(fruit.composite()).toBe(null)
  expect(fruit.composite.includesBaseElement()).toBe(true)
  expect(fruit.composite.orientation()).toBe('vertical')
  expect(fruit.composite.focusLoop()).toBe(true)
  expect(fruit.composite.focusWrap()).toBe(true)
  expect(fruit.composite.virtualFocus()).toBe(true)
  expect(fruit.popover.placement()).toBe('bottom-start')

  // and a popover is not modal, unlike a plain dialog
  expect(fruit.popover.modal()).toBe(false)
})

test('the three values are three different things', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  // what the user typed
  fruit.set('ap')
  expect(fruit()).toBe('ap')
  expect(fruit.selectedValue()).toBe('')
  expect(fruit.activeValue()).toBe(undefined)

  // what the keyboard reached
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
  expect(fruit.activeValue()).toBe('Apple')
  expect(fruit()).toBe('ap')

  // what was picked
  fruit.select('Apple')
  expect(fruit.selectedValue()).toBe('Apple')
  expect(fruit()).toBe('ap')
})

// --- selectedValue -----------------------------------------------------------

test('select replaces the selection on a single-selectable combobox', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  expect(fruit.select('Apple')).toBe('Apple')
  expect(fruit.select('Orange')).toBe('Orange')
  expect(fruit.isSelected('Orange')).toBe(true)
  expect(fruit.isSelected('Apple')).toBe(false)
})

test('an array selectedValue is what makes the combobox multi-selectable', () => {
  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })

  expect(fruits.multiSelectable()).toBe(true)
  // …and it flips two defaults, exactly as Ariakit's `multiSelectable` does
  expect(fruits.resetValueOnSelect()).toBe(true)
  expect(fruits.resetValueOnHide()).toBe(true)

  fruits.select('Apple')
  fruits.select('Orange')
  expect(fruits.selectedValue()).toEqual(['Apple', 'Orange'])

  // picking a selected value toggles it off
  fruits.select('Apple')
  expect(fruits.selectedValue()).toEqual(['Orange'])
  expect(fruits.isSelected('Apple')).toBe(false)
})

test('selectedValueAtom adopts a caller-owned atom, e.g. a form field', () => {
  const field = reatomField('', 'form.fields.fruit')
  const fruit = reatomCombobox({ selectedValueAtom: field, name: 'fruit' })

  fruit.select('Apple')
  expect(field()).toBe('Apple')

  field.set('Orange')
  expect(fruit.isSelected('Orange')).toBe(true)
})

test('either value or valueAtom, either selectedValue or selectedValueAtom', () => {
  expect(() =>
    reatomCombobox({ value: 'ap', valueAtom: atom('', 'v'), name: 'a' }),
  ).toThrow('pass either "value" or "valueAtom"')

  expect(() =>
    reatomCombobox({
      selectedValue: 'Apple',
      selectedValueAtom: atom<ComboboxSelectedValue>('', 's'),
      name: 'b',
    }),
  ).toThrow('pass either "selectedValue" or "selectedValueAtom"')
})

// --- activeValue: the mouse-vs-keyboard discrimination -----------------------

test('activeValue follows a keyboard move', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.composite.navigate({ move: 'first' })
  expect(fruit.activeValue()).toBe('Apple')

  fruit.composite.navigate({ move: 'next' })
  expect(fruit.activeValue()).toBe('Orange')

  // `move(null)` is the input, which has no value
  fruit.composite.move(null)
  expect(fruit.activeValue()).toBe(undefined)
})

test('activeValue does not follow a hover, a DOM focus, or a plain write', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { items } = mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.composite.navigate({ move: 'first' })
  expect(fruit.activeValue()).toBe('Apple')

  // a hover, through the item record: `set`, not `move`
  fruit.props.item('Orange')().onMouseMove?.()
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  // …and with `focusOnHover` the item does become active, without a value
  const hovering = reatomCombobox({ focusOnHover: true, name: 'hovering' })
  mount(hovering, ['Apple', 'Orange'])
  hovering.popover.show()
  hovering.composite.navigate({ move: 'first' })
  expect(hovering.activeValue()).toBe('Apple')

  hovering.props.item('Orange')().onMouseMove()
  expect(hovering.composite()).toBe(hovering.itemId('Orange'))
  expect(hovering.activeValue()).toBe(undefined)

  // a plain write is Ariakit's `setActiveId`, which is silent too
  hovering.composite.set(hovering.itemId('Apple'))
  expect(hovering.activeValue()).toBe(undefined)

  // and a DOM focus event on an item, which is the roving-tabindex path
  hovering.composite.move(hovering.itemId('Apple'))
  expect(hovering.activeValue()).toBe('Apple')
  hovering.props
    .item('Orange')()
    .onFocus(event(items.get('Orange')))
  expect(hovering.activeValue()).toBe(undefined)
})

test('re-activating the item a move just reached keeps activeValue', () => {
  // The roving-tabindex sequence: `move` focuses the element, the element's own
  // focus handler writes the same id back. That write must not undo the move —
  // Ariakit's guard is the same "did the activeId actually change".
  const fruit = reatomCombobox({ virtualFocus: false, name: 'fruit' })
  const { items } = mount(fruit, ['Apple'])
  fruit.popover.show()

  fruit.composite.navigate({ move: 'first' })
  expect(fruit.activeValue()).toBe('Apple')

  fruit.props
    .item('Apple')()
    .onFocus(event(items.get('Apple')))
  expect(fruit.activeValue()).toBe('Apple')
})

test('closing the popover resets the active id and the active value', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  fruit.popover.show()
  fruit.composite.navigate({ move: 'last' })
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  expect(fruit.activeValue()).toBe('Orange')

  fruit.popover.hide()
  // back to the input, so reopening the list starts at the field again
  expect(fruit.composite()).toBe(null)
  expect(fruit.activeValue()).toBe(undefined)
})

test('an explicit activeId is what the popover resets to', () => {
  const fruit = reatomCombobox({ activeId: 'seed', name: 'fruit' })

  expect(fruit.composite()).toBe('seed')
  fruit.popover.show()
  fruit.composite.set('other')
  fruit.popover.hide()
  expect(fruit.composite()).toBe('seed')
})

// --- resetValueOnSelect ------------------------------------------------------

test('resetValueOnSelect defaults to multi-selectable and is a per-call override', () => {
  const fruit = reatomCombobox({ value: 'ap', name: 'fruit' })
  expect(fruit.resetValueOnSelect()).toBe(false)

  fruit.set('or')
  fruit.select('Orange')
  expect(fruit()).toBe('or')

  // the per-item prop Ariakit deprecated the store flag for
  fruit.select('Apple', true)
  expect(fruit()).toBe('ap')
})

test('a multi-selectable combobox clears the filter after every pick', () => {
  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })

  fruits.set('ap')
  fruits.select('Apple')
  expect(fruits()).toBe('')
  expect(fruits.selectedValue()).toEqual(['Apple'])

  // and the reset happens *before* the selection, so a `setValueOnClick` that
  // runs after it still wins
  fruits.set('or')
  fruits.select('Orange', false)
  expect(fruits()).toBe('or')
})

// --- resetValueOnHide --------------------------------------------------------

test('resetValueOnHide restores the initial value when the popover unmounts', () => {
  const fruit = reatomCombobox({
    value: 'seed',
    resetValueOnHide: true,
    name: 'fruit',
  })

  fruit.popover.show()
  fruit.set('typed')
  expect(fruit()).toBe('typed')

  fruit.popover.hide()
  expect(fruit()).toBe('seed')
})

test('the reset waits for the unmount, so an animated list does not clear early', () => {
  const fruit = reatomCombobox({
    value: 'seed',
    resetValueOnHide: true,
    animated: true,
    name: 'fruit',
  })
  const un = fruit.popover.mounted.subscribe(() => {})

  fruit.popover.show()
  fruit.set('typed')
  fruit.popover.hide()

  // still on screen, still animating out
  expect(fruit.popover.mounted()).toBe(true)
  expect(fruit()).toBe('typed')

  fruit.popover.animating.set(false)
  expect(fruit.popover.mounted()).toBe(false)
  expect(fruit()).toBe('seed')
  un()
})

test('resetValueOnHide is off by default, and off with a tag list', () => {
  expect(reatomCombobox({ name: 'a' }).resetValueOnHide()).toBe(false)
  expect(
    reatomCombobox({ selectedValue: [], name: 'b' }).resetValueOnHide(),
  ).toBe(true)
  // Ariakit's `multiSelectable && !tag`: the tag layer owns the draft text
  expect(
    reatomCombobox({
      selectedValue: [],
      tag: reatomTag({ name: 'c.tag' }),
      name: 'c',
    }).resetValueOnHide(),
  ).toBe(false)
})

test('the reset reaches an adopted value atom, which is where the state lives', () => {
  const field = reatomField('seed', 'form.fields.query')
  const fruit = reatomCombobox({
    valueAtom: field,
    resetValueOnHide: true,
    name: 'fruit',
  })

  fruit.popover.show()
  fruit.set('typed')
  expect(field()).toBe('typed')
  expect(fruit()).toBe('typed')

  fruit.popover.hide()
  expect(field()).toBe('seed')
  expect(fruit()).toBe('seed')
})

// --- autoComplete and the inline completion ----------------------------------

test('the default `list` mode never changes the displayed value', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])
  fruit.popover.show()

  expect(fruit.autoComplete()).toBe('list')
  expect(fruit.inline()).toBe(false)
  expect(fruit.canInline()).toBe(false)

  fruit.set('ap')
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.activeValue()).toBe('Apple')
  expect(fruit.displayValue()).toBe('ap')
})

test('`inline` shows the active item value without touching the state', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  expect(fruit.inline()).toBe(true)
  expect(fruit.canInline()).toBe(true)

  fruit.set('ap')
  fruit.composite.navigate({ move: 'last' })
  expect(fruit.displayValue()).toBe('Orange')
  // "This will only affect the element's value, not the combobox state"
  expect(fruit()).toBe('ap')

  fruit.composite.move(null)
  expect(fruit.displayValue()).toBe('ap')
})

test('an auto-selected first item only appends the completion string', () => {
  const fruit = reatomCombobox({
    autoComplete: 'both',
    autoSelect: true,
    name: 'fruit',
  })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.set('ap')
  fruit.autoSelectFirst()
  expect(fruit.activeValue()).toBe('Apple')
  // the typed prefix survives, only the tail is borrowed: 'ap' + 'ple'
  expect(fruit.displayValue()).toBe('apple')

  // a second item is not the auto-selected one, so it replaces the value
  fruit.composite.navigate({ move: 'next' })
  expect(fruit.displayValue()).toBe('Orange')
})

test('an already selected value is never inlined', () => {
  const fruits = reatomCombobox({
    autoComplete: 'inline',
    selectedValue: ['Apple'],
    name: 'fruits',
  })
  mount(fruits, ['Apple', 'Orange'])
  fruits.popover.show()

  fruits.set('ap')
  fruits.composite.navigate({ move: 'first' })
  expect(fruits.activeValue()).toBe('Apple')
  // picking it again would *de*select it, so promising it as a completion would
  // be the opposite of what Enter does
  expect(fruits.displayValue()).toBe('ap')
})

test('canInline is enabled by a move and disabled by an edit away from the end', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.popover.show()

  // a deletion must not be completed: the user is removing characters
  type(fruit, input, 'a', 'deleteContentBackward')
  expect(fruit.canInline()).toBe(false)

  // …and a move re-enables it, which is what Ariakit's custom
  // `combobox-item-move` DOM event does
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.canInline()).toBe(true)
  expect(fruit.displayValue()).toBe('Apple')

  // an insertion before the end must not be completed either
  typed(input, 'ap', 1)
  fruit.props.input().onInput(event(input, { inputType: 'insertText' }))
  expect(fruit.canInline()).toBe(false)
  expect(fruit.displayValue()).toBe('ap')
})

test('a move to nowhere leaves canInline alone', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  type(fruit, input, 'x', 'deleteContentBackward')
  expect(fruit.canInline()).toBe(false)

  // `undefined` is the "nowhere to go" result of a navigation query
  fruit.composite.move(undefined)
  expect(fruit.canInline()).toBe(false)
})

// --- autoSelect --------------------------------------------------------------

test('autoSelect needs virtual focus, and typing, to apply', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })

  expect(fruit.autoSelect()).toBe(true)
  expect(fruit.autoSelectEnabled()).toBe(true)
  // nothing typed yet
  expect(fruit.autoSelecting()).toBe(false)

  fruit.canAutoSelect.set(true)
  expect(fruit.autoSelecting()).toBe(true)

  // "we can only allow auto select when the combobox focus is handled via the
  // aria-activedescendant attribute"
  fruit.composite.virtualFocus.set(false)
  expect(fruit.autoSelectEnabled()).toBe(false)
  expect(fruit.autoSelecting()).toBe(false)
})

test('autoSelectFirst prefers an enabled item that has a value', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  // a tab-like item with no value, which is why Ariakit skips `role="tab"`
  fruit.composite.items.renderItem({ id: 'tab', element: element() })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.composite.first()).toBe('tab')
  expect(fruit.autoSelectFirst()).toBe(fruit.itemId('Apple'))
  expect(fruit.activeValue()).toBe('Apple')
})

test('autoSelectFirst skips a disabled item, and falls back to the input', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { items } = mount(fruit, ['Apple', 'Orange'])
  fruit.renderItem('Apple', { disabled: true, element: items.get('Apple') })

  expect(fruit.autoSelectFirst()).toBe(fruit.itemId('Orange'))

  // "If there's no first item […] we should move the focus to the input (null),
  // otherwise, with async items, the activeValue won't be reset."
  const empty = reatomCombobox({ name: 'empty' })
  mount(empty)
  expect(empty.autoSelectFirst()).toBe(null)
  expect(empty.activeValue()).toBe(undefined)
})

test('withComboboxAutoSelect activates the first item as the user types', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
    withComboboxAutoSelect(),
  )
  // no input element: the "the input must still hold focus" guard needs a real
  // one, so DOM focus is `combobox.test.browser.ts`' business
  fruit.props.item('Apple')().ref(element())
  fruit.props.item('Orange')().ref(element())

  const un = fruit.subscribe(() => {})
  expect(fruit.composite()).toBe(null)

  fruit.popover.show()
  // placed, so the auto-select is not held back — the test below is about that
  fruit.popover.positioned.set(true)
  fruit.canAutoSelect.set(true)
  fruit.set('ap')
  notify()
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  // an item list that arrives late is caught too
  fruit.props.item('Avocado')().ref(element())
  fruit.composite.items.move(fruit.item('Avocado')!, null)
  notify()
  expect(fruit.composite()).toBe(fruit.itemId('Avocado'))
  un()
})

test('auto-select does not move to and refocus the same item on every keystroke', async () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
    withComboboxAutoSelect(),
  )
  fruit.props.item('Apple')().ref(element())

  const moves: Array<string | null | undefined> = []
  const stopTracking = effect(() => {
    for (const call of getCalls(fruit.composite.move)) {
      moves.push(call.params[0])
    }
  }, 'fruit.moves')
  const unsubscribe = fruit.subscribe(() => {})

  fruit.popover.show()
  fruit.popover.positioned.set(true)
  fruit.canAutoSelect.set(true)
  fruit.set('a')
  notify()
  await null

  fruit.set('ap')
  notify()
  await null

  expect(moves).toEqual([fruit.itemId('Apple')])
  unsubscribe()
  stopTracking()
})

test('withComboboxAutoSelect waits for the popover to be placed', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
    withComboboxAutoSelect(),
  )
  fruit.props.item('Apple')().ref(element())
  const un = fruit.subscribe(() => {})

  fruit.popover.show()
  fruit.canAutoSelect.set(true)
  fruit.set('ap')
  notify()
  // `placing` is Ariakit's private `data-placing`, which it observes "to prevent
  // the focus from moving to the first item while the popover is still
  // calculating its position"
  expect(fruit.popover.placing()).toBe(true)
  expect(fruit.composite()).toBe(null)

  fruit.popover.positioned.set(true)
  notify()
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
  un()
})

test('withComboboxAutoSelect stops reacting once the model disconnects', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' }).extend(
    withComboboxAutoSelect(),
  )
  fruit.props.item('Apple')().ref(element())

  // connect, settle an open and placed popover, then disconnect the model
  const un = fruit.subscribe(() => {})
  fruit.popover.show()
  fruit.popover.positioned.set(true)
  notify()
  un()
  notify()

  // Arming the auto-select after the model disconnected must move nothing: the
  // observer effect is torn down with the connection, not leaked past it. Before
  // the fix the effect read the value atom that owned its own connect hook, so
  // the model never disconnected and this still moved to the first item.
  fruit.canAutoSelect.set(true)
  notify()
  expect(fruit.composite()).toBe(null)
})

// --- the Safari-touch virtualFocus override ----------------------------------

test('touchSafari forces virtual focus off, and keeps forcing it', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  expect(fruit.composite.virtualFocus()).toBe(true)
  expect(fruit.props.input()['aria-activedescendant']).toBe(
    fruit.itemId('Apple'),
  )

  fruit.touchSafari.set(true)
  expect(fruit.composite.virtualFocus()).toBe(false)
  // the attribute is the whole reason for the override: it is broken there
  expect(fruit.props.input()['aria-activedescendant']).toBe(undefined)

  // Ariakit rewrites the state on *every* write, so a later opt-in loses too
  fruit.composite.virtualFocus.set(true)
  expect(fruit.composite.virtualFocus()).toBe(false)

  // …and the override is one-way, like Ariakit's `setState('virtualFocus',
  // false)`: clearing the flag does not restore what it overwrote, it only
  // stops overwriting
  fruit.touchSafari.set(false)
  expect(fruit.composite.virtualFocus()).toBe(false)
  fruit.composite.virtualFocus.set(true)
  expect(fruit.composite.virtualFocus()).toBe(true)
})

test('touchSafari also disables the auto-select, as Ariakit derives it', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })
  fruit.canAutoSelect.set(true)
  expect(fruit.autoSelecting()).toBe(true)

  fruit.touchSafari.set(true)
  expect(fruit.autoSelecting()).toBe(false)
})

// --- the item registry -------------------------------------------------------

test('item ids are derived from the values and stay stable', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  // a pure function of the value: the same value is the same id, with no counter
  expect(fruit.itemId('Apple')).toBe('fruit-item-Apple')
  expect(fruit.itemId('Orange')).toBe('fruit-item-Orange')
  expect(fruit.itemId('Apple')).toBe('fruit-item-Apple')

  // an arbitrary value would be an invalid `id`, so an unsafe one is encoded
  expect(fruit.itemId('a b, c')).toBe('fruit-item-s-61-20-62-2c-20-63')

  // the value is read back from the rendered item, where `renderItem` stored it
  mount(fruit, ['Apple'])
  expect(fruit.itemValue(fruit.itemId('Apple'))).toBe('Apple')
  expect(fruit.itemValue(null)).toBe(undefined)
  expect(fruit.itemValue('unknown')).toBe(undefined)
})

test('item ids are the same across contexts, whatever the allocation order', () => {
  // Two models allocate the same value in a different order. A counter would tie
  // the id to that order — and so to request history under SSR — while a
  // value-derived id stays identical, which is what keeps hydration stable.
  const a = reatomCombobox({ name: 'x' })
  a.itemId('Orange')
  const appleInA = a.itemId('Apple')

  const b = reatomCombobox({ name: 'x' })
  const appleInB = b.itemId('Apple')

  expect(appleInA).toBe(appleInB)
})

test('an item survives an unmount and remount with the same id', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { items } = mount(fruit, ['Apple'])

  const id = fruit.itemId('Apple')
  expect(fruit.item('Apple')?.id).toBe(id)
  expect(fruit.composite.items.ids()).toEqual([id])

  expect(fruit.unrenderItem('Apple')).toBe(true)
  expect(fruit.item('Apple')).toBe(null)
  expect(fruit.unrenderItem('Apple')).toBe(false)
  expect(fruit.unrenderItem('Unknown')).toBe(false)

  fruit.renderItem('Apple', { element: items.get('Apple') })
  expect(fruit.item('Apple')?.id).toBe(id)
})

test('an item registers its value as the typeahead text', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])
  expect(fruit.item('Apple')?.text()).toBe('Apple')
})

// --- the tag composition -----------------------------------------------------

test('a tag combobox shares the input value and the selection, not copies', () => {
  const invitees = reatomTag({ name: 'invitees' })
  const combobox = reatomCombobox({ tag: invitees, name: 'invitees.combobox' })

  expect(combobox.tag).toBe(invitees)
  expect(combobox.multiSelectable()).toBe(true)

  // one field: the tag input's value *is* the combobox value
  combobox.set('ja')
  expect(invitees.value()).toBe('ja')
  invitees.value.set('jsx')
  expect(combobox()).toBe('jsx')

  // one selection: the tags *are* the selected values
  combobox.select('jsx')
  expect(invitees.values()).toEqual(['jsx'])
  invitees.addValue('react')
  expect(combobox.selectedValue()).toEqual(['jsx', 'react'])
  expect(combobox.isSelected('react')).toBe(true)
})

test('a tag combobox follows the tag list direction unless told otherwise', () => {
  const rtlTag = reatomTag({ rtl: true, name: 'rtl.tag' })
  expect(reatomCombobox({ tag: rtlTag, name: 'a' }).composite.rtl()).toBe(true)

  rtlTag.rtl.set(false)
  expect(reatomCombobox({ tag: rtlTag, name: 'b' }).composite.rtl()).toBe(false)

  // an explicit flag wins and is not overridden afterwards
  const fixed = reatomCombobox({ tag: rtlTag, rtl: true, name: 'c' })
  rtlTag.rtl.set(true)
  expect(fixed.composite.rtl()).toBe(true)
})

test('a tag combobox does not store the typed text itself', () => {
  const invitees = reatomTag({ name: 'invitees' })
  const combobox = reatomCombobox({ tag: invitees, name: 'invitees.combobox' })
  const { input } = mount(combobox, ['jsx'])

  // `setValueOnChange` defaults to "no tag": the tag input owns the text, and
  // writing it here would race its own delimiter handling
  type(combobox, input, 'rea')
  expect(combobox()).toBe('')
})

// --- the prop records --------------------------------------------------------

test('the input record is the whole combobox contract', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])

  expect(fruit.props.input()).toMatchObject({
    id: 'fruit',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-haspopup': 'listbox',
    'aria-expanded': false,
    'aria-controls': 'fruit-list',
    'aria-activedescendant': undefined,
    'data-active-item': true,
    value: '',
    autoComplete: 'off',
    tabIndex: 0,
  })

  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.props.input()).toMatchObject({
    'aria-expanded': true,
    'aria-activedescendant': 'fruit-item-Apple',
    'data-active-item': undefined,
  })

  expect(fruit.props.label()).toEqual({ htmlFor: 'fruit' })
})

test('the input ref is the composite element, the anchor, and the disclosure', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const input = element()

  fruit.props.input().ref(input)
  expect(fruit.composite.baseElement()).toBe(input)
  // "The combobox input should remain the disclosure element so focus and
  // Escape handling keep working"
  expect(fruit.popover.anchorElement()).toBe(input)
  expect(fruit.popover.disclosureElement()).toBe(input)

  fruit.props.input().ref(null)
  expect(fruit.composite.baseElement()).toBe(null)
})

// ariakit-components/src/combobox/combobox-store.ts:133-157 — the combobox syncs
// the anchor from `baseElement || disclosureElement`, so the input anchors the
// list even when another element is the disclosure.
test('the input anchors the list over the disclosure element', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const input = element()
  const button = element()

  fruit.popover.disclosureElement.set(button)
  expect(fruit.popover.anchorElement()).toBe(button)

  fruit.props.input().ref(input)
  expect(fruit.popover.anchorElement()).toBe(input)
  expect(fruit.popover.anchorFallbackElement()).toBe(input)
})

test('an explicit anchor wins over the combobox input', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const input = element()
  const anchor = element()

  fruit.popover.props.anchor().ref(anchor)
  fruit.props.input().ref(input)

  expect(fruit.popover.anchorElement()).toBe(anchor)
  expect(fruit.popover.anchorFallbackElement()).toBe(input)

  // …and the input takes over again once the anchor unmounts
  fruit.popover.props.anchor().ref(null)
  expect(fruit.popover.anchorElement()).toBe(input)
})

test('the list record carries the popup role and the multi-selectable flag', () => {
  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })

  expect(fruits.props.list()).toMatchObject({
    id: 'fruits-list',
    role: 'listbox',
    'aria-multiselectable': true,
    hidden: true,
    style: { display: 'none' },
  })

  fruits.popover.show()
  expect(fruits.props.list()).toMatchObject({ hidden: false, style: undefined })

  const list = element()
  fruits.props.list().ref(list)
  expect(fruits.popover.contentElement()).toBe(list)
})

test('a menu popup announces no aria-multiselectable and renders menuitems', () => {
  const menu = reatomCombobox({
    popupRole: 'menu',
    selectedValue: [],
    name: 'menu',
  })

  expect(menu.props.list()['aria-multiselectable']).toBe(undefined)
  expect(menu.props.input()['aria-haspopup']).toBe('menu')
  expect(menu.props.item('Apple')().role).toBe('menuitem')

  expect(comboboxItemRole('listbox')).toBe('option')
  expect(comboboxItemRole('tree')).toBe('treeitem')
  expect(comboboxItemRole('dialog')).toBe('option')
  expect(isComboboxMultiSelectableRole('grid')).toBe(true)
  expect(isComboboxMultiSelectableRole('menu')).toBe(false)
})

test('the popover record is the list on the popover element', () => {
  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })
  fruits.popover.show()

  const record = fruits.props.popover()
  expect(record.role).toBe('listbox')
  expect(record['aria-multiselectable']).toBe(true)
  // …with everything the popover's own content record carries
  expect(record.id).toBe('fruits-list')
  expect(record['data-dialog']).toBe('')
  expect(record['data-placing']).toBe(true)
  expect(record.style).toMatchObject({ position: 'relative' })
})

test('the item record is memoized per value and keyed by it', () => {
  const fruit = reatomCombobox({ name: 'fruit' })

  expect(fruit.props.item('Apple')).toBe(fruit.props.item('Apple'))
  expect(fruit.props.item('Apple')).not.toBe(fruit.props.item('Orange'))
  // passing options returns a fresh, uncached record
  expect(fruit.props.item('Apple', { hideOnClick: false })).not.toBe(
    fruit.props.item('Apple'),
  )
})

test('aria-selected is only announced on a multi-selectable combobox', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])
  fruit.select('Apple')
  // on a single-selectable list `aria-selected` would announce the *active*
  // item, which is not what Enter on it would do
  expect(fruit.props.item('Apple')()['aria-selected']).toBe(undefined)

  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })
  mount(fruits, ['Apple', 'Orange'])
  expect(fruits.props.item('Apple')()['aria-selected']).toBe(false)
  fruits.select('Apple')
  expect(fruits.props.item('Apple')()['aria-selected']).toBe(true)
  expect(fruits.props.item('Orange')()['aria-selected']).toBe(false)

  // a multi-selectable `grid` still omits it — `aria-selected` is invalid there
  const grid = reatomCombobox({
    selectedValue: [],
    popupRole: 'grid',
    name: 'grid',
  })
  mount(grid, ['Apple'])
  grid.select('Apple')
  expect(grid.props.item('Apple')()['aria-selected']).toBe(undefined)
})

test('no item is tabbable with virtual focus, and one is without it', () => {
  const virtual = reatomCombobox({ name: 'virtual' })
  mount(virtual, ['Apple', 'Orange'])
  expect(virtual.props.item('Apple')().tabIndex).toBe(-1)
  expect(virtual.props.item('Orange')().tabIndex).toBe(-1)
  expect(virtual.props.input().tabIndex).toBe(0)

  const roving = reatomCombobox({ virtualFocus: false, name: 'roving' })
  mount(roving, ['Apple', 'Orange'])
  roving.popover.show()
  roving.composite.navigate({ move: 'first' })
  expect(roving.props.item('Apple')().tabIndex).toBe(undefined)
  expect(roving.props.item('Orange')().tabIndex).toBe(-1)
  expect(roving.props.input().tabIndex).toBe(undefined)
})

test('the item ref registers and unregisters the item', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const el = element()

  fruit.props.item('Apple')().ref(el)
  expect(fruit.item('Apple')?.element()).toBe(el)

  fruit.props.item('Apple')().ref(null)
  expect(fruit.item('Apple')).toBe(null)
})

// --- typing ------------------------------------------------------------------

test('typing stores the value, opens the list, and blurs the active item', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  type(fruit, input, 'ap')
  expect(fruit()).toBe('ap')
  expect(fruit.popover()).toBe(true)
  expect(fruit.canAutoSelect()).toBe(true)
  // "If autoSelect is not set […] focus on the combobox input after changing
  // the value"
  expect(fruit.composite()).toBe(null)
})

test('typing keeps the active item while an auto-select is pending', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  type(fruit, input, 'ap')
  expect(fruit.autoSelecting()).toBe(true)
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
})

test('showMinLength gates typing, clicking, and the arrow keys alike', () => {
  const fruit = reatomCombobox({ showMinLength: 2, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  type(fruit, input, 'a')
  expect(fruit.popover()).toBe(false)

  type(fruit, input, 'ap')
  expect(fruit.popover()).toBe(true)

  fruit.popover.hide()
  typed(input, 'a')
  fruit.props.input().onKeyDown(event(input, { key: 'ArrowDown' }))
  expect(fruit.popover()).toBe(false)

  typed(input, 'ap')
  fruit.props.input().onKeyDown(event(input, { key: 'ArrowDown' }))
  expect(fruit.popover()).toBe(true)
})

test('showOnChange overrides the length rule in both directions', () => {
  const never = reatomCombobox({ showOnChange: false, name: 'never' })
  const alwaysOn = reatomCombobox({
    showOnChange: true,
    showMinLength: 5,
    name: 'always',
  })

  type(never, mount(never).input, 'ap')
  expect(never.popover()).toBe(false)

  type(alwaysOn, mount(alwaysOn).input, 'a')
  expect(alwaysOn.popover()).toBe(true)
})

test('setValueOnChange off derives the value elsewhere but still filters', () => {
  const fruit = reatomCombobox({ setValueOnChange: false, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  type(fruit, input, 'ap')
  expect(fruit()).toBe('')
  expect(fruit.popover()).toBe(true)
})

test('an IME composition does not arm the auto-select until it ends', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  typed(input, 'n')
  fruit.props
    .input()
    .onInput(
      event(input, { inputType: 'insertCompositionText', isComposing: true }),
    )
  expect(fruit()).toBe('n')
  expect(fruit.canAutoSelect()).toBe(false)

  fruit.props.input().onCompositionEnd()
  expect(fruit.canAutoSelect()).toBe(true)
})

// react-components 0.3.2: "Fixed `Combobox` with `autoSelect` moving focus
// between Korean IME composition steps." Ariakit re-arms its `canAutoSelectRef`
// from an effect on the value as well, so every composition step — each of which
// is a value change — armed the auto-select again and moved the active item away
// while the syllable was still being composed; the fix is a second
// `composingRef` that suppresses that re-arm. Here the input handler is the only
// writer of the flag, so a composition step can only ever clear it.
test('a composition step does not move the active item, the end of one does', () => {
  const hangul = reatomCombobox({ autoSelect: true, name: 'hangul' }).extend(
    withComboboxAutoSelect(),
  )
  const { input } = mount(hangul, ['한국', '항구'])
  // the auto-select only runs while the input still holds focus
  Object.assign(input, { ownerDocument: { activeElement: input } })

  const un = hangul.subscribe(() => {})
  hangul.popover.show()
  hangul.popover.positioned.set(true)
  notify()
  expect(hangul.composite()).toBe(null)

  // ㅎ → 하 → 한: one `input` event per jamo, all inside one composition
  for (const step of ['ㅎ', '하', '한']) {
    typed(input, step)
    hangul.props
      .input()
      .onInput(
        event(input, { inputType: 'insertCompositionText', isComposing: true }),
      )
    notify()
    expect(hangul()).toBe(step)
    expect(hangul.canAutoSelect()).toBe(false)
    expect(hangul.composite()).toBe(null)
  }

  // the syllable is committed, so now the first item is the one Enter takes
  hangul.props.input().onCompositionEnd()
  notify()
  expect(hangul.composite()).toBe(hangul.itemId('한국'))
  un()
})

test('a React synthetic event carries the input details on nativeEvent', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  typed(input, 'ap')
  fruit.props.input().onInput({
    target: input,
    currentTarget: input,
    nativeEvent: { inputType: 'insertText' },
  })
  expect(fruit()).toBe('ap')
  expect(fruit.canInline()).toBe(true)
})

// --- the keyboard ------------------------------------------------------------

test('an arrow key opens a closed list instead of navigating it', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple', 'Orange'])

  const opening = event(input, { key: 'ArrowDown' })
  fruit.props.input().onKeyDown(opening)
  expect(fruit.popover()).toBe(true)
  expect(prevented.has(opening)).toBe(true)
  // …and only opens it: Ariakit prevents the default, which stops its own
  // composite handler from moving as well
  expect(fruit.composite()).toBe(null)

  fruit.props.input().onKeyDown(event(input, { key: 'ArrowDown' }))
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
  expect(fruit.activeValue()).toBe('Apple')

  fruit.props.input().onKeyDown(event(input, { key: 'ArrowUp' }))
  expect(fruit.composite()).toBe(null)
})

test('a modified arrow key does not open the list', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  for (const modifier of ['ctrlKey', 'altKey', 'shiftKey', 'metaKey']) {
    fruit.props
      .input()
      .onKeyDown(event(input, { key: 'ArrowDown', [modifier]: true }))
    expect(fruit.popover()).toBe(false)
  }
})

test('Home and End belong to the caret of the input', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
    const keyEvent = event(input, { key })
    fruit.props.input().onKeyDown(keyEvent)
    expect(prevented.has(keyEvent)).toBe(false)
    expect(fruit.composite()).toBe(null)
  }
})

test('Enter picks the active item and never submits the form', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple', 'Orange'])

  // closed: Enter is the form's, which is what a search combobox needs
  const closed = event(input, { key: 'Enter' })
  fruit.props.input().onKeyDown(closed)
  expect(prevented.has(closed)).toBe(false)

  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  const picking = event(input, { key: 'Enter' })
  fruit.props.input().onKeyDown(picking)
  expect(prevented.has(picking)).toBe(true)
  expect(fruit.selectedValue()).toBe('Apple')
  expect(fruit()).toBe('Apple')
  expect(fruit.popover()).toBe(false)
})

test('Enter on the input, or on a disabled item, is a no-op but is swallowed', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input, items } = mount(fruit, ['Apple'])
  fruit.renderItem('Apple', { disabled: true, element: items.get('Apple') })
  fruit.popover.show()

  // the active item is the input itself
  const onInput = event(input, { key: 'Enter' })
  fruit.props.input().onKeyDown(onInput)
  expect(prevented.has(onInput)).toBe(true)
  expect(fruit.selectedValue()).toBe('')

  fruit.composite.set(fruit.itemId('Apple'))
  fruit.props.input().onKeyDown(event(input, { key: 'Enter' }))
  expect(fruit.selectedValue()).toBe('')
})

test('Enter applies the policy of the mounted item record', () => {
  const fruits = reatomCombobox({
    selectedValue: [],
    // off, so the assertion below is about the click policy and not about the
    // `resetValueOnHide` a closing multi-selectable list would apply on top
    resetValueOnHide: false,
    name: 'fruits',
  })
  const { input, items } = mount(fruits, ['Apple'])
  // an item that opts back into closing the list, the way a "create" item does
  fruits.props.item('Apple')().ref(null)
  fruits.props
    .item('Apple', { hideOnClick: true, setValueOnClick: true })()
    .ref(items.get('Apple')!)
  fruits.popover.show()
  fruits.composite.navigate({ move: 'first' })

  fruits.props.input().onKeyDown(event(input, { key: 'Enter' }))
  expect(fruits.selectedValue()).toEqual(['Apple'])
  expect(fruits()).toBe('Apple')
  expect(fruits.popover()).toBe(false)
})

test('a held-down key keeps the auto-select armed', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.canAutoSelect.set(true)

  fruit.props.input().onKeyDown(event(input, { key: 'a', repeat: true }))
  expect(fruit.canAutoSelect()).toBe(true)

  fruit.props.input().onKeyDown(event(input, { key: 'a' }))
  expect(fruit.canAutoSelect()).toBe(false)
})

// --- the pointer -------------------------------------------------------------

test('clicking the input blurs the active item and commits what it shows', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.set('ap')
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.displayValue()).toBe('Apple')

  fruit.props.input().onMouseDown(event(input, { button: 0 }))
  // the inlined value became the state, which is what the user saw
  expect(fruit()).toBe('Apple')
  expect(fruit.composite()).toBe(null)
})

test('a secondary or Ctrl click on the input does nothing', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  fruit.props.input().onMouseDown(event(input, { button: 2 }))
  fruit.props.input().onMouseDown(event(input, { ctrlKey: true }))
  expect(fruit.popover()).toBe(false)
})

test('blurActiveItemOnClick follows includesBaseElement', () => {
  const fruit = reatomCombobox({ includesBaseElement: false, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  fruit.props.input().onMouseDown(event(input, {}))
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  const forced = reatomCombobox({
    includesBaseElement: false,
    blurActiveItemOnClick: true,
    name: 'forced',
  })
  const forcedInput = mount(forced, ['Apple']).input
  forced.popover.show()
  forced.composite.navigate({ move: 'first' })
  forced.props.input().onMouseDown(event(forcedInput, {}))
  expect(forced.composite()).toBe(null)
})

test('clicking an item selects it, fills the input, and closes the list', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()
  fruit.set('ap')

  fruit.props.item('Apple')().onClick()
  expect(fruit.selectedValue()).toBe('Apple')
  expect(fruit()).toBe('Apple')
  expect(fruit.popover()).toBe(false)
})

test('clicking an item of a multi-selectable list keeps the list and the filter', () => {
  const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })
  mount(fruits, ['Apple', 'Orange'])
  fruits.popover.show()
  fruits.set('ap')

  fruits.props.item('Apple')().onClick()
  expect(fruits.selectedValue()).toEqual(['Apple'])
  // `resetValueOnSelect` cleared the filter, and `setValueOnClick` did not
  // refill it — the user keeps picking
  expect(fruits()).toBe('')
  expect(fruits.popover()).toBe(true)

  fruits.props.item('Apple')().onClick()
  expect(fruits.selectedValue()).toEqual([])
})

test('the per item policies are all overridable', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange', 'Banana'])
  fruit.popover.show()
  fruit.set('ap')

  // a link item: no selection, no value, but the list closes
  fruit.props
    .item('Apple', { selectValueOnClick: false, setValueOnClick: false })()
    .onClick()
  expect(fruit.selectedValue()).toBe('')
  expect(fruit()).toBe('ap')
  expect(fruit.popover()).toBe(false)

  // an item that keeps the list open
  fruit.popover.show()
  fruit.props.item('Orange', { hideOnClick: false })().onClick()
  expect(fruit.popover()).toBe(true)
  expect(fruit()).toBe('Orange')

  // an item that clears the filter instead of filling it
  fruit.props
    .item('Banana', { setValueOnClick: false, resetValueOnSelect: true })()
    .onClick()
  expect(fruit.selectedValue()).toBe('Banana')
  expect(fruit()).toBe('')
})

test('an unmounted item does not leave its click policy on a later record', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const input = element()
  fruit.props.input().ref(input)

  const custom = fruit.props.item('Apple', { hideOnClick: false })
  custom().ref(element())
  custom().ref(null)

  const current = fruit.props.item('Apple')
  current().ref(element())
  fruit.popover.show()
  fruit.composite.move(fruit.itemId('Apple'))
  current().onClick()

  expect(fruit.selectedValue()).toBe('Apple')
  expect(fruit.popover()).toBe(false)
})

test('a modifier-click navigation does not activate a link item', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const link = Object.assign(element(), { tagName: 'A' })
  fruit.props.item('Apple')().ref(link)
  fruit.popover.show()

  fruit.props
    .item('Apple')()
    .onClick(event(link, { ctrlKey: true, altKey: false, metaKey: false }))

  expect(fruit.selectedValue()).toBe('')
  expect(fruit.popover()).toBe(true)
})

test('a prevented click on an item is left alone', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  mount(fruit, ['Apple'])

  fruit.props.item('Apple')().onClick({ defaultPrevented: true })
  expect(fruit.selectedValue()).toBe('')
})

// --- the item keyboard relay -------------------------------------------------

test('a printable key on an item hands the typing back to the input', async () => {
  const fruit = reatomCombobox({ virtualFocus: false, name: 'fruit' })
  const { input, items } = mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  for (const key of ['x', 'X', 'Backspace', 'Delete']) {
    fruit.props
      .item('Apple')()
      .onKeyDown(event(items.get('Apple'), { key }))
  }

  // Deliberately no `preventDefault`: the microtask runs before the browser
  // performs the key's default action, so the character the user pressed lands
  // in the input that just received focus.
  await Promise.resolve()
  expect(input.focused).toBe(4)
  // …and the key did not navigate, which is the other half of "it is typing"
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
  // The value the element displays becoming the state needs a real text field —
  // `combobox.test.browser.ts` covers that half.
})

test('a shortcut on an item is not typing, and arrows still navigate', () => {
  const fruit = reatomCombobox({ virtualFocus: false, name: 'fruit' })
  const { items } = mount(fruit, ['Apple', 'Orange'])
  const apple = items.get('Apple')!
  Object.assign(apple, { value: 'Apple' })
  fruit.popover.show()
  fruit.composite.navigate({ move: 'first' })

  // Ariakit's condition also matches `Ctrl+C`, which would break copying
  fruit.props
    .item('Apple')()
    .onKeyDown(event(apple, { key: 'c', ctrlKey: true }))
  expect(fruit()).toBe('')

  const arrow = event(apple, { key: 'ArrowDown' })
  fruit.props.item('Apple')().onKeyDown(arrow)
  expect(prevented.has(arrow)).toBe(true)
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  expect(fruit.activeValue()).toBe('Orange')
})

// --- the buttons -------------------------------------------------------------

test('the cancel button clears the input and moves focus back to it', () => {
  const fruit = reatomCombobox({ hideWhenEmpty: true, name: 'fruit' })
  mount(fruit, ['Apple'])
  fruit.popover.show()
  fruit.set('ap')
  fruit.composite.navigate({ move: 'first' })

  expect(fruit.props.cancel()).toMatchObject({
    type: 'button',
    'aria-label': 'Clear input',
    'aria-controls': 'fruit',
    hidden: false,
  })

  fruit.props.cancel().onClick()
  expect(fruit()).toBe('')
  // a `move`, so focus follows: `null` is the input
  expect(fruit.composite()).toBe(null)
  expect(fruit.activeValue()).toBe(undefined)
  expect(fruit.props.cancel().hidden).toBe(true)
})

test('the disclosure button toggles the list and never takes focus', () => {
  const fruit = reatomCombobox({ name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  expect(fruit.props.disclosure()).toMatchObject({
    type: 'button',
    tabIndex: -1,
    'aria-label': 'Show popup',
    'aria-expanded': false,
    'aria-controls': 'fruit-list',
  })

  const press = { defaultPrevented: false, preventDefault() {} }
  let stopped = false
  fruit.props.disclosure().onMouseDown({
    preventDefault: () => void (stopped = true),
  })
  expect(stopped).toBe(true)
  expect(fruit.composite()).toBe(null)
  void press

  fruit.props.disclosure().onClick()
  expect(fruit.popover()).toBe(true)
  expect(fruit.props.disclosure()['aria-label']).toBe('Hide popup')
  // the input stays the element Escape and focus restoration land on
  expect(fruit.popover.disclosureElement()).toBe(input)

  fruit.props.disclosure().onClick()
  expect(fruit.popover()).toBe(false)
})

// --- the blur commit ---------------------------------------------------------

test('leaving the widget commits the inlined value, entering the list does not', () => {
  const fruit = reatomCombobox({ autoComplete: 'inline', name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  const list = element()
  Object.assign(list, { contains: (node: unknown) => node === item })
  const item = element()
  fruit.props.list().ref(list)

  fruit.popover.show()
  fruit.set('ap')
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.displayValue()).toBe('Apple')

  // focus moved into the list: the user is still choosing
  fruit.props.input().onBlur(event(input, { relatedTarget: item }))
  expect(fruit()).toBe('ap')

  // focus left the widget: what the element showed becomes the state
  fruit.props.input().onBlur(event(input, { relatedTarget: null }))
  expect(fruit()).toBe('Apple')
})

test('the list commits the inlined value when focus leaves from inside it', () => {
  // Without `virtualFocus` the items take DOM focus, so tabbing away happens on
  // an item and the input blurred back when focus *entered* the list. Ariakit
  // registers the same `focusout` listener on both elements.
  const fruit = reatomCombobox({
    autoComplete: 'inline',
    virtualFocus: false,
    name: 'fruit',
  })
  const { items } = mount(fruit, ['Apple'])
  const list = element()
  const apple = items.get('Apple')!
  Object.assign(list, { contains: (node: unknown) => node === apple })
  fruit.props.list().ref(list)

  fruit.popover.show()
  fruit.set('ap')
  fruit.composite.navigate({ move: 'first' })
  expect(fruit.displayValue()).toBe('Apple')

  // between two items, or back to the input: still choosing
  fruit.props.list().onFocusOut(event(apple, { relatedTarget: apple }))
  expect(fruit()).toBe('ap')

  fruit.props.list().onFocusOut(event(apple, { relatedTarget: null }))
  expect(fruit()).toBe('Apple')

  // …and the popover record carries the same handler, since it is the list
  expect(fruit.props.popover().onFocusOut).toBe(fruit.props.list().onFocusOut)
})

test('a blur disarms the auto-select, in `list` mode too', () => {
  const fruit = reatomCombobox({ autoSelect: true, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])
  fruit.canAutoSelect.set(true)

  fruit.props.input().onBlur(event(input, { relatedTarget: null }))
  expect(fruit.canAutoSelect()).toBe(false)
  // `list` mode has nothing to commit
  expect(fruit()).toBe('')
})

test('focusing the input activates it only without virtual focus', () => {
  const virtual = reatomCombobox({ name: 'virtual' })
  const virtualInput = mount(virtual, ['Apple']).input
  virtual.popover.show()
  virtual.composite.navigate({ move: 'first' })
  virtual.props.input().onFocus(event(virtualInput, {}))
  expect(virtual.composite()).toBe(virtual.itemId('Apple'))

  const roving = reatomCombobox({ virtualFocus: false, name: 'roving' })
  const rovingInput = mount(roving, ['Apple']).input
  roving.popover.show()
  roving.composite.navigate({ move: 'first' })
  roving.props.input().onFocus(event(rovingInput, {}))
  expect(roving.composite()).toBe(null)
})

// --- composing the model by hand ---------------------------------------------

test('an adopted value atom stays the single source of truth', () => {
  const query: Atom<string> = atom('', 'route.search.q')
  const fruit = reatomCombobox({ valueAtom: query, name: 'fruit' })
  const { input } = mount(fruit, ['Apple'])

  type(fruit, input, 'ap')
  expect(query()).toBe('ap')

  query.set('orange')
  expect(fruit()).toBe('orange')
  expect(fruit.props.input().value).toBe('orange')
})

// --- the runtime semantics the port relies on --------------------------------

test('a plain composite write is not a move, which is what the port hangs on', () => {
  // The invariant behind `activeValue`: `composite.move` is observable as the
  // event Ariakit needs its `moves` counter for, and a plain write is not.
  const composite = reatomComposite({ activeId: null, name: 'probe' })
  composite.items.renderItem({ id: 'one', element: element() })
  composite.items.renderItem({ id: 'two', element: element() })

  const seen: Array<[string | null | undefined, string | null]> = []
  const combobox = reatomCombobox({ name: 'invariant' })
  mount(combobox, ['one', 'two'])
  combobox.popover.show()

  combobox.composite.navigate({ move: 'first' })
  seen.push([combobox.composite(), combobox.activeValue() ?? null])
  combobox.composite.set(combobox.itemId('two'))
  seen.push([combobox.composite(), combobox.activeValue() ?? null])

  expect(seen).toEqual([
    [combobox.itemId('one'), 'one'],
    [combobox.itemId('two'), null],
  ])
})

test('a reset derivation only re-runs when the popover changes, not on a write', () => {
  // Why `resetValueOnHide` can be a `withComputed` without fighting the user:
  // the derivation is only re-evaluated when one of its dependencies changes,
  // so a write after the reset wins until the popover moves again.
  const fruit = reatomCombobox({
    value: 'seed',
    resetValueOnHide: true,
    name: 'fruit',
  })

  fruit.popover.show()
  fruit.popover.hide()
  expect(fruit()).toBe('seed')

  fruit.set('typed')
  expect(fruit()).toBe('typed')
  expect(fruit.popover()).toBe(false)
})
