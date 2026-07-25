import { atom, context } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { reatomComposite } from '../composite/reatomComposite'
import { tagProps, tagRemoveElementId, withTagProps } from './props'
import type { Tag } from './reatomTag'
import { reatomTag, withTag } from './reatomTag'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but the composite derivations
 * depend on whether an item _has_ an element, and two tag handlers call
 * `focus()` on the input. Everything that needs a real element — the click that
 * focuses the input, the caret, the touch probe — is in `tag.test.browser.ts`.
 */
const element = (): HTMLElement & { focused: number } => {
  const fake = { focused: 0, focus: () => void fake.focused++ }
  return fake as unknown as HTMLElement & { focused: number }
}

/**
 * A self-targeted event, which is what every tag handler expects. `init` has a
 * default rather than being optional so that its keys stay _required_ in the
 * result — an optional spread would widen `key` to `key?: string`, which no
 * keyboard handler accepts.
 */
const event = <T extends object>(target: unknown, init: T = {} as T) => ({
  target,
  currentTarget: target,
  preventDefault: () => {},
  ...init,
})

/** Puts a value and a caret on a fake input, as the browser would. */
const typed = (input: HTMLElement, value: string, caret = value.length) =>
  Object.assign(input, {
    value,
    selectionStart: caret,
    selectionEnd: caret,
  })

/**
 * Mounts a tag widget the way a view adapter does: one element per value in
 * order, then the label and the input. `sync` reconciles the tag elements
 * against `values` — the unmount half a list renderer does for free, and what
 * the model needs to stop navigating to a removed tag.
 */
const mount = (tag: Tag) => {
  const label = element()
  const input = element()
  const tags = new Map<string, ReturnType<typeof element>>()

  const sync = () => {
    const values = tag.values()

    for (const value of [...tags.keys()]) {
      if (values.includes(value)) continue
      tag.props.tag(value)().ref(null)
      tags.delete(value)
    }

    for (const value of values) {
      if (tags.has(value)) continue
      const el = element()
      tags.set(value, el)
      tag.props.tag(value)().ref(el)
    }
  }

  sync()
  tag.props.label().ref(label)
  tag.props.input().ref(input)

  return { label, input, tags, sync }
}

// --- the model ---------------------------------------------------------------

test('a tag model is a composite of the tags plus the input', () => {
  const tag = reatomTag({ values: ['react'], name: 'invitees' })

  expect(tag.value()).toBe('')
  expect(tag.values()).toEqual(['react'])
  expect(tag.inputId()).toBe('invitees-input')
  expect(tag.labelId()).toBe('invitees-label')
  expect(tag.id()).toBe('invitees')
  expect(tag.touch()).toBe(false)

  // nothing is registered until the view renders the elements
  expect(tag.items.ids()).toEqual([])
  expect(tag.tagIds()).toEqual([])
  expect(tag.inputItem()).toBe(null)
})

test('the input is the default active item, so Tab enters the widget there', () => {
  const tag = reatomTag({ values: ['react', 'jsx'], name: 'invitees' })

  // decided before anything renders, unlike the composite's own "first
  // rendered item" seed — which would hand the tab stop to a tag
  expect(tag()).toBe('invitees-input')

  const { tags, input } = mount(tag)
  expect(tag.items.ids()).toEqual([
    'invitees-tag-1',
    'invitees-tag-2',
    'invitees-input',
  ])
  expect(tags.size).toBe(2)
  expect(tag()).toBe('invitees-input')

  // Ariakit's own example: Home reaches the first tag, End the input
  expect(tag.first()).toBe('invitees-tag-1')
  expect(tag.last()).toBe('invitees-input')

  // and exactly one element is in the tab order: the input
  expect(tag.props.tag('react')().tabIndex).toBe(-1)
  expect(tag.props.tag('jsx')().tabIndex).toBe(-1)
  expect(tag.props.input().tabIndex).toBe(undefined)
  expect(tag.inputItem()!.tabbable()).toBe(true)
  // and nothing was focused on mount, because the seed is a write and not a move
  expect(input.focused).toBe(0)
})

