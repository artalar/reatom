import { atom, context, peek, reatomField } from '@reatom/core'
import { beforeEach, expect, test, vi } from 'vitest'

import { reatomCombobox } from '../combobox/reatomCombobox'
import { isSelectMultiSelectableRole, selectItemRole } from './props'
import type { Select } from './reatomSelect'
import { reatomSelect } from './reatomSelect'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but the composite derivations
 * depend on whether an item _has_ an element, and two handlers call `focus()`.
 * Everything that needs a real element — DOM focus, the deferred show on
 * `keyup` — belongs to a browser test.
 */
const element = (): HTMLElement & { focused: number } => {
  const fake = {
    focused: 0,
    focus: () => void fake.focused++,
    isConnected: true,
    ownerDocument: { activeElement: null },
  }
  return fake as unknown as HTMLElement & { focused: number }
}

/**
 * A self-targeted event, which is what every select handler expects. `init` has
 * a default rather than being optional so that its keys stay _required_ in the
 * result — an optional spread would widen `key` to `key?: string`, which no
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

/**
 * Mounts a select the way a view adapter does: the button, the list, then one
 * element per item value in order.
 */
const mount = (select: Select, values: Array<string> = []) => {
  const button = element()
  select.props.select().ref(button)

  const list = element()
  select.props.list().ref(list)

  const items = new Map<string, ReturnType<typeof element>>()
  for (const value of values) {
    const el = element()
    items.set(value, el)
    select.props.item(value)().ref(el)
  }

  return { button, list, items }
}

// --- the model ---------------------------------------------------------------

test('a select is a composite of the items plus the popover that holds them', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  expect(fruit()).toBe(undefined)
  expect(fruit.multiSelectable()).toBe(false)
  expect(fruit.values()).toEqual([])
  expect(fruit.popover()).toBe(false)
  expect(fruit.combobox).toBe(null)
  expect(fruit.setValueOnMove()).toBe(false)

  // the button is the widget, the list is the composite element
  expect(fruit.props.select().id).toBe('fruit')
  expect(fruit.composite.id()).toBe('fruit-list')
  expect(fruit.popover.contentId()).toBe('fruit-list')

  // nothing is registered until the view renders the elements
  expect(fruit.composite.items.ids()).toEqual([])
})

test("Ariakit's four composite overrides and the popover placement", () => {
  const fruit = reatomSelect({ name: 'fruit' })

  // `createSelectStore` differs from `createCompositeStore` in exactly these
  expect(fruit.composite()).toBe(null)
  expect(fruit.composite.orientation()).toBe('vertical')
  expect(fruit.composite.virtualFocus()).toBe(true)
  // …and `includesBaseElement` does *not* follow `activeId === null` here: the
  // list is not part of the arrow-key order
  expect(fruit.composite.includesBaseElement()).toBe(false)
  expect(fruit.popover.placement()).toBe('bottom-start')
  expect(fruit.popover.modal()).toBe(false)
})

// --- the value ---------------------------------------------------------------

test('the first enabled item that has a value seeds the value', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  expect(fruit()).toBe(undefined)

  mount(fruit, ['Apple', 'Orange'])
  expect(fruit()).toBe('Apple')
})

test("an explicit '' is a value, not the unset state", () => {
  // Ariakit needs a `new String('')` sentinel to tell these two apart
  const empty = reatomSelect({ value: '', name: 'empty' })
  mount(empty, ['Apple'])
  expect(empty()).toBe('')

  const seeded = reatomSelect({ name: 'seeded' })
  mount(seeded, ['Apple'])
  expect(seeded()).toBe('Apple')
})

test('a disabled item neither seeds the value nor is selectable', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  fruit.props.item('Apple', { disabled: true })().ref(element())
  fruit.props.item('Orange')().ref(element())

  expect(fruit()).toBe('Orange')
})

