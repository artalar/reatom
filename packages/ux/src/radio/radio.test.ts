import {
  atom,
  context,
  effect,
  getCalls,
  notify,
  reatomForm,
} from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import { radioItemProps } from './props'
import type { Radio, RadioItemModel, RadioValue } from './reatomRadio'
import { isRadioItemChecked, radioItemId, reatomRadio } from './reatomRadio'

beforeEach(() => context.reset())

/**
 * A fake element: Layer 1 never touches the DOM, but the roving tabindex
 * depends on whether a radio _has_ an element. The real DOM cases live in
 * `radio.test.browser.ts`.
 */
const element = () => ({}) as HTMLElement

/** Renders radios with elements, which is what a mounted group looks like. */
const render = (
  radio: Radio,
  ...values: Array<string | number>
): Array<RadioItemModel> =>
  values.map((value) => {
    const item = radio.item(value)
    item.render({ element: element() })
    return item
  })

/** The only two `FocusEvent` fields the prop records read. */
const focusEvent = (target: HTMLElement, currentTarget: HTMLElement) =>
  ({ target, currentTarget }) as unknown as FocusEvent

// --- pure transitions -------------------------------------------------------

test('isRadioItemChecked covers every state / item value pair', () => {
  expect(isRadioItemChecked('apple', 'apple')).toBe(true)
  expect(isRadioItemChecked('apple', 'orange')).toBe(false)
  expect(isRadioItemChecked(null, 'apple')).toBe(false)
  // numbers stay numbers, and the comparison is strict
  expect(isRadioItemChecked(1, 1)).toBe(true)
  expect(isRadioItemChecked(1, '1')).toBe(false)
  // `0` is a real value, not "nothing selected"
  expect(isRadioItemChecked(0, 0)).toBe(true)
  // a radio without a value only reports whether _something_ is selected,
  // matching Ariakit's `!!storeValue` fallback
  expect(isRadioItemChecked('apple')).toBe(true)
  expect(isRadioItemChecked(null)).toBe(false)
})

test('radioItemId derives a DOM-safe id from the group id and the value', () => {
  expect(radioItemId('plan', 'free')).toBe('plan-free')
  expect(radioItemId('plan', 2)).toBe('plan-2')
  expect(radioItemId('plan', 'a b/c')).toBe('plan-a-b-c')
  // the group prefix is what keeps two groups with the same values apart
  expect(radioItemId('billing', 'free')).not.toBe(radioItemId('plan', 'free'))
})

// --- defaults ---------------------------------------------------------------

test('a radio group starts empty, loops, and follows focus', () => {
  const plan = reatomRadio({ name: 'plan' })

  expect(plan()).toBe(null)
  expect(plan.checkedId()).toBe(undefined)
  expect(plan.editable()).toBe(true)
  // Ariakit's radio store overrides the composite default: a single-choice list
  // cycles with the arrow keys
  expect(plan.composite.focusLoop()).toBe(true)
  expect(plan.selectOnMove()).toBe(true)
  expect(plan.composite.id()).toBe('plan')
})

test('an initial value checks its radio and becomes the tab stop', () => {
  const plan = reatomRadio({ value: 'pro', name: 'plan' })
  expect(plan.checkedId()).toBe('plan-pro')
  // nothing is rendered yet, so there is no element to hold the tab stop
  expect(plan.composite()).toBe(undefined)

  const [free, pro] = render(plan, 'free', 'pro')

  // Ariakit needs a component effect for this ("TODO: Maybe this could be done
  // in the radio store directly?"); here it is a derivation
  expect(plan.composite()).toBe('plan-pro')
  expect(pro!.active()).toBe(true)
  expect(pro!.tabbable()).toBe(true)
  expect(free!.tabbable()).toBe(false)
  expect(pro!.checked()).toBe(true)
  expect(free!.checked()).toBe(false)
})

