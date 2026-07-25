import { context, effect, getCalls, notify, sleep, wrap } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { applyTypeaheadIntent } from './props'
import { reatomComposite } from './reatomComposite'
import type { TypeaheadItem } from './typeahead'
import {
  isTypeaheadKey,
  matchTypeahead,
  reatomTypeahead,
  restartTypeaheadItems,
  TYPEAHEAD_TIMEOUT,
  typeaheadItemStartsWith,
  typeaheadItemText,
} from './typeahead'

beforeEach(() => context.reset())

/** The fruit basket every matcher case is resolved against. */
const fruits: Array<TypeaheadItem> = [
  { id: 'apple', text: 'Apple' },
  { id: 'apricot', text: 'Apricot' },
  { id: 'banana', text: 'Banana' },
  { id: 'blueberry', text: 'Blueberry', disabled: true },
  { id: 'cherry', text: 'Cherry' },
]

/**
 * A fake element: Layer 1 never touches the DOM, but the Layer 2 guards compare
 * the event target against the item elements. The real DOM cases live in
 * `typeahead.test.browser.ts`.
 */
const element = () => ({}) as HTMLElement

const keyEvent = (
  key: string,
  target: HTMLElement,
  currentTarget: HTMLElement,
  init: Record<string, unknown> = {},
) => {
  const event = {
    key,
    target,
    currentTarget,
    prevented: false,
    preventDefault: () => {
      event.prevented = true
    },
    ...init,
  }
  return event as unknown as KeyboardEvent & { prevented: boolean }
}

// --- isTypeaheadKey ---------------------------------------------------------

test('a typeahead key is one printable character, unicode included', () => {
  expect(isTypeaheadKey({ key: 'a' })).toBe(true)
  expect(isTypeaheadKey({ key: 'Z' })).toBe(true)
  expect(isTypeaheadKey({ key: '7' })).toBe(true)
  // `\p{Letter}\p{Number}` and not `[a-z0-9]`, so every script types ahead
  expect(isTypeaheadKey({ key: 'é' })).toBe(true)
  expect(isTypeaheadKey({ key: 'ж' })).toBe(true)
  expect(isTypeaheadKey({ key: '字' })).toBe(true)
  expect(isTypeaheadKey({ key: '٣' })).toBe(true)

  // punctuation and every named key are not typeahead
  expect(isTypeaheadKey({ key: '-' })).toBe(false)
  expect(isTypeaheadKey({ key: '.' })).toBe(false)
  expect(isTypeaheadKey({ key: 'ArrowDown' })).toBe(false)
  expect(isTypeaheadKey({ key: 'Enter' })).toBe(false)
  expect(isTypeaheadKey({ key: 'Escape' })).toBe(false)

  // a shortcut belongs to the app, not to the widget
  expect(isTypeaheadKey({ key: 'a', ctrlKey: true })).toBe(false)
  expect(isTypeaheadKey({ key: 'a', altKey: true })).toBe(false)
  expect(isTypeaheadKey({ key: 'a', metaKey: true })).toBe(false)
})

test('space types ahead only inside a word, so it can still activate an item', () => {
  expect(isTypeaheadKey({ key: ' ' })).toBe(false)
  expect(isTypeaheadKey({ key: ' ' }, '')).toBe(false)
  expect(isTypeaheadKey({ key: ' ' }, 'new')).toBe(true)
})

// --- the item text ----------------------------------------------------------

test('the matched text is typeaheadText, then text, then value', () => {
  expect(typeaheadItemText({ id: 'a', text: 'Apple' })).toBe('Apple')
  expect(typeaheadItemText({ id: 'a', value: 'Apple' })).toBe('Apple')
  expect(typeaheadItemText({ id: 'a', text: '', value: 'Apple' })).toBe('Apple')
  expect(
    typeaheadItemText({ id: 'a', text: 'Apple', typeaheadText: 'Pomme' }),
  ).toBe('Pomme')
  expect(typeaheadItemText({ id: 'a' })).toBe(undefined)

  // an empty `typeaheadText` wins over both fallbacks: it opts the item out
  expect(
    typeaheadItemText({
      id: 'a',
      text: 'Apple',
      value: 'Apple',
      typeaheadText: '',
    }),
  ).toBe('')
})