test('an array value is what makes the select multi-selectable', () => {
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  mount(fruits, ['Apple', 'Orange'])

  // never seeded: an empty array is a chosen "nothing selected"
  expect(fruits()).toEqual([])
  expect(fruits.multiSelectable()).toBe(true)

  fruits.select('Apple')
  fruits.select('Orange')
  expect(fruits()).toEqual(['Apple', 'Orange'])
  expect(fruits.values()).toEqual(['Apple', 'Orange'])

  // picking a selected value toggles it off
  fruits.select('Apple')
  expect(fruits()).toEqual(['Orange'])
  expect(fruits.isSelected('Apple')).toBe(false)
})

test('select replaces the value on a single select', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.select('Orange')).toBe('Orange')
  expect(fruit.isSelected('Orange')).toBe(true)
  expect(fruit.isSelected('Apple')).toBe(false)
})

test('valueAtom adopts a caller-owned atom, e.g. a form field', () => {
  const field = reatomField('', 'form.fields.fruit')
  const fruit = reatomSelect({ valueAtom: field, name: 'fruit' })

  fruit.select('Apple')
  expect(field()).toBe('Apple')

  field.set('Orange')
  expect(fruit()).toBe('Orange')
  expect(fruit.isSelected('Orange')).toBe(true)
})

test('an adopted atom holding undefined is seeded from the items', () => {
  const outer = atom<string | undefined>(undefined, 'outer')
  const fruit = reatomSelect({ valueAtom: outer, name: 'fruit' })
  mount(fruit, ['Apple'])

  expect(outer()).toBe('Apple')
  expect(fruit()).toBe('Apple')
})

test('either value or valueAtom', () => {
  expect(() =>
    reatomSelect({
      value: 'Apple',
      valueAtom: atom<string | undefined>('', 'v'),
      name: 'a',
    } as never),
  ).toThrow('pass either "value" or "valueAtom"')
})

// --- the item registry -------------------------------------------------------

test('an item id is allocated from the value and stays stable', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const id = fruit.itemId('Apple')

  expect(id).toBe('fruit-item-1')
  expect(fruit.itemId('Apple')).toBe(id)
  expect(fruit.itemValue(id)).toBe('Apple')
  expect(fruit.itemValue('nope')).toBe(undefined)
  expect(fruit.itemValue(null)).toBe(undefined)

  // …across an unmount and a remount, so the item keeps its identity
  const el = element()
  fruit.props.item('Apple')().ref(el)
  expect(fruit.item('Apple')?.id).toBe(id)
  fruit.props.item('Apple')().ref(null)
  fruit.props.item('Apple')().ref(element())
  expect(fruit.item('Apple')?.id).toBe(id)
})

test('itemValues is the registered values, in order and without duplicates', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange', 'Apple'])

  expect(fruit.itemValues()).toEqual(['Apple', 'Orange'])
})

test('the items option registers upfront without rendering', () => {
  const fruit = reatomSelect({
    items: [{ value: 'Apple' }, { value: 'Orange' }],
    name: 'fruit',
  })

  // registered, so the value is seeded from them…
  expect(fruit()).toBe('Apple')
  expect(fruit.itemValues()).toEqual(['Apple', 'Orange'])
  // …but nothing is navigable until an element mounts
  expect(fruit.composite.navigationItems()).toEqual([])
})

// --- selectedId and the active item ------------------------------------------

test('a closed select activates the item it has selected', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.selectedId()).toBe(fruit.itemId('Apple'))
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  fruit.select('Orange')
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
})

test('selectedId ignores a disabled or unregistered selection', () => {
  const fruit = reatomSelect({ value: 'Pear', name: 'fruit' })
  mount(fruit, ['Apple'])
  expect(fruit.selectedId()).toBe(undefined)

  fruit.props.item('Pear', { disabled: true })().ref(element())
  expect(fruit.selectedId()).toBe(undefined)
})

test('a multi-select opens at the value it picked last', () => {
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  mount(fruits, ['Apple', 'Orange'])

  fruits.select('Orange')
  fruits.select('Apple')
  expect(fruits.selectedId()).toBe(fruits.itemId('Apple'))
})

