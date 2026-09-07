import type { Action, Atom, Computed } from '@reatom/core'
import { atom } from '@reatom/core'
import { expectTypeOf, test } from 'vitest'

import { reatomFocusVisible } from '../focusable/reatomFocusVisible'
import { reatomPointerMoving } from '../hovercard/reatomPointerMoving'
import type { TooltipAnchorProps, TooltipContentProps } from './props'
import { tooltipProps, withTooltipProps } from './props'
import type { Tooltip, TooltipModel } from './reatomTooltip'
import { reatomTooltip, withTooltip } from './reatomTooltip'
import type {
  TooltipRegistryEntry,
  TooltipRegistryModel,
} from './reatomTooltipRegistry'
import { reatomTooltipRegistry, tooltipRegistry } from './reatomTooltipRegistry'
import type { TooltipShowIntent } from './tooltipIntent'
import { mapTooltipShowIntent } from './tooltipIntent'

test('the model is a boolean atom, and a hovercard', () => {
  const tooltip = reatomTooltip()

  expectTypeOf(tooltip).toExtend<Atom<boolean>>()
  expectTypeOf(tooltip()).toEqualTypeOf<boolean>()
  // inherited through the hovercard, the popover and the dialog
  expectTypeOf(tooltip.showDelay()).toEqualTypeOf<number>()
  expectTypeOf(tooltip.currentPlacement()).toExtend<string>()
  expectTypeOf(tooltip.mounted).toExtend<Computed<boolean>>()
  expectTypeOf(tooltip.showDelayed()).toEqualTypeOf<Promise<void>>()
})

test('the tooltip state is as narrow as the policy it feeds', () => {
  const tooltip = reatomTooltip()

  expectTypeOf(tooltip.skipTimeout()).toEqualTypeOf<number>()
  expectTypeOf(tooltip.canShowOnHover()).toEqualTypeOf<boolean>()
  expectTypeOf(tooltip.anchorFocusVisible()).toEqualTypeOf<boolean>()
  expectTypeOf(tooltip.hideOnPointerLeave()).toEqualTypeOf<boolean>()

  // written by the prop records, and by a consumer wiring its own focusable
  tooltip.canShowOnHover.set(true)
  tooltip.anchorFocusVisible.set(true)
  tooltip.hideOnPointerLeave.set(false)

  // …while the registry-derived state is read-only
  expectTypeOf(tooltip.active).not.toHaveProperty('set')
  expectTypeOf(tooltip.skipDelay).not.toHaveProperty('set')
  expectTypeOf(tooltip.active()).toEqualTypeOf<boolean>()
  expectTypeOf(tooltip.skipDelay()).toEqualTypeOf<boolean>()
})

test('the registry is read-only state with three transitions', () => {
  const registry = reatomTooltipRegistry({ name: 'reg' })
  const tooltip = reatomTooltip({ registry })

  expectTypeOf(registry).toExtend<TooltipRegistryModel>()
  expectTypeOf(registry).toExtend<Computed<TooltipRegistryEntry | null>>()
  expectTypeOf(registry()).toEqualTypeOf<TooltipRegistryEntry | null>()
  // a model is a function, so a writable registry would read a tooltip as an
  // updater — the transitions are the only way in
  expectTypeOf(registry).not.toHaveProperty('set')

  expectTypeOf(registry.activate(tooltip)).toEqualTypeOf<void>()
  expectTypeOf(registry.clear(tooltip)).toEqualTypeOf<void>()
  expectTypeOf(registry.release(tooltip, 300)).toEqualTypeOf<Promise<void>>()
  registry.release.abort('newcomer')

  expectTypeOf(tooltip.registry).toExtend<TooltipRegistryModel>()
  expectTypeOf(tooltipRegistry).toExtend<TooltipRegistryModel>()

  // @ts-expect-error a release needs the tooltip it releases
  registry.release(300)
  // @ts-expect-error and a plain atom is not a tooltip
  registry.activate(atom(false, 'flag'))
})