test('without a value the first enabled radio holds the tab stop', () => {
  const plan = reatomRadio({
    items: [{ value: 'free', disabled: true }, { value: 'pro' }],
    name: 'plan',
  })

  // the `items` option registers without rendering, exactly like composite's
  expect(plan.composite.items.ids()).toEqual(['plan-free', 'plan-pro'])
  expect(plan.composite.navigationItems()).toEqual([])
  expect(plan.item('free').disabled()).toBe(true)

  render(plan, 'free', 'pro')

  expect(plan()).toBe(null)
  expect(plan.composite()).toBe('plan-pro')
})

// --- item sub-models --------------------------------------------------------

test('item(value) is memoized, registers, and describes an unmounted radio', () => {
  const plan = reatomRadio({ name: 'plan' })
  const free = plan.item('free')

  expect(plan.item('free')).toBe(free)
  expect(free.name).toBe('plan#free')
  expect(free.id).toBe('plan-free')
  expect(free.value).toBe('free')
  // describing a radio registers it, which is not rendering it: it is known to
  // the group and keeps its state, but nothing is navigable yet
  expect(plan.composite.items.ids()).toEqual(['plan-free'])
  expect(free.node()?.rendered()).toBe(false)
  expect(plan.composite.navigationItems()).toEqual([])
  expect(free.checked()).toBe(false)
  expect(free.disabled()).toBe(false)
  expect(free.editable()).toBe(true)
  expect(free.active()).toBe(false)
  expect(free.element()).toBe(null)

  const node = free.render({ element: element() })
  expect(free.node()).toBe(node)
  expect(node.name).toBe('plan.composite.items#plan-free')
  expect(free.element()).toBe(node.element())
  expect(free.tabbable()).toBe(true)
})

test('update writes the per radio state without adding a reference', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free] = render(plan, 'free', 'pro')

  expect(free!.update({ disabled: true, text: 'Free' })).toBe(free!.node())
  expect(free!.disabled()).toBe(true)
  expect(free!.node()?.text()).toBe('Free')
  // an absent key is left alone, exactly like a repeated registration
  free!.update({ text: 'Free plan' })
  expect(free!.disabled()).toBe(true)

  free!.unrender()
  // one render, one unrender: the radio leaves the navigation but keeps its state
  expect(free!.disabled()).toBe(true)
  expect(free!.node()?.rendered()).toBe(false)
  expect(plan.composite.navigationItems().map((item) => item.id)).toEqual([
    'plan-pro',
  ])
})

test('a radio survives an unrender / re-render cycle', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free] = render(plan, 'free', 'pro')
  const node = free!.node()

  free!.unrender()
  expect(free!.node()).toBe(node)
  expect(free!.element()).toBe(null)

  free!.render({ element: element() })
  expect(plan.composite.navigationItems()).toHaveLength(2)

  // a caller can drop the item entirely, and the sub-model follows the new node
  plan.composite.items.unregisterItem(node!)
  plan.composite.items.unregisterItem(node!)
  expect(free!.node()).toBe(null)
  expect(free!.tabbable()).toBe(false)
  expect(free!.update()).toBe(null)

  free!.render({ element: element() })
  expect(free!.node()).not.toBe(node)
  expect(free!.id).toBe('plan-free')
})

// --- selection --------------------------------------------------------------

test('select checks a radio and moves the tab stop with it', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free, pro] = render(plan, 'free', 'pro')

  expect(plan.composite()).toBe('plan-free')

  expect(plan.select('pro')).toBe('pro')
  expect(plan()).toBe('pro')
  expect(pro!.checked()).toBe(true)
  expect(free!.checked()).toBe(false)
  // the checked radio is the tab stop, but a programmatic select does not move
  // DOM focus — that is what `composite.move` is for
  expect(plan.composite()).toBe('plan-pro')
  expect(pro!.tabbable()).toBe(true)

  expect(free!.select()).toBe('free')
  expect(plan()).toBe('free')
  expect(plan.composite()).toBe('plan-free')

  // `null` clears the selection, which no user interaction can do
  expect(plan.select(null)).toBe(null)
  expect(plan.checkedId()).toBe(undefined)
  // the tab stop stays where it was; nothing pins it anymore
  expect(plan.composite()).toBe('plan-free')
})