test('closing the list resets the active id to the current selection', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  fruit.popover.show()
  fruit.composite.navigate({ move: 'last' })
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  // an open list only moves — the value is committed by picking an item
  expect(fruit()).toBe('Apple')

  fruit.popover.hide()
  // Ariakit resets the active id, then re-activates the selected item, "so that
  // the active id won't be pointing to another item when the popover is shown
  // again"
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
})

// --- setValueOnMove ----------------------------------------------------------

test('a closed select writes the value on every move', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')
})

test('an open list only writes the value with setValueOnMove', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Apple')

  fruit.setValueOnMove.set(true)
  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')
})

test('a plain write to the active id never writes the value', () => {
  const fruit = reatomSelect({ setValueOnMove: true, name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  // Ariakit's `setActiveId`: a hover, a DOM focus, a programmatic write
  fruit.composite.set(fruit.itemId('Orange'))
  expect(fruit()).toBe('Apple')
})

test('a multi-select never follows a move', () => {
  const fruits = reatomSelect({
    value: [],
    setValueOnMove: true,
    name: 'fruits',
  })
  mount(fruits, ['Apple', 'Orange'])

  fruits.composite.move(fruits.itemId('Orange'))
  expect(fruits()).toEqual([])
})

test('a move to the list itself, a disabled item, or nowhere is ignored', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple'])
  fruit.props.item('Pear', { disabled: true })().ref(element())

  fruit.composite.move(null)
  expect(fruit()).toBe('Apple')

  fruit.composite.move(undefined)
  expect(fruit()).toBe('Apple')

  fruit.composite.move(fruit.itemId('Pear'))
  expect(fruit()).toBe('Apple')
})

test('turning setValueOnMove on is not an interaction', () => {
  // Ariakit's listener also fires when the flag itself changes, which writes the
  // active item's value into a value the user never touched.
  const fruit = reatomSelect({ value: 'Orange', name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()
  fruit.composite.set(fruit.itemId('Apple'))

  fruit.setValueOnMove.set(true)
  expect(fruit()).toBe('Orange')
})

// --- navigating over the items that have a value -----------------------------

test('navigation skips an item that has no value', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple'])
  // an item that is navigable inside an open list but selects nothing
  fruit.composite.items.renderItem({ id: 'plain', element: element() })
  fruit.props.item('Orange')().ref(element())

  // the plain composite query lands on it…
  expect(fruit.composite.nextId({ move: 'next' })).toBe('plain')
  // …the value-aware one skips it, which is Ariakit's `nextWithValue`
  expect(fruit.nextValueId({ move: 'next' })).toBe(fruit.itemId('Orange'))

  expect(fruit.navigateValue({ move: 'next' })).toBe(fruit.itemId('Orange'))
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  // and the move wrote the value, because the list is closed
  expect(fruit()).toBe('Orange')
})

// --- valueOnShow and reset ---------------------------------------------------

test('reset restores the value the list opened with', () => {
  const fruit = reatomSelect({ setValueOnMove: true, name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.valueOnShow()).toBe('Apple')

  fruit.popover.show()
  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')
  // frozen while the list is open, which is what makes the reset meaningful
  expect(fruit.valueOnShow()).toBe('Apple')

  expect(fruit.reset()).toBe('Apple')
  expect(fruit()).toBe('Apple')

  // and it follows the value again once the list is closed
  fruit.popover.hide()
  fruit.select('Orange')
  expect(fruit.valueOnShow()).toBe('Orange')
})

test('the restore point survives the list closing before the reset runs', () => {
  // The dialog's own Escape listener hides the popover from a capture listener
  // on the document, so the list's `onKeyDown` always reaches the reset *after*
  // the list is closed. A restore point derived from `popover.mounted()` would
  // have unfrozen itself in between.
  const fruit = reatomSelect({ setValueOnMove: true, name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  fruit.popover.show()
  fruit.composite.move(fruit.itemId('Orange'))
  fruit.popover.hide()

  expect(fruit.reset()).toBe('Apple')
  expect(fruit()).toBe('Apple')
})

test('a value never shown in the list is the restore point itself', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  // an arrow key on a closed select, a form reset, another widget's write
  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit.valueOnShow()).toBe('Orange')

  fruit.popover.show()
  fruit.select('Apple')
  expect(fruit.reset()).toBe('Orange')
})

// --- the combobox edge -------------------------------------------------------

test('a combobox shares its composite and popover with the select', () => {
  const search = reatomCombobox({ name: 'fruit.search' })
  const fruit = reatomSelect({ combobox: search, name: 'fruit' })

  expect(fruit.combobox).toBe(search)
  expect(fruit.composite).toBe(search.composite)
  expect(fruit.popover).toBe(search.popover)

  // one item collection, and one id per value
  const id = fruit.itemId('Apple')
  expect(id).toBe(search.itemId('Apple'))
  expect(search.itemValue(id)).toBe('Apple')
  expect(fruit.itemValue(id)).toBe('Apple')

  fruit.props.item('Apple')().ref(element())
  expect(search.composite.items.ids()).toEqual([id])
})

test('a select with a combobox does not activate its selection while closed', () => {
  // Ariakit skips the same listener with `if (combobox) return`
  const search = reatomCombobox({ name: 'fruit.search' })
  const fruit = reatomSelect({ combobox: search, name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit()).toBe('Apple')
  // the combobox input stays the active element
  expect(fruit.composite()).toBe(null)
})

// --- the select button record ------------------------------------------------

test('the button is announced as a collapsed listbox control', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const props = fruit.props.select()

  expect(props).toMatchObject({
    id: 'fruit',
    type: 'button',
    role: 'combobox',
    'aria-autocomplete': 'none',
    'aria-haspopup': 'listbox',
    'aria-expanded': false,
    'aria-controls': 'fruit-list',
    'aria-labelledby': undefined,
  })

  fruit.popover.show()
  expect(fruit.props.select()['aria-expanded']).toBe(true)
})

test('the button ref assigns the select element, the anchor, and the disclosure', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { button } = mount(fruit)

  expect(fruit.selectElement()).toBe(button)
  expect(fruit.popover.anchorElement()).toBe(button)
  expect(fruit.popover.disclosureElement()).toBe(button)
})

test('clicking the button toggles the list and adopts the anchor', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const button = element()

  fruit.props.select().onClick(event(button))
  expect(fruit.popover()).toBe(true)
  expect(fruit.popover.anchorElement()).toBe(button)

  fruit.props.select().onClick(event(button))
  expect(fruit.popover()).toBe(false)

  // a prevented click adopts the anchor but does not toggle
  const other = element()
  fruit.props.select().onClick({ currentTarget: other, defaultPrevented: true })
  expect(fruit.popover()).toBe(false)
  expect(fruit.popover.anchorElement()).toBe(other)

  const fixed = reatomSelect({ toggleOnClick: false, name: 'fixed' })
  fixed.props.select().onClick(event(element()))
  expect(fixed.popover()).toBe(false)
})

test('an arrow key that points at the list opens it, without changing the value', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { button } = mount(fruit, ['Apple', 'Orange'])

  const press = event(button, { key: 'ArrowDown' })
  fruit.props.select().onKeyDown(press)

  expect(prevented.has(press)).toBe(true)
  expect(fruit.popover()).toBe(true)
  // the list opens at the selection, and the value is untouched
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))
  expect(fruit()).toBe('Apple')
})

