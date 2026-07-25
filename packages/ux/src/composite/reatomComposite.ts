/**
 * Layer 1 model for `composite`: the keystone of every navigable widget —
 * radio, toolbar, tag, menubar, combobox, select, menu, and tab all build on
 * it.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/composite/composite-store.ts`, plus the
 * store-derivable half of
 * `packages/ariakit-react-components/src/composite/composite-item.tsx` (the
 * roving-tabindex derivation).
 */

import type { Action, Atom, Computed } from '@reatom/core'
import { action, atom, computed, named, withComputed } from '@reatom/core'

import type {
  CollectionItemInit,
  CollectionItemModel,
  CollectionItemNode,
  CollectionModel,
} from '../collection/reatomCollection'
import { reatomCollection } from '../collection/reatomCollection'
import type {
  CompositeFocusPolicy,
  CompositeNavigationItem,
  CompositeNavigationState,
  CompositeOrientation,
} from './getNextId'
import {
  getFirstEnabledId,
  getFirstEnabledIdInLastRow,
  getLastEnabledId,
  getNextId,
} from './getNextId'
import type { CompositeNavigationIntent } from './navigationIntent'
import type { CompositePropRecords } from './props'
import { withCompositeProps } from './props'
import type { TypeaheadItem, TypeaheadModel } from './typeahead'
import { reatomTypeahead } from './typeahead'

/**
 * Turns a model name into a DOM-safe `id`.
 *
 * Reatom names are hierarchical (`select#3.composite`), which makes a poor HTML
 * id, so every non-word character collapses into a dash. Ariakit generates
 * `id-${random}` instead, which differs between the server and the client; a
 * name-derived id keeps SSR markup stable.
 */
export const compositeElementId = (name: string): string =>
  name.replace(/[^\w-]+/g, '-')

/** Registration payload of a composite item. */
export interface CompositeItemInit extends CollectionItemInit {
  /**
   * Keeps arrow keys from landing on the item. Note that a disabled item stays
   * _registered_: it still occupies its place in a grid row, which is what
   * makes `focusShift` and the column padding work.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * The row the item belongs to. Present on two-dimensional composites only —
   * one `rowId` on any rendered item is what turns the widget into a grid.
   */
  rowId?: string
  /**
   * The item's text content, for typeahead. Ariakit calls this field `children`
   * because its collection stores it from `element.textContent`.
   */
  text?: string
  /**
   * The text the typeahead matches instead of {@link CompositeItemInit.text} —
   * Ariakit's `typeaheadText` item option, for an item whose visible label is
   * not what the user would type (an icon plus a name, a localized alias).
   *
   * An empty string opts the item out of matching altogether.
   */
  typeaheadText?: string
}

/** The atomized per item state a composite adds to every collection item. */
export interface CompositeItemState {
  /** Whether arrow keys skip the item. */
  disabled: Atom<boolean>
  /** The row the item belongs to, `undefined` on one-dimensional composites. */
  rowId: Atom<string | undefined>
  /** The item's text content, for typeahead. */
  text: Atom<string | undefined>
  /**
   * The text the typeahead matches instead of {@link CompositeItemState.text},
   * empty string to opt the item out.
   */
  typeaheadText: Atom<string | undefined>
  /**
   * Whether the item is the active one — the source of Ariakit's
   * `data-active-item`. It is DOM focus with roving tabindex, and virtual focus
   * with `aria-activedescendant`.
   */
  active: Computed<boolean>
  /**
   * Whether the item takes part in the tab order.
   *
   * The roving tabindex invariant: exactly one item is tabbable, so a `Tab`
   * press enters the widget at the active item and the next one leaves it.
   * Three cases deliberately make _every_ item tabbable, because otherwise the
   * widget could not be reached with the keyboard at all: an empty collection,
   * and an `activeId` pointing at an item that is disabled or has no element
   * yet (Ariakit issues #3232 and #4129). With `virtualFocus` no item is
   * tabbable — DOM focus stays on the base element.
   */
  tabbable: Computed<boolean>
}