test('an explicit activeId opts out of the input seed', () => {
  const tag = reatomTag({ activeId: null, values: ['react'], name: 'explicit' })
  expect(tag()).toBe(null)

  const seeded = reatomTag({ activeId: 'explicit-tag-1', name: 'chosen' })
  expect(seeded()).toBe('explicit-tag-1')
})

test('value and values adopt a caller-owned atom as they are', () => {
  const field = atom(['react'], 'field')
  const text = atom('re', 'text')
  const tag = reatomTag({ valuesAtom: field, valueAtom: text, name: 'bound' })

  expect(tag.values).toBe(field)
  expect(tag.value).toBe(text)

  tag.addValue('jsx')
  expect(field()).toEqual(['react', 'jsx'])

  // the caller's own writes are the model's state, with no proxy in between
  field.set(['vue'])
  expect(tag.values()).toEqual(['vue'])
})

test('an initial value and an adopted atom are mutually exclusive', () => {
  expect(() =>
    reatomComposite({ name: 'both' }).extend(
      withTag({ values: ['a'], valuesAtom: atom<Array<string>>([], 'other') }),
    ),
  ).toThrow('pass either "values" or "valuesAtom"')

  expect(() =>
    reatomComposite({ name: 'both' }).extend(
      withTag({ value: 'a', valueAtom: atom('', 'other') }),
    ),
  ).toThrow('pass either "value" or "valueAtom"')
})

test('the value transitions are guarded and report what they did', () => {
  const tag = reatomTag({ name: 'values' })

  expect(tag.addValue('react')).toBe(true)
  expect(tag.addValue('react')).toBe(false)
  expect(tag.addValue('jsx')).toBe(true)
  expect(tag.values()).toEqual(['react', 'jsx'])

  expect(tag.removeValue('vue')).toBe(false)
  expect(tag.removeValue('react')).toBe(true)
  expect(tag.values()).toEqual(['jsx'])

  expect(tag.removeLastValue()).toBe('jsx')
  expect(tag.removeLastValue()).toBe(undefined)
  expect(tag.values()).toEqual([])

  // a bulk change is a plain write, Ariakit's `setValues`
  tag.values.set(['a', 'b'])
  expect(tag.values()).toEqual(['a', 'b'])
})

test('a tag value keeps its element id for the lifetime of the model', () => {
  const tag = reatomTag({ name: 'ids' })

  const react = tag.tagId('react')
  expect(react).toBe('ids-tag-1')
  expect(tag.tagId('jsx')).toBe('ids-tag-2')
  // allocated once, so re-rendering the same tag keeps its DOM id
  expect(tag.tagId('react')).toBe(react)

  // arbitrary text is a valid tag value but never a valid DOM id, which is why
  // the ids are generated rather than derived
  expect(tag.tagId('abc def')).toBe('ids-tag-3')

  expect(tag.tagValue(react)).toBe('react')
  expect(tag.tagValue('ids-input')).toBe(undefined)
  expect(tag.tagValue('gone')).toBe(undefined)
  expect(tag.tagValue(null)).toBe(undefined)
  expect(tag.tagValue()).toBe(undefined)

  // removing and re-adding a value reuses its id
  tag.renderTag('react')
  tag.unrenderTag('react')
  expect(tag.tagId('react')).toBe(react)
})

test('rendering an element is what makes a tag navigable', () => {
  const tag = reatomTag({ values: ['react'], name: 'render' })

  expect(tag.tagItem('react')).toBe(null)
  const item = tag.renderTag('react', { element: element() })
  expect(tag.tagItem('react')).toBe(item)
  // the value is the item's typeahead text, as Ariakit reads it off textContent
  expect(item.text()).toBe('react')

  expect(tag.tagItems()).toEqual([item])
  expect(tag.tagIds()).toEqual(['render-tag-1'])

  const input = tag.renderInput({ element: element() })
  expect(tag.inputItem()).toBe(input)
  // the input is a composite item but never a tag
  expect(tag.tagIds()).toEqual(['render-tag-1'])

  expect(tag.unrenderTag('react')).toBe(true)
  expect(tag.tagIds()).toEqual([])
  // an unknown value never throws, which is normal during a mount race
  expect(tag.unrenderTag('vue')).toBe(false)

  expect(tag.unrenderInput()).toBe(true)
  expect(tag.inputItem()).toBe(null)
})