test('an arrow key that does not point at the list moves the value', () => {
  // a horizontal select whose list is below: the vertical arrows open it, the
  // horizontal ones navigate a closed one
  const fruit = reatomSelect({ orientation: 'horizontal', name: 'fruit' })
  const { button } = mount(fruit, ['Apple', 'Orange'])

  const press = event(button, { key: 'ArrowRight' })
  fruit.props.select().onKeyDown(press)

  expect(prevented.has(press)).toBe(true)
  expect(fruit.popover()).toBe(false)
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')
})

test('showOnKeyDown and moveOnKeyDown are the two halves of that policy', () => {
  const quiet = reatomSelect({ showOnKeyDown: false, name: 'quiet' })
  const { button } = mount(quiet, ['Apple', 'Orange'])

  quiet.props.select().onKeyDown(event(button, { key: 'ArrowDown' }))
  expect(quiet.popover()).toBe(false)
  expect(quiet()).toBe('Orange')

  const still = reatomSelect({
    moveOnKeyDown: false,
    showOnKeyDown: false,
    name: 'still',
  })
  const other = mount(still, ['Apple', 'Orange'])
  still.props.select().onKeyDown(event(other.button, { key: 'ArrowDown' }))
  expect(still()).toBe('Apple')

  // a key the widget has no use for keeps its default behavior
  const ignored = event(button, { key: 'a' })
  quiet.props.select().onKeyDown(ignored)
  expect(prevented.has(ignored)).toBe(false)
})