/** A composite item as it is stored in the collection. */
export type CompositeItemNode = CollectionItemNode<CompositeItemState>

/** The item collection of a composite model. */
export type CompositeItemsModel = CollectionModel<
  CompositeItemInit,
  CompositeItemState
>

/** Options of {@link reatomComposite}. */
export interface CompositeOptions {
  /**
   * The initially active item id.
   *
   * - A string activates that item.
   * - `null` activates the composite element itself, so arrow keys can navigate
   *   out of the items; it also flips the default of
   *   {@link CompositeOptions.includesBaseElement} to `true`.
   * - `undefined` (the default) auto-seeds the first enabled rendered item, see
   *   {@link CompositeModel}.
   */
  activeId?: string | null
  /** Items to register upfront, in order. */
  items?: Array<CompositeItemInit>
  /**
   * The DOM `id` of the composite element. Defaults to a DOM-safe derivation of
   * the model name, see {@link compositeElementId}.
   */
  id?: string
  /**
   * Which arrow keys navigate a one-dimensional composite; ignored on a grid,
   * where all four always navigate.
   *
   * @default 'both'
   */
  orientation?: CompositeOrientation
  /**
   * Inverts `next` / `previous`, for `dir="rtl"` widgets. This only affects
   * navigation — the direction of the layout itself is CSS.
   *
   * @default false
   */
  rtl?: boolean
  /**
   * Keeps DOM focus on the composite element and marks the active item with
   * `aria-activedescendant` instead of moving focus to it.
   *
   * @default false
   */
  virtualFocus?: boolean
  /**
   * Loops from the last item back to the first one, optionally on one axis
   * only.
   *
   * @default false
   */
  focusLoop?: CompositeFocusPolicy
  /**
   * On a grid, moves from the end of a row or column into the next one,
   * optionally on one axis only.
   *
   * @default false
   */
  focusWrap?: CompositeFocusPolicy
  /**
   * On a grid, shifts to the previous item of the column when the next one is
   * missing or disabled, instead of stopping.
   *
   * @default false
   */
  focusShift?: boolean
  /**
   * Whether the composite element itself is part of the arrow-key focus order.
   *
   * @default `activeId === null`
   */
  includesBaseElement?: boolean
  /**
   * Whether printable characters move the active item to the next item whose
   * text starts with them — Ariakit's `CompositeTypeahead`.
   *
   * It is opt-in, exactly like rendering that component: Ariakit gives a
   * typeahead to `select` and `menu` only, and neither a radio group nor a tab
   * list nor a toolbar wants one. {@link reatomSelect} and {@link reatomMenu}
   * turn it on themselves.
   *
   * The state it needs is always there ({@link CompositeUnits.typeahead}); this
   * only seeds `typeahead.enabled`, which stays writable.
   *
   * @default false
   */
  typeahead?: boolean
  /** The model name; every nested unit is named after it. */
  name?: string
}

/** Overrides accepted by the navigation queries, as Ariakit's `NextOptions`. */
export type CompositeNavigationOverrides = CompositeNavigationState