test('removeTag removes and lands on a neighbour, resolved before it unmounts', () => {
  const tag = reatomTag({ values: ['a', 'b', 'c'], name: 'remove' })
  const { sync } = mount(tag)

  // Delete steps forward. The neighbour is resolved while the removed tag is
  // still rendered — its neighbours are only knowable there.
  tag.set(tag.tagId('b'))
  expect(tag.removeTag('b', 'next')).toBe(tag.tagId('c'))
  expect(tag.values()).toEqual(['a', 'c'])
  expect(tag()).toBe(tag.tagId('c'))

  // the view unmounts the element afterwards, which unrenders the item
  sync()
  expect(tag.tagItem('b')).toBe(null)
  expect(tag.tagIds()).toEqual([tag.tagId('a'), tag.tagId('c')])

  // Backspace steps back, over the tag that is now gone
  tag.set(tag.tagId('c'))
  expect(tag.removeTag('c', 'previous')).toBe(tag.tagId('a'))
  expect(tag()).toBe(tag.tagId('a'))
  expect(tag.values()).toEqual(['a'])
})

test('Backspace on the first tag falls forward, since there is no previous one', () => {
  const tag = reatomTag({ values: ['a', 'b'], name: 'first' })
  const { sync } = mount(tag)

  tag.set(tag.tagId('a'))
  // Ariakit's `previous() || next()`
  expect(tag.removeTag('a', 'previous')).toBe(tag.tagId('b'))
  expect(tag()).toBe(tag.tagId('b'))
  sync()

  // the only tag left: the removal lands on the input
  expect(tag.removeTag('b', 'previous')).toBe('first-input')
  expect(tag()).toBe('first-input')
  expect(tag.values()).toEqual([])
})

test('moveToInput activates the input as a focus move', () => {
  const tag = reatomTag({ values: ['a'], name: 'toInput' })
  mount(tag)

  tag.set(tag.tagId('a'))
  tag.moveToInput()
  expect(tag()).toBe('toInput-input')
})

test('withTag composes onto a hand-built composite, and names every unit', () => {
  const tag = reatomComposite({
    orientation: 'horizontal',
    name: 'menu.tag',
  }).extend(withTag({ values: ['a'] }), withTagProps())

  expect(tag()).toBe('menu-tag-input')
  expect(tag.orientation()).toBe('horizontal')
  expect(tag.props.listbox()['aria-orientation']).toBe('horizontal')

  expect(tag.name).toBe('menu.tag')
  expect(tag.values.name).toBe('menu.tag.values')
  expect(tag.value.name).toBe('menu.tag.value')
  expect(tag.addValue.name).toBe('menu.tag.addValue')
  expect(tag.removeTag.name).toBe('menu.tag.removeTag')
  expect(tag.props.list.name).toBe('menu.tag.props.list')
  expect(tag.props.tag('a').name).toBe('menu.tag.props.tag#a')
  expect(tag.props.remove('a').name).toBe('menu.tag.props.remove#a')
})

// --- the listbox, the label and the list -------------------------------------

test('the listbox owns the tags for assistive technology', () => {
  const tag = reatomTag({ values: ['react', 'jsx'], name: 'aria' })

  expect(tag.props.listbox()).toEqual({
    role: 'listbox',
    'aria-live': 'polite',
    'aria-relevant': 'all',
    'aria-atomic': true,
    'aria-label': undefined,
    // no label element yet, and a dangling reference is worse than none
    'aria-labelledby': undefined,
    // 'both' has no ARIA counterpart
    'aria-orientation': undefined,
    'aria-owns': '',
    style: { position: 'fixed' },
  })

  mount(tag)
  expect(tag.props.listbox()['aria-owns']).toBe('aria-tag-1 aria-tag-2')
  expect(tag.props.listbox()['aria-labelledby']).toBe('aria-label')

  tag.orientation.set('vertical')
  expect(tag.props.listbox()['aria-orientation']).toBe('vertical')

  // a touch screen can not reach an `option` with a virtual cursor
  tag.touch.set(true)
  expect(tag.props.listbox().role).toBe('list')
})