// --- the label record --------------------------------------------------------

test('the label labels the button once it is rendered', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  expect(fruit.props.label().id).toBe('fruit-label')
  expect(fruit.props.label().style).toEqual({ cursor: 'default' })
  expect(fruit.props.select()['aria-labelledby']).toBe(undefined)

  const label = element()
  fruit.props.label().ref(label)
  expect(fruit.labelElement()).toBe(label)
  expect(fruit.props.select()['aria-labelledby']).toBe('fruit-label')
  expect(fruit.props.list()['aria-labelledby']).toBe('fruit-label')
})

test('clicking the label focuses the button, after the event queue', async () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { button } = mount(fruit)

  fruit.props.label().onClick()
  expect(button.focused).toBe(0)

  await Promise.resolve()
  expect(button.focused).toBe(1)
})

// --- the list record ---------------------------------------------------------

test('the list is the composite element of a select', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { list } = mount(fruit, ['Apple'])

  expect(fruit.listElement()).toBe(list)
  expect(fruit.composite.baseElement()).toBe(list)

  expect(fruit.props.list()).toMatchObject({
    id: 'fruit-list',
    role: 'listbox',
    'aria-multiselectable': undefined,
    // virtual focus, so the list holds DOM focus and points at the active item
    'aria-activedescendant': fruit.itemId('Apple'),
    tabIndex: 0,
    hidden: true,
    style: { display: 'none' },
  })

  fruit.popover.show()
  expect(fruit.props.list().hidden).toBe(false)
  expect(fruit.props.list().style).toBe(undefined)
})

test('aria-multiselectable follows the value shape and the popup role', () => {
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  expect(fruits.props.list()['aria-multiselectable']).toBe(true)

  const menu = reatomSelect({ value: [], popupRole: 'menu', name: 'menu' })
  // a menu announces multiple selection through `aria-checked` on its items
  expect(menu.props.list()['aria-multiselectable']).toBe(undefined)
  expect(menu.props.list().role).toBe('menu')
  expect(menu.props.item('Apple')().role).toBe('menuitem')
})

test('Escape on the list restores the value the list opened with', () => {
  const fruit = reatomSelect({ setValueOnMove: true, name: 'fruit' })
  const { list } = mount(fruit, ['Apple', 'Orange'])

  fruit.popover.show()
  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')

  fruit.props.list().onKeyDown(event(list, { key: 'Escape' }))
  expect(fruit()).toBe('Apple')
})

test('a multi-select is never reset by Escape', () => {
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  const { list } = mount(fruits, ['Apple', 'Orange'])

  fruits.popover.show()
  fruits.select('Orange')
  fruits.props.list().onKeyDown(event(list, { key: 'Escape' }))
  expect(fruits()).toEqual(['Orange'])
})