/** Units attached to the `activeId` atom by {@link reatomComposite}. */
export interface CompositeUnits {
  /**
   * The item collection — a {@link reatomCollection} with `disabled`, `rowId`,
   * `text`, `active`, and `tabbable` per item.
   *
   * It is a sub-model instead of a merged surface, because Ariakit's flat store
   * shape hides two different `move`s: moving an item inside the list
   * (`items.move`) and moving the active item (`composite.move`).
   */
  items: CompositeItemsModel
  /**
   * The rendered items as the plain snapshot the pure navigation helpers take —
   * Ariakit's `renderedItems`. Registered but unrendered items are not
   * navigable.
   */
  navigationItems: Computed<Array<CompositeNavigationItem>>
  /**
   * The snapshot the typeahead matches against: the same items plus the two
   * text fields.
   *
   * It is the _rendered_ items, unless more items are registered than rendered
   * — Ariakit's comment: "We typically want to use the rendered items, as
   * they're already sorted. However, the composite list might be unmounted or
   * virtualized, in which case we'll use the original items." That is what lets
   * a closed select's typeahead reach options whose elements were never
   * mounted.
   */
  typeaheadItems: Computed<Array<TypeaheadItem>>
  /**
   * The typeahead: the buffer of characters typed so far, and the key press
   * transition that moves the active item. Off by default, see
   * {@link CompositeOptions.typeahead}.
   */
  typeahead: TypeaheadModel
  /** The active item node, `null` when the active id is `null` or unknown. */
  activeItem: Computed<CompositeItemNode | null>
  /**
   * The `aria-activedescendant` value: the active item id while `virtualFocus`
   * is on, `undefined` otherwise.
   */
  activeDescendant: Computed<string | undefined>
  /** The DOM `id` of the composite element. */
  id: Atom<string>
  /**
   * The composite element itself — usually the wrapper that contains the items,
   * but a combobox's input element too.
   */
  baseElement: Atom<HTMLElement | null>
  /** Which arrow keys navigate a one-dimensional composite. */
  orientation: Atom<CompositeOrientation>
  /** Whether `next` / `previous` are inverted. */
  rtl: Atom<boolean>
  /** Whether the active item receives virtual focus instead of DOM focus. */
  virtualFocus: Atom<boolean>
  /** Whether navigation loops around the ends. */
  focusLoop: Atom<CompositeFocusPolicy>
  /** Whether grid navigation wraps between rows and columns. */
  focusWrap: Atom<CompositeFocusPolicy>
  /** Whether grid navigation shifts to the previous item of a column. */
  focusShift: Atom<boolean>
  /** Whether the composite element is part of the arrow-key focus order. */
  includesBaseElement: Atom<boolean>
  /**
   * Activates an item _as a focus move_.
   *
   * @remarks
   *   Ariakit needs a `moves` counter next to `activeId` so that consumers can
   *   tell a keyboard move from a programmatic `setActiveId`, and it has to
   *   diff that counter to detect an event. Here the action itself is the
   *   event: observe it with `getCalls(composite.move)` inside an `effect`,
   *   with `withCallHook(composite.move)`, or with `await
   *   wrap(take(composite.move))`. Writing the model atom directly
   *   (`composite.set(id)`) stays the silent "set the active item without
   *   moving focus" of Ariakit's `setActiveId`.
   *
   *   Calling it with `undefined` does nothing — that is the return value of a
   *   navigation query that found nowhere to go, and Ariakit swallows it the
   *   same way.
   * @example
   *   effect(() => {
   *     const moves = getCalls(composite.move)
   *     if (moves.length) focusActiveItem()
   *   }, 'focusOnMove')
   */
  move: Action<[id?: string | null], void>
  /**
   * Resolves a navigation intent and moves to the result, returning the id it
   * moved to. `undefined` means nothing happened, so a key handler must not
   * call `preventDefault`.
   */
  navigate: Action<
    [
      intent: CompositeNavigationIntent,
      overrides?: CompositeNavigationOverrides,
    ],
    string | null | undefined
  >
  /**
   * Resolves a navigation intent to an id without moving. `null` is the
   * composite element itself, `undefined` is "nowhere to go".
   */
  nextId: (
    intent: CompositeNavigationIntent,
    overrides?: CompositeNavigationOverrides,
  ) => string | null | undefined
  /** The id of the next item, as `nextId({ move: 'next' })`. */
  next: (overrides?: CompositeNavigationOverrides) => string | null | undefined
  /** The id of the previous item. */
  previous: (
    overrides?: CompositeNavigationOverrides,
  ) => string | null | undefined
  /** The id of the item above, on the same column of a grid. */
  up: (overrides?: CompositeNavigationOverrides) => string | null | undefined
  /** The id of the item below, on the same column of a grid. */
  down: (overrides?: CompositeNavigationOverrides) => string | null | undefined
  /** The id of the first enabled item. */
  first: (overrides?: CompositeNavigationOverrides) => string | undefined
  /** The id of the last enabled item. */
  last: (overrides?: CompositeNavigationOverrides) => string | undefined
}

