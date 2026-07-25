import { atom, context, isAbort, notify } from '@reatom/core'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { reatomFocusVisible } from '../focusable/reatomFocusVisible'
import { reatomPointerMoving } from '../hovercard/reatomPointerMoving'
import { TOOLTIP_ARROW_SIZE, tooltipProps, withTooltipProps } from './props'
import {
  reatomTooltip,
  TOOLTIP_PLACEMENT,
  TOOLTIP_SKIP_TIMEOUT,
  withTooltip,
} from './reatomTooltip'
import type { TooltipRegistryModel } from './reatomTooltipRegistry'
import { reatomTooltipRegistry, tooltipRegistry } from './reatomTooltipRegistry'
import type { TooltipShowContext } from './tooltipIntent'
import { mapTooltipShowIntent } from './tooltipIntent'

beforeEach(() => context.reset())
afterEach(() => vi.useRealTimers())

/**
 * A stand-in for a DOM node. The model only stores element handles and the prop
 * records only read `isConnected`, so a plain object is enough.
 */
const element = (id = ''): HTMLElement =>
  ({ id, isConnected: false, style: {} }) as unknown as HTMLElement

/** A stand-in anchor that can answer containment, as a real node does. */
const containing = (...children: ReadonlyArray<unknown>): HTMLElement =>
  ({
    ...element('anchor'),
    contains: (node: unknown) => children.includes(node),
  }) as unknown as HTMLElement

/** Swallows the rejection an aborted flow produces, and reports it happened. */
const aborted = async (promise: Promise<void>): Promise<boolean> => {
  try {
    await promise
    return false
  } catch (error) {
    if (!isAbort(error)) throw error
    return true
  }
}

/** A tooltip with its own registry, pointer flag and modality. */
const mount = (
  options: {
    name?: string
    timeout?: number
    skipTimeout?: number
    registry?: TooltipRegistryModel
  } = {},
) => {
  const { name = 'tip', ...rest } = options
  const registry = options.registry ?? reatomTooltipRegistry({ name: 'reg' })
  const tooltip = reatomTooltip({
    ...rest,
    registry,
    moving: reatomPointerMoving({ name: `${name}.moving` }),
    modality: reatomFocusVisible({ name: `${name}.modality` }),
    name,
  })

  return { registry, tooltip, anchor: element('anchor') }
}

// --- the pure show intent ---------------------------------------------------

/** A real pointer move over an anchor that may open its tooltip. */
const hovering: TooltipShowContext = {
  defaultPrevented: false,
  showPending: false,
  moving: true,
  showOnHover: true,
  canShowOnHover: true,
  skipDelay: false,
}

test('mapTooltipShowIntent adds the two tooltip questions to the hovercard ones', () => {
  expect(mapTooltipShowIntent(hovering)).toBe('show')

  // "Show the tooltip immediately if there's an active tooltip instead of
  // waiting for the showTimeout delay."
  expect(mapTooltipShowIntent({ ...hovering, skipDelay: true })).toBe('showNow')

  // "We don't want to show the tooltip again while the anchor is still
  // hovered", after an Escape or a blur.
  expect(mapTooltipShowIntent({ ...hovering, canShowOnHover: false })).toBe(
    'ignore',
  )

  // the hovercard facts still decide first
  expect(mapTooltipShowIntent({ ...hovering, defaultPrevented: true })).toBe(
    'ignore',
  )
  expect(mapTooltipShowIntent({ ...hovering, showPending: true })).toBe(
    'ignore',
  )
  expect(mapTooltipShowIntent({ ...hovering, moving: false })).toBe('ignore')
  expect(mapTooltipShowIntent({ ...hovering, showOnHover: false })).toBe(
    'ignore',
  )
})

test('a tooltip that may not open on hover is ignored, not skipped', () => {
  expect(
    mapTooltipShowIntent({
      ...hovering,
      canShowOnHover: false,
      skipDelay: true,
    }),
  ).toBe('ignore')
})

// --- the registry -----------------------------------------------------------