test('Enter or Space on the list itself closes it', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { list } = mount(fruit, ['Apple'])
  fruit.popover.show()

  const press = event(list, { key: 'Enter' })
  fruit.props.list().onKeyDown(press)
  expect(prevented.has(press)).toBe(true)
  expect(fruit.popover()).toBe(false)

  fruit.popover.show()
  fruit.props.list().onKeyDown(event(list, { key: ' ' }))
  expect(fruit.popover()).toBe(false)

  // …but not when the key came from an item inside it
  fruit.popover.show()
  const bubbled = { target: element(), currentTarget: list, key: 'Enter' }
  fruit.props.list().onKeyDown(bubbled)
  expect(fruit.popover()).toBe(true)
})

test('the list navigates the items', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const { list } = mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  const press = event(list, { key: 'ArrowDown' })
  fruit.props.list().onKeyDown(press)

  expect(prevented.has(press)).toBe(true)
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
})

// --- the popover record ------------------------------------------------------

test('the popover record is the list and the dialog element in one', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const props = fruit.props.popover()

  expect(props).toMatchObject({
    'data-dialog': '',
    id: 'fruit-list',
    role: 'listbox',
    tabIndex: 0,
    hidden: true,
  })

  const popup = element()
  fruit.props.popover().ref(popup)
  expect(fruit.popover.contentElement()).toBe(popup)
  expect(fruit.listElement()).toBe(popup)
  expect(fruit.composite.baseElement()).toBe(popup)
})

test('Escape on the popover both restores the value and closes it', () => {
  const fruit = reatomSelect({ setValueOnMove: true, name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  const popup = element()
  fruit.props.popover().ref(popup)

  fruit.popover.show()
  fruit.composite.move(fruit.itemId('Orange'))
  expect(fruit()).toBe('Orange')

  fruit.props.popover().onKeyDown(event(popup, { key: 'Escape' }))
  expect(fruit()).toBe('Apple')
  expect(fruit.popover()).toBe(false)
})

// --- the item record ---------------------------------------------------------

test('an item announces what it is and whether it is selected', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.props.item('Apple')()).toMatchObject({
    id: fruit.itemId('Apple'),
    role: 'option',
    'aria-selected': true,
    'data-active-item': true,
    'data-autofocus': true,
    autoFocus: true,
    // virtual focus: no item is in the tab order
    tabIndex: -1,
  })

  expect(fruit.props.item('Orange')()).toMatchObject({
    'aria-selected': false,
    'data-active-item': undefined,
    'data-autofocus': undefined,
    autoFocus: false,
  })
})

test('the item record is memoized per value', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  expect(fruit.props.item('Apple')).toBe(fruit.props.item('Apple'))
  // …and passing options returns a fresh, uncached record
  expect(fruit.props.item('Apple', { hideOnClick: false })).not.toBe(
    fruit.props.item('Apple'),
  )
})

test('the item ref registers the element as a rendered item', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const el = element()

  fruit.props.item('Apple')().ref(el)
  expect(fruit.item('Apple')?.element()).toBe(el)
  expect(fruit.composite.navigationItems()).toEqual([
    { id: fruit.itemId('Apple'), disabled: false, rowId: undefined },
  ])
  // the text a typeahead matches on is the value
  expect(fruit.item('Apple')?.text()).toBe('Apple')

  fruit.props.item('Apple')().ref(null)
  expect(fruit.composite.navigationItems()).toEqual([])
})

test('an item registered with a row makes the list a grid', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  fruit.props.item('Apple', { rowId: 'row-1' })().ref(element())

  expect(fruit.item('Apple')?.rowId()).toBe('row-1')
})

test('clicking an item writes the value and closes the list', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.props.item('Orange')().onClick()
  expect(fruit()).toBe('Orange')
  expect(fruit.popover()).toBe(false)
})

test('a multi-select keeps its list open for the next pick', () => {
  const fruits = reatomSelect({ value: [], name: 'fruits' })
  mount(fruits, ['Apple', 'Orange'])
  fruits.popover.show()

  fruits.props.item('Apple')().onClick()
  fruits.props.item('Orange')().onClick()
  expect(fruits()).toEqual(['Apple', 'Orange'])
  expect(fruits.popover()).toBe(true)
})