test('options are checked', () => {
  reatomTooltip({
    open: true,
    skipTimeout: 0,
    registry: reatomTooltipRegistry({ name: 'own' }),
    modality: reatomFocusVisible({ name: 'own.modality' }),
    // the hovercard options come along
    timeout: 200,
    showTimeout: 0,
    hideTimeout: 100,
    showOnHover: false,
    hideOnHoverOutside: false,
    moving: reatomPointerMoving({ name: 'own.moving' }),
    // …the popover ones through them
    placement: 'right-start',
    fixed: true,
    arrowSize: 12,
    // …and the dialog ones through those
    animated: 150,
    alwaysVisible: true,
    name: 'save.tip',
  })

  // @ts-expect-error a skip window is a number of milliseconds
  reatomTooltip({ skipTimeout: '300ms' })
  // @ts-expect-error the placement union is closed
  reatomTooltip({ placement: 'above' })
  // @ts-expect-error the deprecated Ariakit `type` option is not ported
  reatomTooltip({ type: 'label' })
})

test('prop records are computed plain objects', () => {
  const tooltip = reatomTooltip()

  expectTypeOf(tooltip.props.anchor).toExtend<Computed<TooltipAnchorProps>>()
  expectTypeOf(tooltip.props.content).toExtend<Computed<TooltipContentProps>>()
  expectTypeOf(tooltip.props.content().role).toEqualTypeOf<'tooltip'>()
  expectTypeOf(
    tooltip.props.anchor()['aria-describedby'],
  ).toEqualTypeOf<string>()
  // the hovercard and popover records are inherited unchanged
  expectTypeOf(tooltip.props.wrapper().style.position).toEqualTypeOf<
    'absolute' | 'fixed'
  >()
  expectTypeOf(
    tooltip.props.disclosure()['aria-haspopup'],
  ).toEqualTypeOf<'dialog'>()

  // every handler works with a real DOM event, a synthetic one, or nothing
  tooltip.props.anchor().onMouseEnter()
  tooltip.props.anchor().onMouseMove({} as MouseEvent)
  tooltip.props.anchor().onMouseMove({ currentTarget: null, movementX: 4 })
  tooltip.props.anchor().onMouseLeave()
  tooltip.props.anchor().onClick()
  tooltip.props.anchor().onFocus()
  tooltip.props.anchor().onFocus({} as FocusEvent)
  tooltip.props.anchor().onFocus({ target: { tagName: 'input', type: 'text' } })
  tooltip.props.anchor().onBlur({ focusOutside: false })
  tooltip.props.anchor().ref(null)
  // and the dialog contract is still there
  tooltip.props.content().onKeyDown({ key: 'Escape' })
})

test('the extensions compose into the full model', () => {
  const adopted = atom(false, 'save.tip')
    .extend(withTooltip())
    .extend(withTooltipProps({ fixed: true }))

  expectTypeOf(adopted).toExtend<Tooltip>()
  expectTypeOf(adopted).toExtend<TooltipModel>()
  expectTypeOf(adopted.skipTimeout()).toEqualTypeOf<number>()
  expectTypeOf(tooltipProps(adopted).anchor).toExtend<
    Computed<TooltipAnchorProps>
  >()

  // a tooltip satisfies what the registry asks of one, structurally
  expectTypeOf(adopted).toExtend<TooltipRegistryEntry>()
  expectTypeOf(adopted.hide).toExtend<Action<[], false>>()

  // @ts-expect-error a tooltip is a boolean
  atom('', 'text').extend(withTooltip())
  // @ts-expect-error the records need the model, not a bare atom
  atom(false, 'flag').extend(withTooltipProps())
})

test('the intent mapper returns a closed union', () => {
  const intent = mapTooltipShowIntent({
    defaultPrevented: false,
    showPending: false,
    moving: true,
    showOnHover: true,
    canShowOnHover: true,
    skipDelay: true,
  })

  expectTypeOf(intent).toEqualTypeOf<TooltipShowIntent>()
  if (intent === 'showNow') expectTypeOf(intent).toEqualTypeOf<'showNow'>()

  // @ts-expect-error every fact is required, so a new one cannot be forgotten
  mapTooltipShowIntent({ moving: true, canShowOnHover: true })
})