test('an aria-label takes precedence over the label element', () => {
  const tag = reatomTag({ label: 'Invitees', name: 'labelled' })
  mount(tag)

  expect(tag.props.listbox()['aria-label']).toBe('Invitees')
  expect(tag.props.listbox()['aria-labelledby']).toBe(undefined)
})

test('the label points at the input, and tracks its own element', () => {
  const tag = reatomTag({ name: 'label' })

  expect(tag.props.label()).toMatchObject({
    id: 'label-label',
    htmlFor: 'label-input',
  })

  const el = element()
  tag.props.label().ref(el)
  expect(tag.labelElement()).toBe(el)
  tag.props.label().ref(null)
  expect(tag.labelElement()).toBe(null)
})

test('the list record is the composite base plus the click-to-focus behavior', () => {
  const tag = reatomTag({ name: 'list' })

  // one record under two names, so `$spread={tag.props.list}` and the generic
  // `props.base` are the same thing
  expect(tag.props.base).toBe(tag.props.list)
  expect(tag.props.list()).toMatchObject({
    id: 'list',
    'aria-activedescendant': undefined,
    tabIndex: undefined,
  })
  // inherited from the composite records, which stay reachable
  expect(typeof tag.props.list().onKeyDown).toBe('function')
  expect(typeof tag.props.list().onMouseDown).toBe('function')
  expect(typeof tag.props.item).toBe('function')
})

// --- the input --------------------------------------------------------------

test('the input ref both tracks the element and renders the composite item', () => {
  const tag = reatomTag({ name: 'inputRef' })
  const el = element()

  tag.props.input().ref(el)
  expect(tag.inputElement()).toBe(el)
  // the element being in the DOM is exactly what "rendered" means
  expect(tag.inputItem()!.element()).toBe(el)
  expect(tag.inputItem()!.rendered()).toBe(true)

  tag.props.input().ref(null)
  expect(tag.inputElement()).toBe(null)
  expect(tag.inputItem()).toBe(null)
})

test('focusing the input makes it the active item', () => {
  const tag = reatomTag({ values: ['a'], name: 'inputFocus' })
  const { input } = mount(tag)

  tag.set(tag.tagId('a'))
  tag.props.input().onFocus(event(input))
  expect(tag()).toBe('inputFocus-input')

  // a focus event bubbling from a child is not the input's business
  tag.set(tag.tagId('a'))
  tag.props.input().onFocus({ ...event(input), target: element() })
  expect(tag()).toBe(tag.tagId('a'))
})

test('typing a delimiter turns the text before it into tags', () => {
  const tag = reatomTag({ name: 'change' })
  const input = element()

  const type = (value: string, caret?: number) =>
    tag.props.input().onInput(event(typed(input, value, caret)))

  type('react')
  expect(tag.value()).toBe('react')
  expect(tag.values()).toEqual([])

  type('react,')
  expect(tag.values()).toEqual(['react'])
  // only the part after the delimiter stays in the input
  expect(tag.value()).toBe('')

  // a paste-like change adds several tags at once
  type('a,b,c')
  expect(tag.values()).toEqual(['react', 'a', 'b'])
  expect(tag.value()).toBe('c')

  // editing in the middle of the value is text editing, not tagging
  type('x,y', 1)
  expect(tag.value()).toBe('x,y')
  expect(tag.values()).toEqual(['react', 'a', 'b'])
})