test('select is refused when the group or the radio can not change', () => {
  const plan = reatomRadio({ readOnly: true, name: 'plan' })
  const [, pro] = render(plan, 'free', 'pro')

  expect(plan.editable()).toBe(false)
  expect(pro!.editable()).toBe(false)
  expect(plan.select('pro')).toBe(null)
  expect(plan()).toBe(null)

  plan.readOnly.set(false)
  plan.disabled.set(true)
  expect(pro!.disabled()).toBe(true)
  expect(plan.select('pro')).toBe(null)

  plan.disabled.set(false)
  expect(plan.select('pro')).toBe('pro')

  // a disabled radio refuses on its own
  const team = plan.item('team')
  team.render({ element: element(), disabled: true })
  expect(team.disabled()).toBe(true)
  expect(team.editable()).toBe(false)
  expect(team.select()).toBe('pro')
  expect(plan()).toBe('pro')

  // writing the atom is the unguarded escape hatch, for hydration and tests
  plan.set('team')
  expect(plan()).toBe('team')
})

test('selection follows focus, but a plain activeId write is silent', () => {
  const plan = reatomRadio({ name: 'plan' })
  render(plan, 'free', 'pro', 'team')

  expect(plan.composite.navigate({ move: 'next' })).toBe('plan-pro')
  expect(plan()).toBe('pro')

  // the composite loops by default in a radio group
  plan.composite.navigate({ move: 'last' })
  expect(plan()).toBe('team')
  plan.composite.navigate({ move: 'next' })
  expect(plan()).toBe('free')

  // Ariakit's `setActiveId`: activate without selecting
  plan.composite.set('plan-team')
  expect(plan()).toBe('free')
  // ... and "nowhere to go" selects nothing either
  plan.composite.move(undefined)
  expect(plan()).toBe('free')
  // the group element is not a radio
  plan.composite.move(null)
  expect(plan()).toBe('free')
})

test('selectOnMove off keeps navigation and selection apart', () => {
  const plan = reatomRadio({ selectOnMove: false, name: 'plan' })
  const [, pro] = render(plan, 'free', 'pro')

  plan.composite.navigate({ move: 'next' })
  expect(plan.composite()).toBe('plan-pro')
  expect(plan()).toBe(null)
  expect(pro!.active()).toBe(true)
  expect(pro!.checked()).toBe(false)

  // the active radio can be selected explicitly, which is what `Space` does
  pro!.select()
  expect(plan()).toBe('pro')
})

test('a move onto a disabled radio moves without selecting', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [, pro] = render(plan, 'free', 'pro')
  pro!.render({ disabled: true })

  // navigation skips it...
  expect(plan.composite.next()).toBe(undefined)
  // ...and a programmatic move lands there without selecting it
  plan.composite.move('plan-pro')
  expect(plan.composite()).toBe('plan-pro')
  expect(plan()).toBe(null)
})

test('navigation skips disabled radios and respects the orientation', () => {
  const plan = reatomRadio({ orientation: 'vertical', name: 'plan' })
  const [free] = render(plan, 'free', 'pro', 'team')
  plan.item('pro').render({ disabled: true })

  expect(plan.composite()).toBe('plan-free')
  expect(plan.composite.next()).toBe('plan-team')
  expect(free!.checked()).toBe(false)

  plan.composite.navigate({ move: 'next' })
  expect(plan()).toBe('team')
  expect(plan.composite.orientation()).toBe('vertical')
})

// --- controlled value -------------------------------------------------------