test('the registry keeps one active tooltip and closes the previous one', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const first = reatomTooltip({ registry, name: 'first' })
  const second = reatomTooltip({ registry, name: 'second' })

  expect(registry()).toBe(null)
  expect(first.active()).toBe(false)

  first.show()
  notify()
  expect(registry()).toBe(first)
  expect(first.active()).toBe(true)

  // "If the current tooltip is open, we should immediately hide the active one
  // and set the current one as the active tooltip."
  second.show()
  notify()
  expect(registry()).toBe(second)
  expect(second.active()).toBe(true)
  expect(first()).toBe(false)
  expect(first.active()).toBe(false)
})

test('the registry is read-only: writes go through its actions', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })

  // a model is a function, and `atom.set` reads a function as an updater — so a
  // writable registry would be a trap rather than an API
  expect((registry as { set?: unknown }).set).toBe(undefined)
})

test('a closed tooltip stays active for the skip window', async () => {
  vi.useFakeTimers()
  const { registry, tooltip } = mount({ skipTimeout: 300 })

  tooltip.show()
  tooltip.hide()
  notify()
  // "Otherwise, if the current tooltip is closed, we should set a timeout to
  // hide the active tooltip in the global store."
  expect(registry()).toBe(tooltip)

  await vi.advanceTimersByTimeAsync(299)
  expect(registry()).toBe(tooltip)

  await vi.advanceTimersByTimeAsync(1)
  expect(registry()).toBe(null)
})

test('a zero skip timeout releases the tooltip without waiting', () => {
  const { registry, tooltip } = mount({ skipTimeout: 0 })

  tooltip.show()
  tooltip.hide()
  notify()

  expect(registry()).toBe(null)
})

test('a newcomer during the skip window supersedes the pending release', async () => {
  vi.useFakeTimers()
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const first = reatomTooltip({ registry, skipTimeout: 300, name: 'first' })
  const second = reatomTooltip({ registry, skipTimeout: 300, name: 'second' })

  first.show()
  first.hide()
  notify()
  await vi.advanceTimersByTimeAsync(100)

  second.show()
  notify()
  expect(registry()).toBe(second)

  // the release of `first` must not clear `second`
  await vi.advanceTimersByTimeAsync(300)
  expect(registry()).toBe(second)
})

test('a tooltip reopening inside its own skip window is not released', async () => {
  vi.useFakeTimers()
  const { registry, tooltip } = mount({ skipTimeout: 300 })

  tooltip.show()
  tooltip.hide()
  notify()
  await vi.advanceTimersByTimeAsync(100)

  // Ariakit clears the pending timeout from its `sync` cleanup; here `activate`
  // aborts the release.
  tooltip.show()
  notify()

  await vi.advanceTimersByTimeAsync(300)
  expect(registry()).toBe(tooltip)
  expect(tooltip()).toBe(true)
})

test('release is abortable, and being aborted is a normal outcome', async () => {
  vi.useFakeTimers()
  const { registry, tooltip } = mount({ skipTimeout: 300 })

  tooltip.show()
  notify()
  const released = registry.release(tooltip, 300)
  registry.release.abort('newcomer')

  expect(await aborted(released)).toBe(true)
  await vi.advanceTimersByTimeAsync(300)
  expect(registry()).toBe(tooltip)
})

test('clear drops a tooltip immediately, and only that tooltip', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const first = reatomTooltip({ registry, name: 'first' })
  const second = reatomTooltip({ registry, name: 'second' })

  first.show()
  notify()

  registry.clear(second)
  expect(registry()).toBe(first)

  registry.clear(first)
  expect(registry()).toBe(null)
})

test('activating the active tooltip again changes nothing', () => {
  const { registry, tooltip } = mount()

  tooltip.show()
  notify()
  registry.activate(tooltip)

  expect(registry()).toBe(tooltip)
  expect(tooltip()).toBe(true)
})

test('every tooltip shares one registry by default', () => {
  const first = reatomTooltip({ name: 'first' })
  const second = reatomTooltip({ name: 'second' })

  expect(first.registry).toBe(tooltipRegistry)
  expect(second.registry).toBe(tooltipRegistry)

  first.show()
  second.show()
  notify()
  expect(first()).toBe(false)
  expect(tooltipRegistry()).toBe(second)
})