test('the change behaviors are separately switchable', () => {
  const tag = reatomTag({ setValueOnChange: false, name: 'noStore' })
  tag.props.input().onInput(event(typed(element(), 'react,')))
  // the tag is still added, only the raw text is not stored — which is how a
  // caller derives the input value itself
  expect(tag.values()).toEqual(['react'])
  expect(tag.value()).toBe('')

  const kept = reatomTag({ addValueOnChange: false, name: 'noAdd' })
  kept.props.input().onInput(event(typed(element(), 'react,')))
  expect(kept.values()).toEqual([])
  expect(kept.value()).toBe('react,')

  const custom = reatomTag({ delimiter: ';', name: 'semicolon' })
  custom.props.input().onInput(event(typed(element(), 'a,b;')))
  // the comma is not a delimiter here, so it stays inside the value
  expect(custom.values()).toEqual(['a,b'])
})

test('pasting text adds one tag per delimited value', () => {
  const tag = reatomTag({ name: 'paste' })
  const clipboard = (text: string) => ({ getData: () => text })

  let prevented = 0
  const paste = (text: string) =>
    tag.props.input().onPaste({
      clipboardData: clipboard(text),
      preventDefault: () => prevented++,
    })

  paste('  react, jsx  ')
  expect(tag.values()).toEqual(['react', 'jsx'])
  // the text became tags, so it must not also be inserted
  expect(prevented).toBe(1)

  // plain text with no delimiter keeps the browser's own paste
  paste('vue')
  expect(tag.values()).toEqual(['react', 'jsx'])
  expect(prevented).toBe(1)

  const off = reatomTag({ addValueOnPaste: false, name: 'noPaste' })
  off.props.input().onPaste({ clipboardData: clipboard('a,b') })
  expect(off.values()).toEqual([])
})

test('Backspace at the start of the input removes the last tag', () => {
  const tag = reatomTag({ values: ['a', 'b'], name: 'backspace' })
  const { input, sync } = mount(tag)

  const press = (caret: number, value = '') =>
    tag.props.input().onKeyDown(
      event(typed(input, value, caret), {
        key: 'Backspace',
      }),
    )

  press(0)
  expect(tag.values()).toEqual(['a'])
  sync()

  // there is text to the left, so Backspace edits it
  press(2, 'jsx')
  expect(tag.values()).toEqual(['a'])

  // ... and a selection is deleted instead
  Object.assign(input, { selectionStart: 0, selectionEnd: 3 })
  tag.props.input().onKeyDown(event(input, { key: 'Backspace' }))
  expect(tag.values()).toEqual(['a'])

  press(0)
  expect(tag.values()).toEqual([])
  // an empty tag list is not an error
  press(0)
  expect(tag.values()).toEqual([])

  const off = reatomTag({
    values: ['a'],
    removeOnBackspace: false,
    name: 'keepTags',
  })
  off.props.input().onKeyDown(event(typed(element(), ''), { key: 'Backspace' }))
  expect(off.values()).toEqual(['a'])
})

test('the arrow keys leave the input only from the edge of its value', () => {
  const tag = reatomTag({ values: ['a', 'b'], name: 'inputKeys' })
  const { input } = mount(tag)

  let prevented = 0
  const press = (key: string, caret: number, value = 'jsx') =>
    tag.props.input().onKeyDown(
      event(typed(input, value, caret), {
        key,
        preventDefault: () => prevented++,
      }),
    )

  // the caret is inside the text, so the key moves it and not the active item
  press('ArrowLeft', 2)
  expect(tag()).toBe('inputKeys-input')
  expect(prevented).toBe(0)

  // at the leading edge the widget takes over
  press('ArrowLeft', 0)
  expect(tag()).toBe(tag.tagId('b'))
  expect(prevented).toBe(1)

  // the forward keys need the caret at the other end
  tag.set('inputKeys-input')
  press('ArrowRight', 1)
  expect(tag()).toBe('inputKeys-input')
  expect(prevented).toBe(1)

  // Home and End belong to the widget whatever the caret does
  press('Home', 2)
  expect(tag()).toBe(tag.tagId('a'))
  expect(prevented).toBe(2)
})

// --- one tag ----------------------------------------------------------------

