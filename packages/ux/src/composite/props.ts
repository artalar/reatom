/**
 * Layer 2 for `composite`: the reactive prop records that implement both focus
 * strategies — roving tabindex and `aria-activedescendant`.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/composite/composite.tsx` and
 * `packages/ariakit-react-components/src/composite/composite-item.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import { isTextFieldElement } from '../interactions/describeElement'
import type { EventTargetsLike } from '../interactions/element'
import { isSelfTarget } from '../interactions/element'
import { isCompositeGrid } from './getNextId'
import { mapEntryIntent, mapNavigationIntent } from './navigationIntent'
import type { CompositeItemNode, CompositeModel } from './reatomComposite'
import type { TypeaheadKeyEvent } from './typeahead'
import { isTypeaheadKey } from './typeahead'

/** Props to spread on the composite element itself. */
export interface CompositeBaseProps {
  /** The widget id, so items and labels can reference it. */
  id: string
  /**
   * The virtually focused item, for the
   * [`aria-activedescendant`](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_focus_activedescendant)
   * strategy. `undefined` while `virtualFocus` is off, where the active item
   * holds real DOM focus instead.
   */
  'aria-activedescendant': string | undefined
  /**
   * `0` while the composite element holds focus itself — with `virtualFocus`,
   * or when the active id is `null`. Otherwise `undefined`, i.e. no attribute:
   * the single tab stop belongs to the active item (roving tabindex), and a
   * natively focusable base element such as a combobox input keeps its own tab
   * behavior.
   */
  tabIndex: number | undefined
  /** Assigns the model's `baseElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /**
   * Arrow keys that enter the widget while no item has DOM focus — and all
   * navigation keys while `virtualFocus` is on, since then the container is the
   * only element that can receive them.
   */
  onKeyDown: (event: KeyboardEvent) => void
  /**
   * The typeahead: printable characters move the active item to the next one
   * whose text starts with them. A no-op until
   * {@link CompositeOptions.typeahead} — or `model.typeahead.enabled` — turns it
   * on.
   *
   * The **capture** phase is Ariakit's own choice, with its reason: "the event
   * might be handled by a child component. For example, the space key may
   * trigger a click event on a child component. We need to prevent this
   * behavior if the character is a valid typeahead key." A view binds it as
   * React's `onKeyDownCapture`, or as `addEventListener('keydown', handler,
   * true)`.
   */
  onKeyDownCapture: (event: KeyboardEvent) => void
  /** Focusing the container itself activates the container, not an item. */
  onFocus: (event: FocusEvent) => void
}

/** Props to spread on a composite item element. */
export interface CompositeItemProps {
  /** The item id, which `aria-activedescendant` points at. */
  id: string
  /** Ariakit's styling hook for the active item, in both focus strategies. */
  'data-active-item': true | undefined
  /**
   * `-1` keeps a non-active item out of the tab order — the roving tabindex.
   * `undefined` means "no attribute", so a native `<button>` stays tabbable and
   * a custom element gets its tab stop from `focusableProps`.
   */
  tabIndex: number | undefined
  /** Assigns the item's `element`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /** Focus follows the active item, and focusing an item activates it. */
  onFocus: (event: FocusEvent) => void
  /** Arrow, Home / End, and PageUp / PageDown navigation. */
  onKeyDown: (event: KeyboardEvent) => void
}

/** Options of {@link compositeItemProps}. */
export interface CompositeItemPropsOptions {
  /**
   * Forces the item into the tab order, whatever the roving tabindex says —
   * Ariakit's `tabbable` prop on `CompositeItem`.
   *
   * @default false
   */
  tabbable?: boolean
  /**
   * How many items PageUp / PageDown skip. Ariakit measures the scrolling
   * element for this (`findNextPageItemId`); leave it out to make paging jump
   * to the first / last item instead.
   */
  pageSize?: number
  /** Prefix of the prop record name. Defaults to the item name. */
  name?: string
}