test('every unit of the registry is named after it', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })

  expect(registry.name).toBe('reg')
  expect(registry.activate.name).toBe('reg.activate')
  expect(registry.release.name).toBe('reg.release')
  expect(registry.clear.name).toBe('reg.clear')
})

test('anonymous registries get unique names', () => {
  expect(reatomTooltipRegistry().name).not.toBe(reatomTooltipRegistry().name)
})

// --- the model --------------------------------------------------------------

test('defaults match the Ariakit tooltip store and components', () => {
  const tooltip = reatomTooltip({ name: 'tip' })

  // tooltip-store.ts: `placement: 'top'`, `hideTimeout: 0`, `skipTimeout: 300`
  expect(tooltip.placement()).toBe(TOOLTIP_PLACEMENT)
  expect(tooltip.placement()).toBe('top')
  expect(tooltip.hideTimeout()).toBe(0)
  expect(tooltip.hideDelay()).toBe(0)
  expect(tooltip.skipTimeout()).toBe(TOOLTIP_SKIP_TIMEOUT)
  expect(tooltip.skipTimeout()).toBe(300)

  // the hovercard half is untouched
  expect(tooltip.timeout()).toBe(500)
  expect(tooltip.showDelay()).toBe(500)
  expect(tooltip.showOnHover()).toBe(true)
  expect(tooltip.modal()).toBe(false)
  expect(tooltip.autoFocusOnShow()).toBe(false)

  // tooltip-specific state
  expect(tooltip.canShowOnHover()).toBe(false)
  expect(tooltip.anchorFocusVisible()).toBe(false)
  expect(tooltip.hideOnPointerLeave()).toBe(true)
  expect(tooltip.hideOnHoverOutside()).toBe(true)
  expect(tooltip.active()).toBe(false)
  expect(tooltip.skipDelay()).toBe(false)
})

test('every unit is named after the model', () => {
  const tooltip = reatomTooltip({ name: 'tip' })

  expect(tooltip.skipTimeout.name).toBe('tip.skipTimeout')
  expect(tooltip.canShowOnHover.name).toBe('tip.canShowOnHover')
  expect(tooltip.anchorFocusVisible.name).toBe('tip.anchorFocusVisible')
  expect(tooltip.hideOnPointerLeave.name).toBe('tip.hideOnPointerLeave')
  expect(tooltip.active.name).toBe('tip.active')
  expect(tooltip.skipDelay.name).toBe('tip.skipDelay')
  // inherited from the hovercard it is built on
  expect(tooltip.showDelayed.name).toBe('tip.showDelayed')
  expect(tooltip.currentPlacement.name).toBe('tip.currentPlacement')
})

test('the hide delay is zero by default and still overridable', () => {
  // tooltip-store.ts: `hideTimeout: defaultValue(props.hideTimeout, ..., 0)`
  expect(reatomTooltip({ timeout: 800, name: 'a' }).hideDelay()).toBe(0)
  expect(
    reatomTooltip({ timeout: 800, hideTimeout: 200, name: 'b' }).hideDelay(),
  ).toBe(200)
  // a `null` hide timeout falls back to the shared one, like a hovercard
  const tooltip = reatomTooltip({ timeout: 800, name: 'c' })
  tooltip.hideTimeout.set(null)
  expect(tooltip.hideDelay()).toBe(800)
})

test('a tooltip skips its show delay while another one is active', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const first = reatomTooltip({ registry, name: 'first' })
  const second = reatomTooltip({ registry, name: 'second' })

  expect(second.skipDelay()).toBe(false)

  first.show()
  notify()
  expect(second.skipDelay()).toBe(true)
  // the active tooltip does not skip its own delay
  expect(first.skipDelay()).toBe(false)

  first.hide()
  notify()
  registry.clear(first)
  expect(second.skipDelay()).toBe(false)
})