test('matching is case-insensitive, trimmed, and diacritics-insensitive', () => {
  const item = { id: 'a', text: '  Ångström  ' }

  // the item text is normalized (`NFD` minus the combining marks) and the typed
  // characters are only lowercased, exactly as in Ariakit: the plain letters of
  // any keyboard reach an accented label
  expect(typeaheadItemStartsWith(item, 'an')).toBe(true)
  expect(typeaheadItemStartsWith(item, 'ANGS')).toBe(true)
  expect(typeaheadItemStartsWith(item, 'ångs')).toBe(false)
  expect(typeaheadItemStartsWith(item, 'ström')).toBe(false)
  expect(typeaheadItemStartsWith({ id: 'a', text: 'Zoë' }, 'zoe')).toBe(true)

  // an item with no text, or one opted out, matches nothing
  expect(typeaheadItemStartsWith({ id: 'a' }, 'a')).toBe(false)
  expect(typeaheadItemStartsWith({ id: 'a', typeaheadText: '' }, 'a')).toBe(
    false,
  )
})

// --- the restart decision ---------------------------------------------------

test('typing the same letter cycles, typing a word narrows', () => {
  const items = [
    { id: 'one', text: 'One' },
    { id: 'oof', text: 'Oof' },
    { id: 'other', text: 'Other' },
    { id: 'two', text: 'Two' },
  ]

  // cycling: the active item matches the char alone, so the buffer restarts and
  // the search resumes after it
  expect(
    restartTypeaheadItems({ items, activeId: 'one', char: 'o', chars: 'o' }),
  ).toEqual({
    chars: 'o',
    items: [items[1], items[2]],
  })

  // ... and it wraps around, which is what `flipItems` is for
  expect(
    restartTypeaheadItems({ items, activeId: 'other', char: 'o', chars: 'o' }),
  ).toEqual({
    chars: 'o',
    items: [items[0], items[1]],
  })

  // narrowing: `oo` still matches the active item, so nothing restarts —
  // Ariakit's "typing 'oo' will match 'oof' instead of moving to the next item"
  expect(
    restartTypeaheadItems({ items, activeId: 'oof', char: 'o', chars: 'oo' }),
  ).toEqual({ chars: 'oo', items })

  // the buffer no longer matches the active item, so the search cycles instead
  // of narrowing further down a dead end
  expect(
    restartTypeaheadItems({ items, activeId: 'one', char: 'o', chars: 'oo' }),
  ).toEqual({ chars: 'o', items: [items[1], items[2]] })

  // nothing to be relative to
  expect(
    restartTypeaheadItems({ items, activeId: null, char: 'o', chars: 'o' }),
  ).toEqual({ chars: 'o', items })
  expect(
    restartTypeaheadItems({ items, activeId: 'gone', char: 'o', chars: 'o' }),
  ).toEqual({ chars: 'o', items })
  // the active item does not start with the char: a plain search again
  expect(
    restartTypeaheadItems({ items, activeId: 'two', char: 'o', chars: 'o' }),
  ).toEqual({ chars: 'o', items })
})

// --- the matcher ------------------------------------------------------------

test('one key press matches the first item and keeps the buffer', () => {
  expect(matchTypeahead('b', { items: fruits })).toEqual({
    id: 'banana',
    chars: 'b',
  })
  // the key is lowercased, so Shift does not start a second buffer
  expect(matchTypeahead('B', { items: fruits })).toEqual({
    id: 'banana',
    chars: 'b',
  })
  // a disabled item is not a destination
  expect(matchTypeahead('l', { items: fruits, chars: 'b' })).toEqual({
    chars: '',
  })
})

test('a growing buffer narrows the match', () => {
  expect(matchTypeahead('a', { items: fruits })).toEqual({
    id: 'apple',
    chars: 'a',
  })
  expect(
    matchTypeahead('p', { items: fruits, activeId: 'apple', chars: 'a' }),
  ).toEqual({ id: 'apple', chars: 'ap' })
  expect(
    matchTypeahead('r', { items: fruits, activeId: 'apple', chars: 'ap' }),
  ).toEqual({ id: 'apricot', chars: 'apr' })
})