test('the per item click policy overrides the model-wide one', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  fruit.props.item('Orange', { hideOnClick: false })().onClick()
  expect(fruit()).toBe('Orange')
  expect(fruit.popover()).toBe(true)

  // an item that only navigates
  fruit.props.item('Apple', { setValueOnClick: false })().onClick()
  expect(fruit()).toBe('Orange')
  expect(fruit.popover()).toBe(false)

  // a prevented click does nothing at all
  fruit.popover.show()
  fruit.props.item('Apple')().onClick({ defaultPrevented: true })
  expect(fruit()).toBe('Orange')
  expect(fruit.popover()).toBe(true)
})

test('hovering an item activates it, but only while the list is open', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  // Ariakit: "We have to disable focusOnHover when the popup is closed,
  // otherwise the active item will change to null (the container) when the
  // popup is closed by clicking on an item."
  fruit.props.item('Orange')().onMouseMove()
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  fruit.popover.show()
  fruit.props.item('Orange')().onMouseMove()
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))
  // a hover is not a commitment, so the value stays put
  expect(fruit()).toBe('Apple')

  fruit.props.item('Orange')().onMouseLeave()
  expect(fruit.composite()).toBe(null)

  const still = reatomSelect({ focusOnHover: false, name: 'still' })
  mount(still, ['Apple', 'Orange'])
  still.popover.show()
  still.props.item('Orange')().onMouseMove()
  expect(still.composite()).toBe(still.itemId('Apple'))
})

test('focusing an item makes it the active one, and it can navigate', () => {
  const fruit = reatomSelect({ virtualFocus: false, name: 'fruit' })
  const { items } = mount(fruit, ['Apple', 'Orange'])
  fruit.popover.show()

  const el = items.get('Orange')!
  fruit.props.item('Orange')().onFocus(event(el))
  expect(fruit.composite()).toBe(fruit.itemId('Orange'))

  const press = event(el, { key: 'ArrowUp' })
  fruit.props.item('Orange')().onKeyDown(press)
  expect(prevented.has(press)).toBe(true)
  expect(fruit.composite()).toBe(fruit.itemId('Apple'))

  // with roving tabindex the active item is the single tab stop
  expect(fruit.props.item('Apple')().tabIndex).toBe(undefined)
  expect(fruit.props.item('Orange')().tabIndex).toBe(-1)
})

test('a combobox with virtual focus off suppresses autoFocus, not data-autofocus', () => {
  // Ariakit issue #5047: "a re-mounted selected item [would steal] focus from
  // the combobox input (which dismisses the iOS keyboard)"
  const search = reatomCombobox({ virtualFocus: false, name: 'fruit.search' })
  const fruit = reatomSelect({ combobox: search, name: 'fruit' })
  mount(fruit, ['Apple'])

  const props = fruit.props.item('Apple')()
  expect(props['data-autofocus']).toBe(true)
  expect(props.autoFocus).toBe(false)
})

// --- the composite option ----------------------------------------------------

test('with a combobox the list is not the composite element', () => {
  const search = reatomCombobox({ name: 'fruit.search' })
  const fruit = reatomSelect({ combobox: search, name: 'fruit' })

  const list = element()
  fruit.props.list().ref(list)

  expect(fruit.listElement()).toBe(list)
  // the combobox input is, so the list carries neither the tab stop nor the
  // active descendant
  expect(fruit.composite.baseElement()).toBe(null)
  expect(fruit.props.list().tabIndex).toBe(undefined)
  expect(fruit.props.list()['aria-activedescendant']).toBe(undefined)

  // …and it does not navigate either
  fruit.props.item('Apple')().ref(element())
  fruit.props.item('Orange')().ref(element())
  search.popover.show()
  fruit.props.list().onKeyDown(event(list, { key: 'ArrowDown' }))
  expect(fruit.composite()).toBe(null)
})

// --- the arrow and the hidden native select ----------------------------------