test('canShowOnHover is armed by the pointer and reset when the tooltip closes', () => {
  const { tooltip } = mount()

  // "we keep this flag that's set to true on mouse enter"
  tooltip.props.anchor().onMouseEnter()
  expect(tooltip.canShowOnHover()).toBe(true)

  tooltip.show()
  notify()
  expect(tooltip.canShowOnHover()).toBe(true)

  // `sync(store, ['mounted'], state => { if (!state.mounted) canShow = false })`
  tooltip.hide()
  notify()
  expect(tooltip.canShowOnHover()).toBe(false)
})

test('a focus-visible anchor keeps the tooltip open when the pointer leaves', () => {
  const { tooltip } = mount()

  expect(tooltip.hideOnHoverOutside()).toBe(true)

  // "If the anchor element has the `data-focus-visible` attribute, we don't
  // hide the tooltip when the mouse leaves the anchor element."
  tooltip.anchorFocusVisible.set(true)
  expect(tooltip.hideOnHoverOutside()).toBe(false)
  // …and with it the pointer-event suppression that only protects an approach
  expect(tooltip.disablePointerEventsOnApproach()).toBe(false)

  tooltip.anchorFocusVisible.set(false)
  expect(tooltip.hideOnHoverOutside()).toBe(true)

  // the caller's own preference still wins
  tooltip.hideOnPointerLeave.set(false)
  expect(tooltip.hideOnHoverOutside()).toBe(false)
  tooltip.hideOnPointerLeave.set(true)
  expect(tooltip.hideOnHoverOutside()).toBe(true)
})

test('the hideOnHoverOutside option seeds the pointer-leave preference', () => {
  const tooltip = reatomTooltip({ hideOnHoverOutside: false, name: 'tip' })

  expect(tooltip.hideOnPointerLeave()).toBe(false)
  expect(tooltip.hideOnHoverOutside()).toBe(false)
})

test('withTooltip adopts a caller-owned atom', () => {
  const open = atom(false, 'save.tip')
  const tooltip = open.extend(withTooltip({ skipTimeout: 100 }))

  expect(tooltip).toBe(open)
  expect(tooltip.skipTimeout()).toBe(100)
  expect(tooltip.placement()).toBe('top')
  expect(tooltip.hideDelay()).toBe(0)
  expect(tooltip.canShowOnHover.name).toBe('save.tip.canShowOnHover')

  // a controlled tooltip joins the registry through the atom, not through show()
  open.set(true)
  notify()
  expect(tooltip.mounted()).toBe(true)
  expect(tooltip.active()).toBe(true)
})

test('anonymous tooltips get unique names', () => {
  expect(reatomTooltip().name).not.toBe(reatomTooltip().name)
})

// --- prop records -----------------------------------------------------------

test('the records carry the APG tooltip contract', () => {
  const tooltip = reatomTooltip({ name: 'tip' })

  // https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
  expect(tooltip.props.anchor()['aria-describedby']).toBe('tip-content')
  expect(tooltip.props.content()).toMatchObject({
    id: 'tip-content',
    role: 'tooltip',
    tabIndex: -1,
    hidden: true,
  })

  tooltip.show()
  expect(tooltip.props.content()).toMatchObject({
    hidden: false,
    'data-open': true,
  })
})

test('hovering the anchor opens the tooltip after the show delay', async () => {
  vi.useFakeTimers()
  const { tooltip, anchor } = mount({ timeout: 500 })

  tooltip.props.anchor().onMouseEnter()
  tooltip.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })

  expect(tooltip.showPending()).toBe(true)
  expect(tooltip.anchorElement()).toBe(anchor)
  // the anchor is also the disclosure, which is what keeps an interaction with
  // it from dismissing the tooltip through `isDialogInteractionOutside`
  expect(tooltip.disclosureElement()).toBe(anchor)

  await vi.advanceTimersByTimeAsync(500)
  expect(tooltip()).toBe(true)
})

test('a pointer that never entered the anchor cannot open the tooltip', () => {
  const { tooltip, anchor } = mount({ timeout: 0 })

  // no `onMouseEnter`: `canShowOnHoverRef.current` is still false
  tooltip.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(tooltip()).toBe(false)
  expect(tooltip.showPending()).toBe(false)

  tooltip.props.anchor().onMouseEnter()
  tooltip.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })
  expect(tooltip()).toBe(true)
})