test('repeating a letter walks the items that start with it', () => {
  expect(matchTypeahead('a', { items: fruits, activeId: 'apple' })).toEqual({
    id: 'apricot',
    chars: 'a',
  })
  // and wraps, skipping the active item itself
  expect(matchTypeahead('a', { items: fruits, activeId: 'apricot' })).toEqual({
    id: 'apple',
    chars: 'a',
  })
})

test('a failed search clears the buffer, so the next key starts over', () => {
  expect(matchTypeahead('z', { items: fruits })).toEqual({ chars: '' })
  expect(
    matchTypeahead('z', { items: fruits, activeId: 'apple', chars: 'a' }),
  ).toEqual({ chars: '' })
})

test('typeaheadText overrides the text, and an empty one excludes the item', () => {
  const items: Array<TypeaheadItem> = [
    { id: 'citrus', text: 'Citrus', typeaheadText: '' },
    { id: 'canada', text: '🇨🇦 Canada', typeaheadText: 'Canada' },
    { id: 'dominion', text: 'Canada', typeaheadText: 'Dominion' },
  ]

  // the flag is not typed, and the opted-out item is skipped
  expect(matchTypeahead('c', { items })).toEqual({
    id: 'canada',
    chars: 'c',
  })
  expect(matchTypeahead('d', { items })).toEqual({
    id: 'dominion',
    chars: 'd',
  })
})

// --- the model --------------------------------------------------------------

test('the model buffers the characters and moves through the callback', () => {
  const moves: Array<string> = []
  let activeId: string | null = null

  const typeahead = reatomTypeahead({
    items: () => fruits,
    activeId: () => activeId,
    move: (id) => {
      activeId = id
      moves.push(id)
    },
    name: 'fruit.typeahead',
  })

  expect(typeahead()).toBe('')
  expect(typeahead.timeout()).toBe(TYPEAHEAD_TIMEOUT)
  expect(typeahead.name).toBe('fruit.typeahead')
  expect(typeahead.press.name).toBe('fruit.typeahead.press')

  expect(typeahead.press({ key: 'a' })).toEqual({ handled: true, id: 'apple' })
  expect(typeahead()).toBe('a')

  expect(typeahead.press({ key: 'p' })).toEqual({ handled: true, id: 'apple' })
  expect(typeahead.press({ key: 'r' })).toEqual({
    handled: true,
    id: 'apricot',
  })
  expect(typeahead()).toBe('apr')
  expect(moves).toEqual(['apple', 'apple', 'apricot'])

  // a key that is not typeahead abandons the buffer without moving
  expect(typeahead.press({ key: 'ArrowDown' })).toEqual({ handled: false })
  expect(typeahead()).toBe('')

  // so does a failed search, but the key was still consumed
  expect(typeahead.press({ key: 'z' })).toEqual({ handled: true })
  expect(typeahead()).toBe('')
  expect(moves).toEqual(['apple', 'apple', 'apricot'])
})

test('the buffer resets after the timeout, and a new key supersedes the wait', async () => {
  const typeahead = reatomTypeahead({
    items: () => fruits,
    timeout: 20,
    name: 'delayed.typeahead',
  })

  typeahead.press({ key: 'a' })
  typeahead.press({ key: 'p' })
  expect(typeahead()).toBe('ap')

  // `withAbort()`'s last-in-win: the second key dropped the first wait, so the
  // buffer is still alive one timeout after the first key
  await wrap(sleep(12))
  typeahead.press({ key: 'r' })
  await wrap(sleep(12))
  expect(typeahead()).toBe('apr')

  await wrap(sleep(20))
  expect(typeahead()).toBe('')
})

test('clear drops the buffer now, and enabled turns the whole thing off', async () => {
  const typeahead = reatomTypeahead({
    items: () => fruits,
    timeout: 20,
    name: 'off.typeahead',
  })

  typeahead.press({ key: 'a' })
  typeahead.clear()
  expect(typeahead()).toBe('')
  // the pending reset was aborted, so nothing writes the buffer behind our back
  typeahead.press({ key: 'b' })
  await wrap(sleep(12))
  expect(typeahead()).toBe('b')

  typeahead.enabled.set(false)
  expect(typeahead.press({ key: 'c' })).toEqual({ handled: false })
  // a disabled typeahead does not even clear: the characters are not its business
  expect(typeahead()).toBe('b')
})