test('a tag renders as an option that its remove button describes', () => {
  const tag = reatomTag({ values: ['react'], name: 'one' })
  mount(tag)

  expect(tag.props.tag('react')()).toMatchObject({
    id: 'one-tag-1',
    role: 'option',
    'data-active-item': undefined,
    tabIndex: -1,
    'aria-describedby': 'one-tag-1-remove',
  })

  tag.set('one-tag-1')
  expect(tag.props.tag('react')()['data-active-item']).toBe(true)
  expect(tag.props.tag('react')().tabIndex).toBe(undefined)

  tag.touch.set(true)
  expect(tag.props.tag('react')().role).toBe('listitem')

  // a tag that renders no remove button is described by nothing
  const bare = tag.props.tag('react', { describeRemove: false })
  expect(bare()['aria-describedby']).toBe(undefined)
  expect(tagRemoveElementId('one-tag-1')).toBe('one-tag-1-remove')
})

test('the tag and remove records are memoized per value', () => {
  const tag = reatomTag({ values: ['react'], name: 'memo' })
  const record = tag.props.tag('react')

  // so a view adapter can attach the handlers once
  expect(tag.props.tag('react')).toBe(record)
  expect(tag.props.remove('react')).toBe(tag.props.remove('react'))
  expect(record().onFocus).toBe(tag.props.tag('react')().onFocus)

  // ... and options opt out of the cache, since they change the record
  expect(tag.props.tag('react', { removeOnKeyPress: false })).not.toBe(record)
})

test('a tag ref renders it, and focusing it makes it the active item', () => {
  const tag = reatomTag({ values: ['react'], name: 'tagRef' })
  const el = element()
  const props = tag.props.tag('react')

  props().ref(el)
  expect(tag.tagItem('react')!.element()).toBe(el)

  props().onFocus(event(el))
  expect(tag()).toBe('tagRef-tag-1')

  // the remove button lives inside the tag, so its focus event bubbles through
  tag.set('tagRef-input')
  props().onFocus({ ...event(el), target: element() })
  expect(tag()).toBe('tagRef-input')

  props().ref(null)
  expect(tag.tagItem('react')).toBe(null)
})

test('Backspace and Delete on a tag remove it and move on', () => {
  const tag = reatomTag({ values: ['a', 'b', 'c'], name: 'tagKeys' })
  const { sync } = mount(tag)

  let prevented = 0
  const press = (value: string, key: string) => {
    const target = element()
    tag.props
      .tag(value)()
      .onKeyDown({
        key,
        target,
        currentTarget: target,
        preventDefault: () => prevented++,
      })
  }

  tag.set(tag.tagId('b'))
  press('b', 'Delete')
  expect(tag.values()).toEqual(['a', 'c'])
  expect(tag()).toBe(tag.tagId('c'))
  expect(prevented).toBe(1)
  sync()

  tag.set(tag.tagId('c'))
  press('c', 'Backspace')
  expect(tag.values()).toEqual(['a'])
  expect(tag()).toBe(tag.tagId('a'))

  const off = reatomTag({ values: ['a'], name: 'tagKeysOff' })
  const target = element()
  off.props
    .tag('a', { removeOnKeyPress: false })()
    .onKeyDown({ key: 'Backspace', target, currentTarget: target })
  expect(off.values()).toEqual(['a'])
})

test('typing on a tag hands the key to the input, without preventing it', () => {
  const tag = reatomTag({ values: ['react'], name: 'typing' })
  const { input } = mount(tag)

  let prevented = 0
  const press = (key: string, init?: object) => {
    const target = element()
    tag.props
      .tag('react')()
      .onKeyDown({
        key,
        target,
        currentTarget: target,
        preventDefault: () => prevented++,
        ...init,
      })
  }

  press('x')
  expect(input.focused).toBe(1)
  // no preventDefault: focus moves synchronously, so the browser inserts the
  // character into the input that just received it
  expect(prevented).toBe(0)

  press('v', { ctrlKey: true })
  expect(input.focused).toBe(2)
  expect(prevented).toBe(0)

  // the widget's own keys navigate instead
  press('ArrowLeft')
  expect(input.focused).toBe(2)

  // a handled event is left alone entirely
  press('y', { defaultPrevented: true })
  expect(input.focused).toBe(2)
})