test('valueAtom adopts a caller-owned atom in both directions', () => {
  const plan = atom<RadioValue>('free', 'plan.value')
  const radio = reatomRadio({ valueAtom: plan, name: 'radio' })
  render(radio, 'free', 'pro')

  expect(radio()).toBe('free')

  radio.select('pro')
  expect(plan()).toBe('pro')
  expect(radio()).toBe('pro')

  plan.set('free')
  expect(radio()).toBe('free')
  expect(radio.item('free').checked()).toBe(true)
  expect(radio.composite()).toBe('radio-free')

  // two models can share one atom, which is how one group drives two widgets
  const mirror = reatomRadio({ valueAtom: plan, name: 'mirror' })
  mirror.select('pro')
  expect(radio()).toBe('pro')
})

test('valueAtom drops the group into a form', () => {
  const form = reatomForm({ plan: null as RadioValue }, 'form')
  const radio = reatomRadio({ valueAtom: form.fields.plan, name: 'radio' })
  render(radio, 'free', 'pro')

  expect(form.fields.plan.focus().dirty).toBe(false)

  radio.select('pro')
  expect(form.fields.plan()).toBe('pro')
  // the field observed the write, so its own tracking still works
  expect(form.fields.plan.focus().dirty).toBe(true)
  expect(form()).toEqual({ plan: 'pro' })

  form.reset()
  expect(radio()).toBe(null)
  expect(radio.item('pro').checked()).toBe(false)
})

test('passing both value and valueAtom is a programming error', () => {
  expect(() =>
    reatomRadio({
      value: 'free',
      valueAtom: atom<RadioValue>(null),
      name: 'x',
    }),
  ).toThrow('pass either "value" or "valueAtom"')
})

// --- prop records: the group -------------------------------------------------

test('the group record carries the radiogroup role and the group state', () => {
  const plan = reatomRadio({
    labelledBy: 'plan-legend',
    describedBy: 'plan-hint',
    name: 'plan',
  })
  render(plan, 'free')

  expect(plan.props.group()).toMatchObject({
    role: 'radiogroup',
    id: 'plan',
    'aria-orientation': undefined,
    'aria-disabled': undefined,
    'aria-readonly': undefined,
    'aria-labelledby': 'plan-legend',
    'aria-describedby': 'plan-hint',
    // the roving tabindex: the tab stop belongs to the active radio
    tabIndex: undefined,
    'aria-activedescendant': undefined,
  })
  expect(plan.props.group.name).toBe('plan.props.group')

  plan.composite.orientation.set('horizontal')
  plan.disabled.set(true)
  plan.readOnly.set(true)
  expect(plan.props.group()).toMatchObject({
    'aria-orientation': 'horizontal',
    'aria-disabled': 'true',
    'aria-readonly': 'true',
  })
})

test('the group record inherits the composite base wiring', () => {
  const plan = reatomRadio({ virtualFocus: true, name: 'plan' })
  render(plan, 'free', 'pro')
  const container = element()
  const props = plan.props.group()

  props.ref(container)
  expect(plan.composite.baseElement()).toBe(container)
  expect(plan.props.group()).toMatchObject({
    'aria-activedescendant': 'plan-free',
    tabIndex: 0,
  })

  // navigation from the group element, which is where the keys land while the
  // active radio only has virtual focus
  props.onKeyDown({
    key: 'ArrowDown',
    target: container,
    currentTarget: container,
    preventDefault: () => {},
  } as unknown as KeyboardEvent)
  expect(plan.composite()).toBe('plan-pro')
  expect(plan()).toBe('pro')
})

// --- prop records: one radio ------------------------------------------------

test('a native radio record carries the form attributes and the tab stop', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free, pro] = render(plan, 'free', 'pro')
  const props = plan.props.item(free!)

  expect(props()).toMatchObject({
    id: 'plan-free',
    role: undefined,
    type: 'radio',
    // the native `name` defaults to the group id, so two groups can not merge
    name: 'plan',
    value: 'free',
    checked: false,
    'aria-checked': 'false',
    'aria-disabled': undefined,
    'data-active-item': true,
    tabIndex: undefined,
  })
  expect(props.name).toBe('plan#free.props')
  expect(plan.props.item(pro!)()).toMatchObject({
    'data-active-item': undefined,
    tabIndex: -1,
  })

  // the record is memoized per radio, so an adapter can attach handlers once
  expect(plan.props.item(free!)).toBe(props)
  const identity = props()
  plan.select('free')
  expect(props()).toMatchObject({ checked: true, 'aria-checked': 'true' })
  expect(props()).not.toBe(identity)

  // ... and options opt out of the cache, since they change the record
  const tabbable = plan.props.item(pro!, { tabbable: true })
  expect(tabbable).not.toBe(plan.props.item(pro!))
  expect(tabbable().tabIndex).toBe(undefined)
})