test('the arrow points the way the list is placed', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  expect(fruit.props.arrow()).toEqual({
    'aria-hidden': true,
    'data-side': 'bottom',
  })

  fruit.popover.currentPlacement.set('top-end')
  expect(fruit.props.arrow()['data-side']).toBe('top')
})

test('the hidden native select carries the value for autofill and forms', () => {
  const fruit = reatomSelect({
    nativeName: 'fruit',
    nativeRequired: true,
    name: 'fruit',
  })
  mount(fruit, ['Apple', 'Orange'])

  expect(fruit.props.native()).toMatchObject({
    name: 'fruit',
    form: undefined,
    required: true,
    multiple: false,
    value: 'Apple',
    tabIndex: -1,
    'aria-hidden': true,
  })
  expect(fruit.props.native().style.position).toBe('absolute')
  expect(fruit.props.nativeOptions()).toEqual(['Apple', 'Orange'])
})

test('a value no item carries still gets an option of its own', () => {
  const fruit = reatomSelect({ value: 'Pear', name: 'fruit' })
  mount(fruit, ['Apple'])

  expect(fruit.props.nativeOptions()).toEqual(['Pear', 'Apple'])
})

test('an autofill writes the native value into the model', () => {
  const fruit = reatomSelect({ nativeName: 'fruit', name: 'fruit' })
  mount(fruit, ['Apple', 'Orange'])

  fruit.props.native().onChange({ target: { value: 'Orange' } })
  expect(fruit()).toBe('Orange')

  const fruits = reatomSelect({
    value: [],
    nativeName: 'fruits',
    name: 'fruits',
  })
  mount(fruits, ['Apple', 'Orange'])
  expect(fruits.props.native().multiple).toBe(true)

  fruits.props.native().onChange({
    target: { selectedOptions: [{ value: 'Apple' }, { value: 'Orange' }] },
  })
  expect(fruits()).toEqual(['Apple', 'Orange'])
})

test('focus landing on the native select is handed to the button', () => {
  const fruit = reatomSelect({ nativeName: 'fruit', name: 'fruit' })
  const { button } = mount(fruit)

  fruit.props.native().onFocus()
  expect(button.focused).toBe(1)
})

// --- the pure role helpers ---------------------------------------------------

test('the item role follows the popup role', () => {
  expect(selectItemRole('listbox')).toBe('option')
  expect(selectItemRole('menu')).toBe('menuitem')
  expect(selectItemRole('tree')).toBe('treeitem')
  expect(selectItemRole('grid')).toBe('option')
  expect(selectItemRole('dialog')).toBe('option')

  expect(isSelectMultiSelectableRole('listbox')).toBe(true)
  expect(isSelectMultiSelectableRole('tree')).toBe(true)
  expect(isSelectMultiSelectableRole('grid')).toBe(true)
  expect(isSelectMultiSelectableRole('menu')).toBe(false)
  expect(isSelectMultiSelectableRole('dialog')).toBe(false)
})

// --- naming ------------------------------------------------------------------

test('every unit is named after the model', () => {
  const fruit = reatomSelect({ name: 'fruit' })

  expect(fruit.name).toBe('fruit')
  expect(fruit.composite.name).toBe('fruit.composite')
  expect(fruit.popover.name).toBe('fruit.popover')
  expect(fruit.selectedId.name).toBe('fruit.selectedId')
  expect(fruit.select.name).toBe('fruit.select')
  expect(fruit.props.select.name).toBe('fruit.props.select')
  expect(fruit.props.item('Apple').name).toBe('fruit.props.item#Apple')

  // an unnamed select still gets a unique one
  const anonymous = reatomSelect()
  expect(anonymous.name).toMatch(/^select#\d+$/)
})

test('peeking never leaves a subscription behind', () => {
  const fruit = reatomSelect({ name: 'fruit' })
  const spy = vi.fn()
  const unsubscribe = fruit.subscribe(spy)

  mount(fruit, ['Apple'])
  expect(peek(fruit)).toBe('Apple')

  unsubscribe()
})