test('a tooltip closed by Escape does not reopen under the resting pointer', () => {
  const { tooltip, anchor } = mount({ timeout: 0 })
  const hover = () =>
    tooltip.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })

  tooltip.props.anchor().onMouseEnter()
  hover()
  expect(tooltip()).toBe(true)

  // a dismissal always comes from a handler that flushes, so the disarm the
  // change hook performs has landed by the time the next `mousemove` arrives
  tooltip.dismiss('escape')
  notify()
  expect(tooltip.canShowOnHover()).toBe(false)

  hover()
  expect(tooltip()).toBe(false)

  // leaving and entering the anchor again arms it
  tooltip.props.anchor().onMouseEnter()
  hover()
  expect(tooltip()).toBe(true)
})

test('a tooltip shows without any delay while another one is active', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const moving = reatomPointerMoving({ name: 'moving' })
  const first = reatomTooltip({ registry, moving, name: 'first' })
  const second = reatomTooltip({
    registry,
    moving,
    timeout: 500,
    name: 'second',
  })
  const anchor = element('second.anchor')

  first.show()
  notify()

  second.props.anchor().onMouseEnter()
  second.props.anchor().onMouseMove({ currentTarget: anchor, movementX: 4 })

  expect(second()).toBe(true)
  // nothing is pending: the delay was skipped, not merely shortened
  expect(second.showPending()).toBe(false)
  expect(second.anchorElement()).toBe(anchor)
  expect(first()).toBe(false)
})

test('the anchor opens the tooltip when it becomes focus-visible', () => {
  const { registry, tooltip, anchor } = mount({ timeout: 500 })

  tooltip.props.anchor().onFocus({ currentTarget: anchor })

  expect(tooltip.anchorFocusVisible()).toBe(true)
  // `onFocusVisible` calls `store.show()` — a keyboard user waits for nothing
  expect(tooltip()).toBe(true)
  expect(tooltip.showPending()).toBe(false)
  expect(tooltip.anchorElement()).toBe(anchor)
  expect(tooltip.disclosureElement()).toBe(anchor)
  expect(registry()).toBe(tooltip)
})

test('a pointer-focused anchor does not open the tooltip', () => {
  const modality = reatomFocusVisible({ name: 'modality' })
  const tooltip = reatomTooltip({ modality, name: 'tip' })
  const anchor = element('anchor')

  modality.pointerDown({})
  tooltip.props.anchor().onFocus({ currentTarget: anchor })

  expect(tooltip.anchorFocusVisible()).toBe(false)
  expect(tooltip()).toBe(false)
})

test('a prevented focus is left to whoever prevented it', () => {
  const { tooltip, anchor } = mount()

  tooltip.props
    .anchor()
    .onFocus({ currentTarget: anchor, defaultPrevented: true })

  expect(tooltip.anchorFocusVisible()).toBe(false)
  expect(tooltip()).toBe(false)
})

test('focus bubbling up from a child of the anchor is not the anchor focus', () => {
  const { tooltip, anchor } = mount()

  tooltip.props.anchor().onFocus({ currentTarget: anchor, selfTarget: false })

  expect(tooltip.anchorFocusVisible()).toBe(false)
  expect(tooltip()).toBe(false)
})

test('a focus event that carries both targets needs no flags of its own', () => {
  const { tooltip, anchor } = mount()
  const child = element('child')

  // `isSelfTarget(event)`, from the event rather than from the consumer
  tooltip.props.anchor().onFocus({ target: child, currentTarget: anchor })
  expect(tooltip()).toBe(false)

  tooltip.props.anchor().onFocus({ target: anchor, currentTarget: anchor })
  expect(tooltip.anchorFocusVisible()).toBe(true)
  expect(tooltip()).toBe(true)
})