test('a custom radio record carries the role instead of the form attributes', () => {
  const plan = reatomRadio({ native: false, name: 'plan' })
  const [free] = render(plan, 'free')

  expect(plan.props.item(free!)()).toMatchObject({
    role: 'radio',
    type: undefined,
    name: undefined,
    value: undefined,
    'aria-checked': 'false',
  })

  // a per radio override wins over the group-wide default
  expect(
    plan.props.item(free!, { native: true, nativeName: 'plan-form' })(),
  ).toMatchObject({ role: undefined, type: 'radio', name: 'plan-form' })
})

test('a disabled radio reports aria-disabled and stays focusable', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free] = render(plan, 'free')
  free!.render({ disabled: true })

  const props = plan.props.item(free!)()
  expect(props['aria-disabled']).toBe('true')
  // Ariakit's `accessibleWhenDisabled` default: no native `disabled` attribute,
  // so the whole group can still be read with the keyboard
  expect('disabled' in props).toBe(false)
})

test('the radio record registers and unregisters through its ref', () => {
  const plan = reatomRadio({ name: 'plan' })
  const free = plan.item('free')
  const props = plan.props.item(free)()
  const input = element()

  expect(free.node()?.rendered()).toBe(false)

  props.ref(input)
  expect(free.element()).toBe(input)
  expect(free.node()?.rendered()).toBe(true)
  expect(plan.composite()).toBe('plan-free')

  props.ref(null)
  expect(free.element()).toBe(null)
  expect(free.node()?.rendered()).toBe(false)
  expect(plan.composite.navigationItems()).toEqual([])
})

test('a read-only radio refuses the change but stays enabled', () => {
  const plan = reatomRadio({ readOnly: true, name: 'plan' })
  const [, pro] = render(plan, 'free', 'pro')
  const props = plan.props.item(pro!)()

  let prevented = 0
  let stopped = 0
  const changeEvent = () => ({
    preventDefault: () => prevented++,
    stopPropagation: () => stopped++,
  })

  // A refused selection changes no state, so `reatomRadioElementSync` can only
  // hear it as an action call — this effect stands in for it.
  let attempts = 0
  const observer = effect(() => {
    getCalls(plan.select)
    attempts++
  }, 'plan.selectAttempts')
  notify()
  const before = attempts

  // Read-only is not disabled: the event is not cancelled, the DOM is written
  // back by `reatomRadioElementSync` instead — the checkbox precedent.
  props.onChange(changeEvent())
  expect(plan()).toBe(null)
  expect(attempts).toBe(before + 1)
  expect(prevented).toBe(0)
  expect(stopped).toBe(0)
  observer.unsubscribe()
  expect(props['aria-disabled']).toBe(undefined)
  expect(plan.props.group()['aria-readonly']).toBe('true')

  plan.readOnly.set(false)
  props.onChange(changeEvent())
  expect(plan()).toBe('pro')
  expect(prevented).toBe(0)

  // re-selecting the checked radio is not a change (Ariakit issue #3771)
  props.onChange(changeEvent())
  expect(plan()).toBe('pro')
})