// --- the composite model ----------------------------------------------------

test('a composite carries a typeahead of its own, off by default', () => {
  const composite = reatomComposite({ name: 'plain' })

  expect(composite.typeahead.enabled()).toBe(false)
  expect(composite.typeahead.name).toBe('plain.typeahead')
  expect(composite.typeahead.press({ key: 'a' })).toEqual({ handled: false })

  const menu = reatomComposite({ typeahead: true, name: 'opted' })
  expect(menu.typeahead.enabled()).toBe(true)
})

// Mirrors Ariakit's `composite-typeahead-buffer` case, where the first
// composite's live "ap" buffer used to leak into the second one.
test('two composites never share a buffer', () => {
  const first = reatomComposite({ typeahead: true, name: 'first' })
  first.items.renderItem({ id: 'alpha', text: 'Alpha' })
  first.items.renderItem({ id: 'alpine', text: 'Alpine' })
  first.items.renderItem({ id: 'apricot', text: 'Apricot' })

  const second = reatomComposite({ typeahead: true, name: 'second' })
  // `Cherry` first, so that a leaked buffer could not be hidden by the
  // same-initial cycling of a `b` press.
  second.items.renderItem({ id: 'cherry', text: 'Cherry' })
  second.items.renderItem({ id: 'banana', text: 'Banana' })

  expect(first()).toBe('alpha')
  first.typeahead.press({ key: 'a' })
  expect(first()).toBe('alpine')
  first.typeahead.press({ key: 'p' })
  expect(first()).toBe('apricot')
  expect(first.typeahead()).toBe('ap')

  // Ariakit needed a `WeakMap` keyed by store for this; here the buffer is a
  // unit of the model, so the leak is not expressible
  expect(second.typeahead()).toBe('')
  second.typeahead.press({ key: 'b' })
  expect(second.typeahead()).toBe('b')
  expect(second()).toBe('banana')
  expect(first.typeahead()).toBe('ap')
})

test('the typeahead items are the rendered ones, or all of them when more are known', () => {
  const composite = reatomComposite({ typeahead: true, name: 'items' })

  composite.items.registerItem({ id: 'apple', text: 'Apple' })
  composite.items.renderItem({
    id: 'apricot',
    text: 'Apricot',
    typeaheadText: 'Aprikose',
  })

  // Ariakit: "the composite list might be unmounted or virtualized, in which
  // case we'll use the original items" — which is what lets a closed select
  // type-ahead over options that never mounted
  expect(composite.typeaheadItems()).toEqual([
    {
      id: 'apple',
      disabled: false,
      rowId: undefined,
      text: 'Apple',
      typeaheadText: undefined,
    },
    {
      id: 'apricot',
      disabled: false,
      rowId: undefined,
      text: 'Apricot',
      typeaheadText: 'Aprikose',
    },
  ])

  composite.items.renderItem({ id: 'apple' })
  expect(composite.typeaheadItems().map((item) => item.id)).toEqual([
    'apple',
    'apricot',
  ])

  // `typeaheadText` is what the buffer is matched against
  composite.set(null)
  expect(composite.typeahead.press({ key: 'a' }).id).toBe('apple')
  expect(composite.typeahead.press({ key: 'p' }).id).toBe('apple')
  expect(composite.typeahead.press({ key: 'r' }).id).toBe('apricot')

  // ... and the per item atom is reactive, as every other item field is: an
  // empty text opts the item out
  composite.items.item('apricot')!.typeaheadText.set('')
  composite.typeahead.clear()
  composite.set(null)
  expect(composite.typeahead.press({ key: 'a' }).id).toBe('apple')
  composite.typeahead.clear()
  composite.set(null)
  expect(composite.typeahead.press({ key: 'r' }).id).toBe(undefined)
})