/**
 * A composite model: the `activeId` atom extended with the item collection, the
 * navigation flags, and the navigation queries.
 *
 * Reading the model reads `activeId`, and writing it is Ariakit's `setActiveId`
 * — "activate without moving focus". Three values are meaningful:
 *
 * - A string is the active item;
 * - `null` is the composite element itself;
 * - `undefined` means "not decided yet" and auto-seeds the first enabled rendered
 *   item as soon as one is rendered.
 */
export interface CompositeModel
  extends Atom<string | null | undefined>, CompositeUnits {}

/**
 * The model returned by {@link reatomComposite}: a {@link CompositeModel} plus
 * the prop records.
 */
export interface Composite extends CompositeModel {
  /** Reactive prop records for the composite element and its items. */
  props: CompositePropRecords
}

/**
 * Creates a composite model: an ordered collection of items plus the active
 * item, the arrow-key navigation policy, and the a11y derivations both roving
 * tabindex and `aria-activedescendant` need.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createCompositeStore`. Four Ariakit
 *   mechanics change shape:
 *
 *   - The `moves` counter is gone; `move` is an observable action, see
 *       {@link CompositeUnits.move}.
 *   - The `setup` + `sync` listener that seeds `activeId` becomes `withComputed`,
 *       so the seed is lazy and needs no store lifetime.
 *   - The `setActiveId` / `setBaseElement` identity setters are gone: write the
 *       atoms.
 *   - `getNextId` and its helpers are pure exported functions
 *       ([`getNextId.ts`](./getNextId.ts)), so the grid / loop / wrap / shift
 *       matrix is testable over plain arrays.
 *   - `CompositeTypeahead`'s module-level `WeakMap` of character buffers is a
 *       sub-model ([`typeahead.ts`](./typeahead.ts)), so two composites cannot
 *       share a buffer and its reset delay is a flow rather than a timer
 *       handle. Enable it with {@link CompositeOptions.typeahead}.
 *
 *   The auto-seeding has one deliberate asymmetry: writing `undefined` back does
 *   not re-seed immediately, because a `withComputed` derivation only re-runs
 *   when its dependencies change — the next render of an item seeds it again.
 *   Navigation is unaffected: with no active id every direction enters at the
 *   first enabled item.
 * @example
 *   const toolbar = reatomComposite({ focusLoop: true, name: 'toolbar' })
 *
 *   toolbar.items.renderItem({ id: 'bold' })
 *   toolbar.items.renderItem({ id: 'italic', disabled: true })
 *   toolbar.items.renderItem({ id: 'underline' })
 *
 *   toolbar() // 'bold' — auto-seeded
 *   toolbar.next() // 'underline' — the disabled item is skipped
 *   toolbar.move(toolbar.next())
 *   toolbar() // 'underline'
 *   toolbar.next() // 'bold' — focusLoop
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={toolbar.props.base}>
 *   <button $spread={toolbar.props.item(item)}>Bold</button>
 *   </div>
 *
 * @see https://ariakit.com/components/composite
 */