test('a disabled radio stops both the change and the click', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [, pro] = render(plan, 'free', 'pro')
  pro!.update({ disabled: true })
  const props = plan.props.item(pro!)()

  let prevented = 0
  let stopped = 0
  const event = () => ({
    preventDefault: () => prevented++,
    stopPropagation: () => stopped++,
  })

  props.onChange(event())
  expect(plan()).toBe(null)
  expect(prevented).toBe(1)
  expect(stopped).toBe(1)

  // Cancelling the click is what restores a native radio's checkedness, so the
  // guard is not skipped for native elements the way an enabled click is.
  props.onClick(event())
  expect(plan()).toBe(null)
  expect(prevented).toBe(2)
  expect(stopped).toBe(2)
})

test('a click only selects a custom radio, a native one waits for change', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free] = render(plan, 'free')

  plan.props.item(free!)().onClick()
  expect(plan()).toBe(null)

  const custom = plan.props.item(free!, { native: false })()
  custom.onClick()
  expect(plan()).toBe('free')

  // a handled click is left alone
  plan.set(null)
  custom.onClick({ defaultPrevented: true })
  expect(plan()).toBe(null)
})

test('keys navigate, and Space selects a custom radio', () => {
  const plan = reatomRadio({ native: false, name: 'plan' })
  const [free, pro] = render(plan, 'free', 'pro')
  const target = element()
  const props = plan.props.item(free!)()
  props.ref(target)

  let prevented = 0
  const keyDown = (key: string) => {
    const event = {
      key,
      target,
      currentTarget: target,
      defaultPrevented: false,
      preventDefault() {
        prevented++
        // the composite record prevents the default of a handled navigation, and
        // the radio record must not act on it afterwards
        ;(this as { defaultPrevented: boolean }).defaultPrevented = true
      },
    }
    props.onKeyDown(event as unknown as KeyboardEvent)
    return event
  }

  // arrow keys are delegated to the composite item record...
  keyDown('ArrowRight')
  expect(plan.composite()).toBe('plan-pro')
  // ... and with `selectOnMove` the move selects
  expect(plan()).toBe('pro')
  expect(prevented).toBe(1)

  // `Space` selects the focused radio without navigating anywhere
  plan.set(null)
  plan.composite.set('plan-free')
  keyDown(' ')
  expect(plan()).toBe('free')
  expect(prevented).toBe(2)

  keyDown('Enter')
  expect(prevented).toBe(3)

  // a native radio leaves both keys to the browser
  const nativeProps = plan.props.item(pro!, { native: true })()
  nativeProps.ref(target)
  nativeProps.onKeyDown({
    key: ' ',
    target,
    currentTarget: target,
    preventDefault: () => prevented++,
  } as unknown as KeyboardEvent)
  expect(plan()).toBe('free')
  expect(prevented).toBe(3)
})

test('a guarded custom radio ignores the keyboard without cancelling it', () => {
  const plan = reatomRadio({ native: false, disabled: true, name: 'plan' })
  const [free] = render(plan, 'free')
  const target = element()
  const props = plan.props.item(free!)()
  props.ref(target)

  let prevented = 0
  const keyDown = () =>
    props.onKeyDown({
      key: ' ',
      target,
      currentTarget: target,
      preventDefault: () => prevented++,
    } as unknown as KeyboardEvent)

  keyDown()
  expect(plan()).toBe(null)
  expect(prevented).toBe(0)

  plan.disabled.set(false)
  plan.readOnly.set(true)
  keyDown()
  expect(plan()).toBe(null)
  expect(prevented).toBe(0)

  plan.readOnly.set(false)
  keyDown()
  expect(plan()).toBe('free')
  expect(prevented).toBe(1)
})

test('focus activates a radio without selecting it', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free, pro] = render(plan, 'free', 'pro')
  const target = element()
  const props = plan.props.item(pro!)()
  props.ref(target)

  // entering the group with Tab must not answer the question
  props.onFocus(focusEvent(target, target))
  expect(plan.composite()).toBe('plan-pro')
  expect(plan()).toBe(null)
  expect(free!.active()).toBe(false)
})