/** Options of {@link compositeProps} and {@link withCompositeProps}. */
export interface CompositePropsOptions {
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Reactive prop records of a composite model. */
export interface CompositePropRecords {
  /** Props for the composite element. */
  base: Computed<CompositeBaseProps>
  /**
   * Props for one item element. The record is memoized per item, so repeated
   * calls keep the same identity; passing options returns a fresh, uncached
   * record.
   */
  item: (
    item: CompositeItemNode,
    options?: CompositeItemPropsOptions,
  ) => Computed<CompositeItemProps>
}

/** Whether the model's base element is a text field, e.g. a combobox input. */
const baseIsTextField = (model: CompositeModel): boolean => {
  const element = model.baseElement()
  return element ? isTextFieldElement(element) : false
}

/**
 * The event {@link applyTypeaheadIntent} reads: a key press that knows where it
 * happened.
 *
 * Both targets are `unknown` so a real DOM event — whose `currentTarget` is
 * `EventTarget | null` — stays assignable; the guards narrow them at runtime.
 */
export interface CompositeTypeaheadEvent extends TypeaheadKeyEvent {
  readonly defaultPrevented?: boolean
  readonly target?: unknown
  readonly currentTarget?: unknown
  preventDefault?: () => void
}

/**
 * Runs the typeahead for one key press: the DOM half of Ariakit's
 * `useCompositeTypeahead`.
 *
 * @remarks
 *   The two guards it adds to {@link TypeaheadUnits.press} are the ones that need
 *   an element: a text field target — where a printable key is text — and an
 *   event that neither the composite element nor one of its items fired. Both
 *   abandon the buffer, as Ariakit's `clearChars` does.
 *
 *   `preventDefault` is called for every key the typeahead consumed, matching
 *   Ariakit, even when nothing matched: otherwise `Space` typed inside a word
 *   would activate the focused item.
 *
 *   It is exported because `select` and `menu` build their own prop records on
 *   top of the composite instead of spreading its base one, and all three must
 *   apply the same policy.
 * @example
 *   // inside a widget's own `onKeyDownCapture`
 *   applyTypeaheadIntent(model.composite, event)
 *
 * @returns The id the typeahead moved to, `undefined` when nothing moved.
 */
export const applyTypeaheadIntent = (
  model: CompositeModel,
  event: CompositeTypeaheadEvent,
): string | undefined => {
  const { typeahead } = model
  if (event.defaultPrevented) return undefined
  if (!typeahead.enabled()) return undefined

  const target = event.target
  const element = target as Element | null | undefined
  const isTextFieldTarget =
    !!element && typeof element === 'object' && isTextFieldElement(element)
  // Ariakit's `isSelfTargetOrItem`: nested fields and controls keep their keys.
  const isSelfTargetOrItem =
    isSelfTarget(event as unknown as EventTargetsLike) ||
    (!!target &&
      model.items
        .renderedItems()
        .some((item) => !item.disabled() && item.element() === target))

  if (
    isTextFieldTarget ||
    !isTypeaheadKey(event, typeahead()) ||
    !isSelfTargetOrItem
  ) {
    typeahead.clear()
    return undefined
  }

  const { handled, id } = typeahead.press(event)
  if (handled) event.preventDefault?.()
  return id
}

/**
 * Reactive prop record for a composite item element.
 *
 * @remarks
 *   The handlers are `wrap`ped so the state change is attributed to the DOM event
 *   in the logger, and they `notify()` so a host framework sees the update in
 *   the same tick — the `bindField` precedent. They keep a stable identity
 *   across recomputations, so an adapter can attach them once.
 *
 *   Two Ariakit behaviors around the same handlers stay out: the `virtualFocus`
 *   focus/blur relay (`focusSilently` plus synthetic blur events, needed by
 *   combobox in Wave 4) and the textbox caret guard that only navigates when
 *   the caret sits at the edge of the value.
 * @example
 *   const item = composite.items.renderItem({ id: 'bold' })
 *   const props = compositeItemProps(composite, item)
 *   props() // { id: 'bold', tabIndex: undefined, 'data-active-item': true, ... }
 */
export const compositeItemProps = (
  model: CompositeModel,
  item: CompositeItemNode,
  options: CompositeItemPropsOptions = {},
): Computed<CompositeItemProps> => {
  const { tabbable = false, pageSize, name = `${item.name}.props` } = options

  const ref = wrap((element: HTMLElement | null) => {
    item.element.set(element)
  })

  const onFocus = wrap((event: FocusEvent) => {
    if (event.defaultPrevented) return
    // Composite items can nest (tree, treegrid), and then the focus event of a
    // child bubbles through its parent item — which must not steal it.
    if (!isSelfTarget(event)) return
    model.set(item.id)
    notify()
  })

  const onKeyDown = wrap((event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    if (!isSelfTarget(event)) return

    const intent = mapNavigationIntent(event, {
      orientation: model.orientation(),
      grid: item.rowId() !== undefined,
      baseIsTextField: baseIsTextField(model),
      pageSize,
    })
    if (!intent) return

    // `undefined` means the navigation found nowhere to go, so the key keeps its
    // default behavior — scrolling the page, or moving a nested caret.
    if (model.navigate(intent) !== undefined) event.preventDefault()
    notify()
  })

  return computed(
    (): CompositeItemProps => ({
      id: item.id,
      'data-active-item': item.active() || undefined,
      tabIndex: tabbable || item.tabbable() ? undefined : -1,
      ref,
      onFocus,
      onKeyDown,
    }),
    name,
  )
}

/**
 * Builds the reactive prop records of a composite model.
 *
 * Each record is a `computed` returning a plain object, so it is memoized,
 * lazy, traceable by name, and neutral about the view library: React spreads
 * it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it.
 *
 * @example
 *   const props = compositeProps(toolbar)
 *   props.base() // { id: 'toolbar', tabIndex: undefined, ... }
 *   props.item(toolbar.items.item('bold')!)()
 */
export const compositeProps = (
  model: CompositeModel,
  options: CompositePropsOptions = {},
): CompositePropRecords => {
  const { name = model.name } = options

  const ref = wrap((element: HTMLElement | null) => {
    model.baseElement.set(element)
  })

  const onFocus = wrap((event: FocusEvent) => {
    if (event.defaultPrevented) return
    // With `virtualFocus` the container keeps DOM focus and hands virtual focus
    // to an item, which needs the Layer 2 focus relay combobox will bring in
    // Wave 4. Until then the container simply stays focused.
    if (model.virtualFocus()) return
    if (!isSelfTarget(event)) return
    // Ariakit: focusing the container of a roving-tabindex composite on purpose
    // (a click that misses every item, or a `Tab` into it) makes the container
    // itself the active element.
    model.set(null)
    notify()
  })

  const onKeyDown = wrap((event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    if (!isSelfTarget(event)) return

    const virtual = model.virtualFocus()
    const active = model.activeItem()

    // With roving tabindex a mounted active item has DOM focus and handles its
    // own keys, so this handler is only the "enter the widget" path — right
    // after mount, or when the active item left the DOM.
    if (!virtual && active?.element()?.isConnected) return

    const shape = {
      orientation: model.orientation(),
      baseIsTextField: baseIsTextField(model),
    }

    // With virtual focus the container is the only focused element, so it has to
    // map the keys the active item would. Ariakit instead re-fires the keyboard
    // event on the active item element (`useKeyboardEventProxy`), which exists
    // so that handlers on the item component still run — a view concern.
    const intent =
      virtual && active
        ? mapNavigationIntent(event, {
            ...shape,
            grid: active.rowId() !== undefined,
          })
        : mapEntryIntent(event, {
            ...shape,
            grid: isCompositeGrid(model.navigationItems()),
          })
    if (!intent) return

    if (model.navigate(intent) !== undefined) event.preventDefault()
    notify()
  })

  const onKeyDownCapture = wrap((event: KeyboardEvent) => {
    applyTypeaheadIntent(model, event)
    notify()
  })

  const records = new WeakMap<CompositeItemNode, Computed<CompositeItemProps>>()

  return {
    base: computed(
      (): CompositeBaseProps => ({
        id: model.id(),
        'aria-activedescendant': model.activeDescendant(),
        tabIndex: model.virtualFocus() || model() === null ? 0 : undefined,
        ref,
        onKeyDown,
        onKeyDownCapture,
        onFocus,
      }),
      `${name}.props.base`,
    ),

    item: (item, itemOptions) => {
      if (itemOptions) return compositeItemProps(model, item, itemOptions)

      let record = records.get(item)
      if (!record) {
        records.set(item, (record = compositeItemProps(model, item)))
      }
      return record
    },
  }
}

/**
 * Attaches {@link compositeProps} to a composite model as `model.props`.
 *
 * {@link reatomComposite} applies it already; use it explicitly when composing a
 * composite model by hand.
 */
export const withCompositeProps = (
  options: CompositePropsOptions = {},
): AssignerExt<{ props: CompositePropRecords }, CompositeModel> => {
  return (target) => ({ props: compositeProps(target, options) })
}