test('a blur is a blur only when focus really leaves the anchor', () => {
  const { tooltip } = mount()
  const child = element('child')
  const anchor = containing(child)
  const focus = () => tooltip.props.anchor().onFocus({ currentTarget: anchor })

  focus()
  // `isFocusEventOutside(event)`: the anchor answers containment itself
  tooltip.props.anchor().onBlur({ currentTarget: anchor, relatedTarget: child })
  expect(tooltip.anchorFocusVisible()).toBe(true)
  expect(tooltip()).toBe(true)

  tooltip.props.anchor().onBlur({
    currentTarget: anchor,
    relatedTarget: element('elsewhere'),
  })
  expect(tooltip()).toBe(false)

  // a blur with nowhere to go — the window lost focus — is still a blur
  focus()
  tooltip.props.anchor().onBlur({ currentTarget: anchor })
  expect(tooltip()).toBe(false)
})

test('blurring the anchor closes the tooltip and releases the registry', () => {
  const { registry, tooltip, anchor } = mount()

  tooltip.props.anchor().onFocus({ currentTarget: anchor })
  tooltip.props.anchor().onMouseEnter()
  expect(tooltip()).toBe(true)

  tooltip.props.anchor().onBlur()

  expect(tooltip.anchorFocusVisible()).toBe(false)
  // APG: "the tooltip remains visible until Escape is pressed or focus moves
  // away from the trigger"
  expect(tooltip()).toBe(false)
  // "we don't want to show subsequent tooltips without a delay"
  expect(registry()).toBe(null)
  expect(tooltip.canShowOnHover()).toBe(false)
})

test('focus moving to a child of the anchor is not a blur', () => {
  const { tooltip, anchor } = mount()

  tooltip.props.anchor().onFocus({ currentTarget: anchor })
  tooltip.props.anchor().onBlur({ focusOutside: false })

  expect(tooltip.anchorFocusVisible()).toBe(true)
  expect(tooltip()).toBe(true)
})

test('an always-focus-visible anchor shows its tooltip on a pointer focus too', () => {
  const modality = reatomFocusVisible({ name: 'modality' })
  const tooltip = reatomTooltip({ modality, name: 'tip' })

  modality.pointerDown({})
  // a text field has to show focus however it arrived, because the caret does
  tooltip.props.anchor().onFocus({ target: { tagName: 'input', type: 'text' } })

  expect(tooltip.anchorFocusVisible()).toBe(true)
  expect(tooltip()).toBe(true)
})

test('the hovercard records come along', () => {
  const tooltip = reatomTooltip({ name: 'tip' })
  const wrapper = element('wrapper')

  expect(tooltip.props.wrapper().style.position).toBe('absolute')
  expect(tooltip.props.arrow()['aria-hidden']).toBe(true)
  // tooltip-arrow.tsx: `size = 16`, half of the popover's default
  expect(tooltip.props.arrow().style.fontSize).toBe(TOOLTIP_ARROW_SIZE)
  expect(tooltip.props.arrow().style.fontSize).toBe(16)
  expect(tooltip.props.dismiss()).toMatchObject({ type: 'button' })

  tooltip.props.wrapper().ref(wrapper)
  expect(tooltip.popoverElement()).toBe(wrapper)

  // leaving the anchor still cancels a pending show
  tooltip.props.anchor().onMouseEnter()
  tooltip.props.anchor().onMouseMove({ movementX: 4 })
  expect(tooltip.showPending()).toBe(true)
  tooltip.props.anchor().onMouseLeave()
  expect(tooltip.showPending()).toBe(false)
})

test('the prop-record options reach the inherited records', () => {
  const tooltip = reatomTooltip({ name: 'tip' })
  const props = tooltipProps(tooltip, {
    alwaysVisible: true,
    fixed: true,
    arrowSize: 12,
  })

  expect(props.content().hidden).toBe(false)
  expect(props.content().role).toBe('tooltip')
  expect(props.wrapper().style.position).toBe('fixed')
  expect(props.arrow().style.fontSize).toBe(12)
})

test('withTooltipProps names the records after the model', () => {
  const tooltip = atom(false, 'save.tip')
    .extend(withTooltip())
    .extend(withTooltipProps())

  expect(tooltip.props.anchor.name).toBe('save.tip.props.anchor')
  expect(tooltip.props.content.name).toBe('save.tip.props.content')
  expect(tooltip.props.anchor()['aria-describedby']).toBe('save-tip-content')
})