test('an arrow key on a tag navigates the list', () => {
  const tag = reatomTag({ values: ['a', 'b'], name: 'tagNav' })
  mount(tag)

  let prevented = 0
  const press = (value: string, key: string) => {
    const target = element()
    tag.props
      .tag(value)()
      .onKeyDown({
        key,
        target,
        currentTarget: target,
        preventDefault: () => prevented++,
      })
  }

  tag.set(tag.tagId('a'))
  press('a', 'ArrowRight')
  expect(tag()).toBe(tag.tagId('b'))
  expect(prevented).toBe(1)

  // End reaches the input, which is the last item
  press('b', 'End')
  expect(tag()).toBe('tagNav-input')
  expect(prevented).toBe(2)

  // nowhere to go from there, so the key keeps its default behavior
  press('a', 'ArrowRight')
  expect(tag()).toBe('tagNav-input')
  expect(prevented).toBe(2)

  // Home reaches the first tag
  press('a', 'Home')
  expect(tag()).toBe(tag.tagId('a'))
  expect(prevented).toBe(3)
})

// --- the remove button ------------------------------------------------------

test('the remove button is decorative unless the device is a touch screen', () => {
  const tag = reatomTag({ values: ['react'], name: 'rm' })

  expect(tag.props.remove('react')()).toMatchObject({
    id: 'rm-tag-1-remove',
    role: undefined,
    'aria-hidden': true,
    // announced through the tag's aria-describedby
    'aria-label': 'Press Delete or Backspace to remove',
    type: undefined,
  })

  // on a touch screen it is the only way to remove a tag, so it becomes real
  tag.touch.set(true)
  expect(tag.props.remove('react')()).toMatchObject({
    role: 'button',
    'aria-hidden': undefined,
    'aria-label': 'Remove react',
    // and a real button inside a form must not submit it
    type: 'button',
  })

  const custom = tag.props.remove('react', {
    removeLabel: (value) => `Dismiss ${value}`,
    hint: 'Delete removes it',
  })
  expect(custom()['aria-label']).toBe('Dismiss react')
  tag.touch.set(false)
  expect(custom()['aria-label']).toBe('Delete removes it')
})

test('clicking remove drops the tag and returns to the input', () => {
  const tag = reatomTag({ values: ['a', 'b'], name: 'click' })
  const { input } = mount(tag)

  tag.set(tag.tagId('a'))
  tag.props.remove('a')().onClick()

  expect(tag.values()).toEqual(['b'])
  // the active item and DOM focus agree, so a headless flow is correct too
  expect(tag()).toBe('click-input')
  expect(input.focused).toBe(1)

  // a handled event is left alone
  tag.props.remove('b')().onClick({ defaultPrevented: true })
  expect(tag.values()).toEqual(['b'])
})

// --- composition ------------------------------------------------------------

test('tagProps reuses the composite records it is given', () => {
  const tag = reatomTag({ name: 'reuse' })
  const records = tagProps(tag, { composite: tag.props, name: 'reuse' })

  // the composite handlers are shared rather than allocated a second time
  expect(records.item).toBe(tag.props.item)
  expect(records.list().onKeyDown).toBe(tag.props.list().onKeyDown)
  // ... while the tag layer is the caller's own
  expect(records.list).not.toBe(tag.props.list)
})

test('the input can join the roving tabindex, like any composite item', () => {
  const tag = reatomTag({ tabbable: false, values: ['a'], name: 'roving' })
  mount(tag)

  // active, so it holds the single tab stop
  expect(tag.props.input().tabIndex).toBe(undefined)

  tag.set(tag.tagId('a'))
  expect(tag.props.input().tabIndex).toBe(-1)
  expect(tag.props.tag('a')().tabIndex).toBe(undefined)
})