test('a typeahead jump is a move, so everything watching moves follows it', async () => {
  const composite = reatomComposite({
    typeahead: true,
    items: [
      { id: 'a', text: 'Apple' },
      { id: 'b', text: 'Banana' },
    ],
    name: 'moves',
  })
  composite.items.renderItem({ id: 'a' })
  composite.items.renderItem({ id: 'b' })

  const moved: Array<string | null | undefined> = []
  const stop = effect(() => {
    const calls = getCalls(composite.move)
    const id = composite()
    if (calls.length) moved.push(id)
  }, 'moves.observer')
  notify()

  composite.typeahead.press({ key: 'b' })
  notify()
  await null
  // this is what makes typing on a closed select write its value and
  // `withCompositeFocus` follow the jump — both watch `move`, not `activeId`
  expect(composite()).toBe('b')
  expect(moved).toEqual(['b'])

  stop()
})

// --- the prop record --------------------------------------------------------

test('the base prop record types ahead in the capture phase', () => {
  const composite = reatomComposite({ typeahead: true, name: 'props' })
  const container = element()
  const apple = composite.items.renderItem({
    id: 'apple',
    text: 'Apple',
    element: element(),
  })
  composite.items.renderItem({
    id: 'banana',
    text: 'Banana',
    element: element(),
  })
  const props = composite.props.base()
  props.ref(container)

  expect(composite()).toBe('apple')

  const event = keyEvent('b', container, container)
  props.onKeyDownCapture(event)
  expect(composite()).toBe('banana')
  // Ariakit prevents the default for every key it consumed
  expect(event.prevented).toBe(true)

  // the buffer keeps growing while the keys keep coming, even when the widened
  // search no longer moves anywhere
  const continued = keyEvent('a', container, container)
  props.onKeyDownCapture(continued)
  expect(composite.typeahead()).toBe('ba')
  expect(composite()).toBe('banana')
  expect(continued.prevented).toBe(true)

  // a key press on an item element counts too — that is where focus is with a
  // roving tabindex
  composite.typeahead.clear()
  const fromItem = keyEvent('a', apple.element()!, container)
  props.onKeyDownCapture(fromItem)
  expect(composite()).toBe('apple')
  expect(fromItem.prevented).toBe(true)
})

// The text-field guard needs a real element, so it lives in
// `typeahead.test.browser.ts`.
test('the handler ignores a handled event and a foreign target', () => {
  const composite = reatomComposite({
    typeahead: true,
    items: [
      { id: 'a', text: 'Apple' },
      { id: 'b', text: 'Banana' },
    ],
    name: 'guards',
  })
  const container = element()
  composite.items.renderItem({ id: 'a', element: element() })
  composite.items.renderItem({ id: 'b', element: element() })
  const props = composite.props.base()
  props.ref(container)
  composite.set('a')

  // already handled by a consumer's own handler
  props.onKeyDownCapture(
    keyEvent('b', container, container, { defaultPrevented: true }),
  )
  expect(composite()).toBe('a')

  // an element inside the widget that is neither the container nor an item — a
  // search input, a nested button — keeps its keys, and the buffer is abandoned
  composite.typeahead.press({ key: 'b' })
  expect(composite.typeahead()).toBe('b')
  props.onKeyDownCapture(keyEvent('a', element(), container))
  expect(composite.typeahead()).toBe('')
  expect(composite()).toBe('b')

  // a disabled typeahead is inert
  composite.typeahead.enabled.set(false)
  const inert = keyEvent('a', container, container)
  props.onKeyDownCapture(inert)
  expect(composite()).toBe('b')
  expect(inert.prevented).toBe(false)
})

test('applyTypeaheadIntent reports the id it moved to', () => {
  const composite = reatomComposite({
    typeahead: true,
    items: [
      { id: 'a', text: 'Apple' },
      { id: 'b', text: 'Banana' },
    ],
    name: 'intent',
  })
  const container = element()
  composite.items.renderItem({ id: 'a', element: element() })
  composite.items.renderItem({ id: 'b', element: element() })
  composite.props.base().ref(container)

  expect(
    applyTypeaheadIntent(composite, keyEvent('b', container, container)),
  ).toBe('b')
  expect(
    applyTypeaheadIntent(composite, keyEvent('z', container, container)),
  ).toBe(undefined)
  expect(
    applyTypeaheadIntent(
      composite,
      keyEvent('ArrowDown', container, container),
    ),
  ).toBe(undefined)
})