test('tabbing back into the group lands on the checked radio', () => {
  // react-components 0.3.0: "Fixed `RadioGroup` so tabbing back into a group
  // focuses the checked `Radio` after another unchecked `Radio` has received
  // focus." Arrow keys with `selectOnMove` off leave the tab stop on a radio the
  // user never picked; the APG says Tab must re-enter at the checked one.
  const plan = reatomRadio({ value: 'free', selectOnMove: false, name: 'plan' })
  render(plan, 'free', 'pro', 'team')

  expect(plan.composite()).toBe('plan-free')

  plan.composite.navigate({ move: 'next' })
  expect(plan.composite()).toBe('plan-pro')
  expect(plan()).toBe('free')

  const inside = element()
  const outside = element()
  // `isFocusEventOutside` asks the group element whether it contains the next
  // focus target, which is the only DOM fact this handler reads.
  const group = {
    contains: (node: unknown) => node === inside,
  } as unknown as HTMLElement
  const props = plan.props.group()

  const blur = (relatedTarget: HTMLElement) =>
    props.onBlur({ currentTarget: group, relatedTarget } as unknown as FocusEvent)

  // focus moving between the radios of the group changes nothing
  blur(inside)
  expect(plan.composite()).toBe('plan-pro')

  blur(outside)
  expect(plan.composite()).toBe('plan-free')
  // putting the tab stop back is not a navigation, so nothing was selected
  expect(plan()).toBe('free')
})

test('the tab stop stays put when there is no rendered checked radio', () => {
  const plan = reatomRadio({ selectOnMove: false, name: 'plan' })
  render(plan, 'free', 'pro')

  plan.composite.navigate({ move: 'next' })
  expect(plan.composite()).toBe('plan-pro')

  // nothing checked
  expect(plan.activateChecked()).toBe(undefined)
  expect(plan.composite()).toBe('plan-pro')

  // checked, but the radio never mounted, so it has nothing to focus
  plan.set('team')
  plan.item('team')
  expect(plan.activateChecked()).toBe(undefined)
  expect(plan.composite()).toBe('plan-pro')
})

test('a disabled group disables every radio in it', () => {
  // react-components 0.3.4: "The `RadioGroup` `disabled` prop now marks the group
  // as disabled and disables descendant `Radio` components, including radios
  // rendered as custom elements."
  const plan = reatomRadio({ disabled: true, name: 'plan' })
  const [free, pro] = render(plan, 'free', 'pro')

  expect(plan.props.group()['aria-disabled']).toBe('true')
  for (const item of [free!, pro!]) {
    expect(item.disabled()).toBe(true)
    expect(item.editable()).toBe(false)
    expect(plan.props.item(item)()['aria-disabled']).toBe('true')
  }

  plan.disabled.set(false)
  expect(plan.props.group()['aria-disabled']).toBe(undefined)
  expect(free!.disabled()).toBe(false)
  // …and a radio disabled on its own is unaffected by the group flag
  pro!.update({ disabled: true })
  expect(pro!.disabled()).toBe(true)
})

test('units are named after the model, radios included', () => {
  const plan = reatomRadio({ name: 'settings.plan' })
  const free = plan.item('free')

  expect(plan.name).toBe('settings.plan')
  expect(plan.composite.name).toBe('settings.plan.composite')
  expect(plan.composite.items.name).toBe('settings.plan.composite.items')
  expect(plan.select.name).toBe('settings.plan.select')
  expect(plan.checkedId.name).toBe('settings.plan.checkedId')
  expect(free.name).toBe('settings.plan#free')
  expect(free.select.name).toBe('settings.plan#free.select')
  expect(free.id).toBe('settings-plan-free')
  expect(plan.composite.id()).toBe('settings-plan')
})

test('radioItemProps can be built without the model-owned records', () => {
  const plan = reatomRadio({ name: 'plan' })
  const [free] = render(plan, 'free')
  const props = radioItemProps(plan, free!, { name: 'custom' })

  expect(props.name).toBe('custom')
  expect(props()).toMatchObject({ id: 'plan-free', type: 'radio' })
})