export const reatomComposite = (options: CompositeOptions = {}): Composite => {
  const {
    activeId: initActiveId,
    items: initItems,
    id: initId,
    orientation: initOrientation = 'both',
    rtl: initRtl = false,
    virtualFocus: initVirtualFocus = false,
    focusLoop: initFocusLoop = false,
    focusWrap: initFocusWrap = false,
    focusShift: initFocusShift = false,
    // Ariakit ties the default to `activeId === null`: starting at the composite
    // element only makes sense if it is part of the focus order.
    includesBaseElement: initIncludesBaseElement = initActiveId === null,
    typeahead: initTypeahead = false,
    name = named('composite'),
  } = options

  const activeId = atom<string | null | undefined>(initActiveId, name)

  const id = atom(initId ?? compositeElementId(name), `${name}.id`)
  const baseElement = atom<HTMLElement | null>(null, `${name}.baseElement`)
  const orientation = atom(initOrientation, `${name}.orientation`)
  const rtl = atom(initRtl, `${name}.rtl`)
  const virtualFocus = atom(initVirtualFocus, `${name}.virtualFocus`)
  const focusLoop = atom<CompositeFocusPolicy>(
    initFocusLoop,
    `${name}.focusLoop`,
  )
  const focusWrap = atom<CompositeFocusPolicy>(
    initFocusWrap,
    `${name}.focusWrap`,
  )
  const focusShift = atom(initFocusShift, `${name}.focusShift`)
  const includesBaseElement = atom(
    initIncludesBaseElement,
    `${name}.includesBaseElement`,
  )

  const items: CompositeItemsModel = reatomCollection<
    CompositeItemInit,
    CompositeItemState
  >({
    create: (init: CompositeItemInit, item: CollectionItemModel) => ({
      disabled: atom(init.disabled ?? false, `${item.name}.disabled`),
      rowId: atom(init.rowId, `${item.name}.rowId`),
      text: atom(init.text, `${item.name}.text`),
      typeaheadText: atom(init.typeaheadText, `${item.name}.typeaheadText`),
      active: computed(() => activeId() === item.id, `${item.name}.active`),
      tabbable: computed(() => isTabbable(item.id), `${item.name}.tabbable`),
    }),
    update: (init, item) => {
      if (init.disabled !== undefined) item.disabled.set(init.disabled)
      if (init.rowId !== undefined) item.rowId.set(init.rowId)
      if (init.text !== undefined) item.text.set(init.text)
      if (init.typeaheadText !== undefined) {
        item.typeaheadText.set(init.typeaheadText)
      }
    },
    items: initItems,
    name: `${name}.items`,
  })

  /**
   * The roving-tabindex derivation, ported from the `isTabbable` selector of
   * Ariakit's `useCompositeItem`.
   */
  const isTabbable = (itemId: string): boolean => {
    if (!items.renderedItems().length) return true
    if (virtualFocus()) return false
    const active = activeId()
    if (active === null) return false
    const item = items.item(active)
    // An unknown, disabled, or unmounted active item can not hold the single
    // tab stop, so every item keeps one until the active id is valid again.
    if (!item || item.disabled() || !item.element()) return true
    return active === itemId
  }

  const navigationItems = computed(
    (): Array<CompositeNavigationItem> =>
      items.renderedItems().map((item) => ({
        id: item.id,
        disabled: item.disabled(),
        rowId: item.rowId(),
      })),
    `${name}.navigationItems`,
  )

  const seedActiveId = (state: string | null | undefined) => {
    // Read unconditionally: a conditional read would drop the dependency and
    // the seed would never arrive once an item renders.
    const first = getFirstEnabledId(navigationItems())
    return state === undefined ? first : state
  }

  // Ariakit seeds `activeId` from a `setup` + `sync` listener that writes the
  // state back (`composite-store.ts:194-201`). A write-back derivation that must
  // stay writable is exactly `withComputed`.
  //
  // The cast works around `AtomState`, which drops `undefined` from a state
  // union because it infers through the optional `AtomLike.__state` property.
  activeId.extend(
    withComputed(seedActiveId as (state: string | null) => string | null),
  )

  const activeItem = computed(
    () => items.item(activeId() ?? null),
    `${name}.activeItem`,
  )

  const activeDescendant = computed(
    () => (virtualFocus() ? (activeItem()?.id ?? undefined) : undefined),
    `${name}.activeDescendant`,
  )

  const navigationState = (
    overrides: CompositeNavigationOverrides = {},
  ): CompositeNavigationState => ({
    // Every fallback treats an explicit `undefined` as absent, which is what
    // Ariakit's destructuring defaults do.
    items: overrides.items ?? navigationItems(),
    activeId:
      overrides.activeId !== undefined ? overrides.activeId : activeId(),
    focusLoop: overrides.focusLoop ?? focusLoop(),
    focusWrap: overrides.focusWrap ?? focusWrap(),
    focusShift: overrides.focusShift ?? focusShift(),
    includesBaseElement: overrides.includesBaseElement ?? includesBaseElement(),
    rtl: overrides.rtl ?? rtl(),
    skip: overrides.skip,
  })

  const nextId = (
    intent: CompositeNavigationIntent,
    overrides: CompositeNavigationOverrides = {},
  ): string | null | undefined => {
    const state = navigationState(overrides)
    const list = state.items!

    switch (intent.move) {
      case 'first':
        return getFirstEnabledId(list)
      case 'last':
        return getLastEnabledId(list)
      case 'firstInLastRow':
        return getFirstEnabledIdInLastRow(list)
      default:
        return getNextId(intent.move, {
          ...state,
          skip: state.skip ?? intent.skip,
        })
    }
  }

  const move = action((id?: string | null): void => {
    // `move()` does nothing: it is the "nowhere to go" result of a navigation
    // query, not a request to clear the active item.
    if (id === undefined) return
    activeId.set(id)
  }, `${name}.move`)

  const navigate = action(
    (
      intent: CompositeNavigationIntent,
      overrides?: CompositeNavigationOverrides,
    ): string | null | undefined => {
      const id = nextId(intent, overrides)
      move(id)
      return id
    },
    `${name}.navigate`,
  )

  const typeaheadItems = computed((): Array<TypeaheadItem> => {
    const registered = items.array()
    const rendered = items.renderedItems()
    const list = registered.length > rendered.length ? registered : rendered

    return list.map((item) => ({
      id: item.id,
      disabled: item.disabled(),
      rowId: item.rowId(),
      text: item.text(),
      typeaheadText: item.typeaheadText(),
    }))
  }, `${name}.typeaheadItems`)

  // A `move` and not an `activeId.set`: a typeahead jump is a focus move, so
  // `withCompositeFocus` follows it and the select's "selection follows focus"
  // middleware sees it — which is what makes typing on a closed select change
  // its value.
  const typeahead = reatomTypeahead({
    items: typeaheadItems,
    activeId,
    move,
    enabled: initTypeahead,
    name: `${name}.typeahead`,
  })

  return activeId
    .extend(() => ({
      items,
      navigationItems,
      typeaheadItems,
      typeahead,
      activeItem,
      activeDescendant,
      id,
      baseElement,
      orientation,
      rtl,
      virtualFocus,
      focusLoop,
      focusWrap,
      focusShift,
      includesBaseElement,
      move,
      navigate,
      nextId,
      next: (overrides?: CompositeNavigationOverrides) =>
        nextId({ move: 'next' }, overrides),
      previous: (overrides?: CompositeNavigationOverrides) =>
        nextId({ move: 'previous' }, overrides),
      up: (overrides?: CompositeNavigationOverrides) =>
        nextId({ move: 'up' }, overrides),
      down: (overrides?: CompositeNavigationOverrides) =>
        nextId({ move: 'down' }, overrides),
      first: (overrides?: CompositeNavigationOverrides) =>
        getFirstEnabledId(overrides?.items ?? navigationItems()),
      last: (overrides?: CompositeNavigationOverrides) =>
        getLastEnabledId(overrides?.items ?? navigationItems()),
    }))
    .extend(withCompositeProps()) as Composite
}
