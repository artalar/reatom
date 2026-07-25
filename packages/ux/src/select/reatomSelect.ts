/**
 * Layer 1 for `select`: the model — a composite of the items plus the popover
 * that holds them, around the one value the widget exists to hold.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/select/select-store.ts`, plus the
 * transitions Ariakit keeps in
 * `packages/ariakit-react-components/src/select/*.tsx`.
 */

import type { Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  createAtom,
  ifChanged,
  named,
  peek,
  ReatomError,
  withComputed,
  withMiddleware,
} from '@reatom/core'

import type { Combobox } from '../combobox/reatomCombobox'
import type { CompositeNavigationItem } from '../composite/getNextId'
import type { CompositeNavigationIntent } from '../composite/navigationIntent'
import type {
  Composite,
  CompositeItemInit,
  CompositeItemNode,
  CompositeNavigationOverrides,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { Popover, PopoverOptions } from '../popover/reatomPopover'
import { reatomPopover } from '../popover/reatomPopover'
import type { SelectPropRecords, SelectPropsOptions } from './props'
import { withSelectProps } from './props'
import type { SelectValue } from './selectValue'
import {
  isSelectItemSelected,
  isSelectMultiSelectable,
  lastSelectValue,
  nextSelectValue,
  toSelectValues,
} from './selectValue'

/** Registration payload of one select item. */
export interface SelectItemInit extends CompositeItemInit {
  /**
   * The value the item contributes to the selection. An item without one is
   * still navigable inside an open list, but it is never selected, never seeds
   * the default value, and is skipped while the list is closed — Ariakit's
   * `item.value != null` checks.
   */
  value?: string
}

/** Options {@link reatomSelect} adds to the composite and popover ones. */
export interface SelectExtOptions<T extends SelectValue = SelectValue> {
  /**
   * The initial value. Leave it out — the default — to let the first enabled
   * item that has a value become the value, which is Ariakit's "if not set, the
   * first non-disabled item will be used".
   *
   * @remarks
   *   `undefined` is the "not chosen yet" state Ariakit expresses with a `new
   *   String('')` sentinel, so `''` stays a value a caller can ask for and get.
   *   The `SelectUnsetValue` alias in [`selectValue.ts`](./selectValue.ts)
   *   documents the trade-off.
   * @example
   *   reatomSelect()() // undefined, then the first item's value
   *   reatomSelect({ value: '' })() // '' — an explicit empty selection
   *   reatomSelect({ value: [] })() // [] — a multi-select, never seeded
   */
  value?: T
  /**
   * Adopt a caller-owned atom for the value: a `reatomForm` field, a route
   * search param, or another widget's atom. This is what "controlled" means in
   * Reatom.
   *
   * @remarks
   *   The adopted atom stays the single source of truth — the model reads and
   *   writes it through a pass-through proxy, because the model has to `extend`
   *   its own primary atom and must not add its members to yours.
   *
   *   The default-value seeding is attached to the adopted atom, since that is
   *   where the state lives: an adopted atom holding `undefined` is seeded from
   *   the items exactly like a model-owned one.
   * @example
   *   const form = reatomForm({ fruit: '' }, 'form')
   *   const fruit = reatomSelect({ valueAtom: form.fields.fruit })
   */
  valueAtom?: Atom<T | undefined>
  /**
   * Whether moving the active item _inside an open list_ also writes the value
   * — the APG's "selection follows focus" for a listbox.
   *
   * @remarks
   *   A closed select always writes the value on a move, whatever this says: that
   *   is how the arrow keys change a closed select, and it is why Ariakit's
   *   guard reads `if (!setValueOnMove && mounted) return`.
   * @default false
   */
  setValueOnMove?: boolean
  /**
   * A combobox model to drive this select with, for a [select with a search
   * input](https://ariakit.com/examples/select-combobox).
   *
   * @remarks
   *   The two models _share_ the composite and the popover instead of syncing:
   *   the combobox input is the composite element, its list is the select's
   *   list, and one active item serves both. That deletes Ariakit's
   *   `mergeStore(props.store, omit(combobox, [...]))` — the shared keys are
   *   the sub-models, and the keys its `omit` list excludes (`value`, the item
   *   collection, the element handles) are the ones each model still owns.
   *
   *   Item ids come from the combobox too, so `select.renderItem('Apple')` and
   *   `combobox.renderItem('Apple')` are the same item: one element can be both
   *   a select item and a combobox item, which is what Ariakit renders as
   *   `<SelectItem render={<ComboboxItem />} />`.
   *
   *   Two things follow: the composite and popover options of this factory are
   *   the combobox's business and are ignored, and the "activate the selected
   *   item while the list is closed" derivation is off — Ariakit skips the same
   *   listener with a `if (combobox) return` and a "TODO: Revisit this".
   * @example
   *   const search = reatomCombobox({ name: 'fruit.search' })
   *   const fruit = reatomSelect({ combobox: search, name: 'fruit' })
   *
   *   fruit.popover === search.popover // true
   *   fruit.renderItem('Apple')
   *   search.composite.items.ids() // ['fruit.search-item-1'] — one collection
   */
  combobox?: Combobox<any> | null
}

/**
 * Options of {@link reatomSelect}: everything the composite, the popover, and
 * the prop records accept, plus {@link SelectExtOptions}.
 *
 * Five composite defaults differ from {@link reatomComposite}'s, matching
 * Ariakit's `createSelectStore` and the components it renders: `activeId` is
 * `null`, `orientation` is `'vertical'`, `virtualFocus` is on,
 * `includesBaseElement` is `false` — the list element is not part of the
 * arrow-key order even though the active id starts at `null` — and `typeahead`
 * is on, since Ariakit's `Select` and `SelectList` both render
 * `CompositeTypeahead`. The popover is placed `'bottom-start'`.
 *
 * A select driven by a {@link SelectExtOptions.combobox} has no typeahead of its
 * own: the composite belongs to the combobox, where typing filters the list
 * instead — Ariakit's `typeahead: !hasCombobox`.
 */
export interface SelectOptions<T extends SelectValue = SelectValue>
  extends
    Omit<CompositeOptions, 'items'>,
    Omit<PopoverOptions, 'name'>,
    SelectExtOptions<T>,
    SelectPropsOptions {
  /**
   * Items to register upfront, in order. They are registered but not rendered,
   * exactly like {@link CompositeOptions.items} — so nothing is navigable until
   * an element mounts, while the default value is seeded from them right away
   * (Ariakit's listener reads `items`, not `renderedItems`).
   */
  items?: Array<SelectItemInit>
}

/** Units attached to the value atom by {@link reatomSelect}. */
export interface SelectUnits<T extends SelectValue = SelectValue> {
  /**
   * The composite sub-model: its own state is the active item id, and it
   * carries the item collection, the navigation flags, and the navigation
   * queries. The list element is its base element.
   *
   * @remarks
   *   A sub-model instead of the flat state Ariakit merges, because a select has
   *   two different "current items" — the one that is selected (this model) and
   *   the one the keyboard is on (`select.composite()`) — and the flat shape is
   *   what makes them easy to confuse.
   * @example
   *   select.composite() // the active item id
   *   select.composite.navigate({ move: 'next' }) // arrow-key navigation
   */
  composite: Composite
  /**
   * The popover sub-model that holds the item list: its own state is `open`,
   * and it carries `mounted`, the dismissal policy, and the placement pair.
   *
   * @example
   *   select.popover.toggle()
   *   select.popover.mounted() // whether the list should be rendered
   */
  popover: Popover
  /** The combobox this select shares its composite and popover with, or `null`. */
  combobox: Combobox<any> | null
  /** Whether a move inside an open list also writes the value. */
  setValueOnMove: Atom<boolean>
  /** Whether the select holds several values, i.e. the value is an array. */
  multiSelectable: Computed<boolean>
  /**
   * The value as a list, which is what a multi-select's markup needs —
   * Ariakit's `toArray(state.value)`. Empty while nothing is chosen.
   */
  values: Computed<ReadonlyArray<string>>
  /**
   * The value the list opened with, i.e. what {@link SelectUnits.reset}
   * restores.
   *
   * @remarks
   *   It is frozen while the list is open, and refreshed by every value written
   *   while the list is closed — so a read between a pick made inside the list
   *   and the next open still reports the value that list opened with, which is
   *   the only window where the two differ.
   *
   *   Writable for the same reason its Ariakit counterpart has a setter: a
   *   consumer that commits the value some other way can move the restore
   *   point. `undefined` hands the answer back to the current value.
   */
  valueOnShow: Atom<T | undefined>
  /** The element that labels the select button. */
  labelElement: Atom<HTMLElement | null>
  /** The select button — the element that opens the list. */
  selectElement: Atom<HTMLElement | null>
  /** The element that holds the items. */
  listElement: Atom<HTMLElement | null>
  /**
   * The item id of the value picked last, or `undefined` when nothing is
   * picked, the item is not registered, or it is disabled.
   *
   * @remarks
   *   This is what makes a closed select reopen at its own selection: Ariakit
   *   finds the same item in a `sync` listener and writes `activeId` from it
   *   (`select-store.ts:146-163`), which is a derivation here.
   */
  selectedId: Computed<string | undefined>
  /**
   * The registered item values, in collection order and without duplicates —
   * the list Ariakit renders as the `<option>`s of its hidden native select.
   */
  itemValues: Computed<Array<string>>
  /**
   * The navigation snapshot in which an item without a value counts as
   * disabled, so navigation skips it.
   *
   * @remarks
   *   Ariakit's `nextWithValue(store, store.next)` walks the list with a growing
   *   `skip` until it lands on an item that has a value, "when moving through
   *   the items when the select list is closed, we don't want to move to items
   *   without value". Marking those items disabled says the same thing to
   *   {@link CompositeUnits.nextId} in one pass, and it keeps them in their
   *   place — which is what the grid, the loop, and the wrap need.
   */
  valueItems: Computed<Array<CompositeNavigationItem>>
  /**
   * The composite item id of a value, allocated on first use and stable for the
   * lifetime of the model, so an item that unmounts and mounts again keeps its
   * id.
   *
   * @remarks
   *   An item value is arbitrary text and would be an invalid `id`, so the ids
   *   are generated rather than derived — the same trade-off `reatomCombobox`
   *   documents. With a {@link SelectExtOptions.combobox} they are the
   *   combobox's ids, which is what makes one element both widgets' item.
   */
  itemId: (value: string) => string
  /**
   * The value an item id stands for; `undefined` for an unknown id, a nullish
   * one, or an item that has no value. Never throws: unknown ids are normal
   * during mount and unmount races.
   */
  itemValue: (id?: string | null) => string | undefined
  /** The composite item of a value, `null` while it is not registered. */
  item: (value: string) => CompositeItemNode | null
  /** Whether a value is currently selected. */
  isSelected: (value: string) => boolean
  /**
   * Registers the element of a value as a rendered composite item, so it
   * becomes navigable. `props.item(value)` calls it from its `ref`.
   */
  renderItem: Action<
    [value: string, init?: CompositeItemInit],
    CompositeItemNode
  >
  /** Undoes one {@link SelectUnits.renderItem}. */
  unrenderItem: Action<[value: string], boolean>
  /**
   * Picks one item: toggles it in the value when the select is
   * multi-selectable, replaces the value when it is not.
   *
   * It does not close the popover — that is the `hideOnClick` policy of the
   * item prop record, which Ariakit also keeps per item.
   */
  select: Action<[value: string], T | undefined>
  /**
   * Restores {@link SelectUnits.valueOnShow}, i.e. abandons what the keyboard
   * picked since the list opened. Ariakit's `resetOnEscape`.
   */
  reset: Action<[], T | undefined>
  /**
   * Resolves a navigation intent over {@link SelectUnits.valueItems}, so items
   * without a value are skipped. `undefined` means "nowhere to go".
   */
  nextValueId: (
    intent: CompositeNavigationIntent,
    overrides?: CompositeNavigationOverrides,
  ) => string | null | undefined
  /**
   * Moves the active item to {@link SelectUnits.nextValueId} _as a focus move_,
   * returning the id it moved to. This is the transition the select button's
   * arrow keys use, and with the list closed it also writes the value.
   */
  navigateValue: Action<
    [
      intent: CompositeNavigationIntent,
      overrides?: CompositeNavigationOverrides,
    ],
    string | null | undefined
  >
}

/**
 * A select model: the value atom extended with the composite and popover
 * sub-models, the item registry, and the transitions between them.
 *
 * Reading the model reads the value — `undefined` until an item seeds it, a
 * string for a single select, an array for a multi-select.
 *
 * @template T - The value type: `string`, or `Array<string>` for a
 *   multi-select.
 */
export interface SelectModel<T extends SelectValue = SelectValue>
  extends Atom<T | undefined>, SelectUnits<T> {}

/**
 * The model returned by {@link reatomSelect}: a {@link SelectModel} plus the prop
 * records.
 */
export interface Select<
  T extends SelectValue = SelectValue,
> extends SelectModel<T> {
  /** Reactive prop records for the button, the label, the list, and the items. */
  props: SelectPropRecords
}

/**
 * Wraps a caller-owned atom in a model-owned pass-through atom.
 *
 * @remarks
 *   The model can not `extend` the adopted atom directly: `extend` mutates its
 *   target in place and throws on already existing keys, so adopting a
 *   `reatomField` would both pollute the field and risk colliding with its
 *   members. Reading and writing through a proxy keeps the adopted atom the
 *   single source of truth — no mirroring, no second state that can diverge.
 *
 *   Deliberately duplicated from `checkbox/reatomCheckbox.ts`,
 *   `radio/reatomRadio.ts`, and `combobox/reatomCombobox.ts` instead of being
 *   imported: hoisting it into `interactions/` touches all of those ports,
 *   which is a separate change. All four copies should move there together.
 */
const adoptAtom = <T>(source: Atom<T>, name: string): Atom<T> =>
  // `createAtom` instead of `computed` to keep the `.set` method, like
  // `reatomLens` does.
  createAtom<T>({ computed: () => source() }, name).extend(
    withMiddleware(() => (next, ...params: [] | [T | ((state: T) => T)]): T => {
      if (params.length !== 0) {
        const update = params[0]
        source.set(
          typeof update === 'function'
            ? (update as (state: T) => T)(source())
            : update,
        )
      }
      return next()
    }),
  )

/**
 * Creates a select model: a button that opens a list of items, plus the one
 * value that list picks.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createSelectStore`. All four of its
 *   listeners change shape, and two of its mechanics disappear:
 *
 *   - The `new String('')` sentinel for "no value yet" becomes plain `undefined`
 *       (see {@link SelectExtOptions.value}), and the listener that seeds the
 *       first item's value into it becomes `withComputed` — lazy, and correct
 *       before anything subscribes.
 *   - The two listeners that write `activeId` when the list closes become one
 *       derivation of `popover.mounted` and {@link SelectUnits.selectedId}, so a
 *       reopened list starts at the current selection.
 *   - The `batch(select, ['setValueOnMove', 'moves'])` listener becomes a
 *       middleware on `composite.move`: the action _is_ the event, so a
 *       keyboard move writes the value while a plain `composite.set(id)` — a
 *       hover, a DOM focus, a programmatic write — does not.
 *   - `mergeStore(props.store, omit(combobox, [...]))` becomes _shared sub-models_
 *       (see {@link SelectExtOptions.combobox}).
 *   - `setValue` / `setLabelElement` / `setSelectElement` / `setListElement`
 *       identity setters are gone: write the atoms.
 *
 *   What is deliberately **not** ported: the hidden native `<select>` Ariakit
 *   renders for browser autofill is a view concern, so the model exposes what
 *   it needs ({@link SelectUnits.itemValues}, {@link SelectUnits.values}) and
 *   `props.native` gives it its attributes, but the `data-autofill` styling
 *   hook — component state that tracks whether the last write came from that
 *   element — is left out.
 * @example
 *   const fruit = reatomSelect({ name: 'fruit' })
 *
 *   fruit.renderItem('Apple')
 *   fruit.renderItem('Orange')
 *   fruit() // 'Apple' — the first item seeded the value
 *
 *   fruit.popover.show()
 *   fruit.composite() // the item id of 'Apple' — the list opens at the selection
 *   fruit.composite.navigate({ move: 'next' }) // ArrowDown
 *   fruit() // still 'Apple' — an open list only moves, unless setValueOnMove
 *   fruit.select('Orange')
 *   fruit() // 'Orange'
 *
 * @example
 *   // multi-select: the shape of `value` is the mode
 *   const fruits = reatomSelect({ value: [], name: 'fruits' })
 *
 *   fruits.multiSelectable() // true
 *   fruits.select('Apple')
 *   fruits.select('Orange')
 *   fruits() // ['Apple', 'Orange']
 *   fruits.select('Apple') // toggles
 *   fruits() // ['Orange']
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <label $spread={fruit.props.label}>Favorite fruit</label>
 *   <button $spread={fruit.props.select}>
 *   {fruit}
 *   <span $spread={fruit.props.arrow} />
 *   </button>
 *   <div $spread={fruit.popover.props.wrapper}>
 *   <div $spread={fruit.props.popover}>
 *   {['Apple', 'Orange'].map((value) => (
 *   <div $spread={fruit.props.item(value)}>{value}</div>
 *   ))}
 *   </div>
 *   </div>
 *   </>
 *
 * @see https://ariakit.com/components/select
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/#combobox-with-listbox-popup
 */
/**
 * The plain overload comes first so that `value: []` — the idiomatic "make it a
 * multi-select" — keeps the `SelectValue` union instead of inferring the
 * useless `Array<never>` from the empty literal. It omits `valueAtom` so that
 * adopting a typed atom does fall through to the generic one, where the adopted
 * atom's own type wins.
 */
export function reatomSelect(options?: Omit<SelectOptions, 'valueAtom'>): Select
export function reatomSelect<T extends SelectValue>(
  options: SelectOptions<T>,
): Select<T>

export function reatomSelect(options: SelectOptions = {}): Select {
  const {
    value: initValue,
    valueAtom,
    setValueOnMove: initSetValueOnMove = false,
    combobox = null,
    items: initItems,

    // Ariakit's select overrides of the composite and popover defaults.
    activeId: initActiveId = null,
    orientation = 'vertical',
    virtualFocus = true,
    includesBaseElement = false,
    typeahead = true,
    placement = 'bottom-start',
    id: initId,

    // prop-record options, forwarded to the records the factory builds
    popupRole,
    composite: isComposite,
    showOnKeyDown,
    moveOnKeyDown,
    toggleOnClick,
    focusOnHover,
    hideOnClick,
    setValueOnClick,
    hideOnEnter,
    resetOnEscape,
    nativeName,
    nativeForm,
    nativeRequired,

    name = named('select'),
    ...rest
  } = options

  if (valueAtom && initValue !== undefined) {
    throw new ReatomError(`${name}: pass either "value" or "valueAtom"`)
  }

  // The select button's id, which is the widget id: a `fruit` select renders
  // `id="fruit"` on the button the user clicks, and derives the list and label
  // ids from it, so the whole widget is stable between the server and the
  // client. Ariakit generates a random `useId` for each of the three.
  const elementId = initId ?? compositeElementId(name)
  const listId = `${elementId}-list`

  // Both sub-models receive the whole option rest: their factories destructure
  // what they know and ignore the rest, which keeps this factory from having to
  // enumerate two other option sets.
  //
  // With a combobox they are the combobox's own — see `SelectExtOptions.combobox`.
  const composite =
    combobox?.composite ??
    reatomComposite({
      ...rest,
      // The list element is the composite element of a select, so it carries
      // the composite id; the button is the disclosure, not the container.
      id: listId,
      activeId: initActiveId,
      orientation,
      virtualFocus,
      includesBaseElement,
      typeahead,
      name: `${name}.composite`,
    })

  const popover =
    combobox?.popover ??
    reatomPopover({
      ...rest,
      contentId: rest.contentId ?? listId,
      placement,
      name: `${name}.popover`,
    })

  // The value atom that holds the state: the caller's when adopted, ours
  // otherwise. `value` below is what the model is built on.
  const valueState = valueAtom ?? atom<SelectValue | undefined>(initValue, name)
  const value = valueAtom ? adoptAtom(valueAtom, name) : valueState

  const setValueOnMove = atom(initSetValueOnMove, `${name}.setValueOnMove`)

  const multiSelectable = computed(
    () => isSelectMultiSelectable(value()),
    `${name}.multiSelectable`,
  )
  const values = computed(() => toSelectValues(value()), `${name}.values`)

  const labelElement = atom<HTMLElement | null>(null, `${name}.labelElement`)
  const selectElement = atom<HTMLElement | null>(null, `${name}.selectElement`)
  const listElement = atom<HTMLElement | null>(null, `${name}.listElement`)

  // The value <-> item id registry. Plain maps, not atoms: an id never changes
  // once allocated, and the reactive part — which of those items is registered
  // and rendered — belongs to the composite collection.
  const idsByValue = new Map<string, string>()
  const valuesById = new Map<string, string>()
  let idSeed = 0

  const itemId = (itemValueOf: string): string => {
    let id = idsByValue.get(itemValueOf)
    if (id === undefined) {
      // With a combobox the id comes from there, so one element can register as
      // both widgets' item under a single id.
      id = combobox
        ? combobox.itemId(itemValueOf)
        : `${elementId}-item-${++idSeed}`
      idsByValue.set(itemValueOf, id)
      valuesById.set(id, itemValueOf)
    }
    return id
  }

  const itemValue = (id?: string | null): string | undefined => {
    if (id == null) return undefined
    // An item registered through the combobox alone is unknown here, and the
    // combobox knows it — the ids are the same ones.
    return valuesById.get(id) ?? combobox?.itemValue(id)
  }

  const item = (itemValueOf: string): CompositeItemNode | null => {
    const id = idsByValue.get(itemValueOf)
    return id === undefined ? null : composite.items.item(id)
  }

  const isSelected = (itemValueOf: string): boolean =>
    isSelectItemSelected(value(), itemValueOf) ?? false

  const renderItem = action(
    (itemValueOf: string, init?: CompositeItemInit): CompositeItemNode =>
      // The text is the item value, which is what a composite typeahead matches
      // on — Ariakit's collection reads the same string from `textContent`.
      composite.items.renderItem({
        text: itemValueOf,
        ...init,
        id: itemId(itemValueOf),
      }),
    `${name}.renderItem`,
  )

  const unrenderItem = action((itemValueOf: string): boolean => {
    const id = idsByValue.get(itemValueOf)
    return id === undefined ? false : composite.items.unrenderItem(id)
  }, `${name}.unrenderItem`)

  initItems?.forEach(({ value: itemValueOf, ...init }) => {
    composite.items.registerItem(
      itemValueOf === undefined ? init : { ...init, id: itemId(itemValueOf) },
    )
  })

  /** The first registered enabled item that has a value, for the seeding. */
  const firstValue = (): string | undefined => {
    for (const node of composite.items.array()) {
      const candidate = itemValue(node.id)
      if (candidate !== undefined && !node.disabled()) return candidate
    }
    return undefined
  }

  // Ariakit seeds the value from a `setup` + `sync` listener that compares the
  // state against its sentinel and writes the state back
  // (`select-store.ts:121-132`). A write-back derivation that must stay writable
  // is exactly `withComputed`, and it is attached to the atom that _holds_ the
  // state so an adopted atom is seeded as well.
  //
  // The cast works around `AtomState`, which drops `undefined` from a state
  // union because it infers through the optional `AtomLike.__state` property —
  // the same workaround `reatomComposite` needs for its `activeId` seed.
  valueState.extend(
    withComputed(((state: SelectValue | undefined) => {
      const first = firstValue()
      return state === undefined ? first : state
    }) as (state: SelectValue) => SelectValue),
  )

  const selectedId = computed(() => {
    const last = lastSelectValue(value())
    if (last === undefined) return undefined
    const node = item(last)
    // A disabled item is not activated: Ariakit's `items.find` filters it out,
    // which is what keeps a disabled selection from stealing the focus.
    return node && !node.disabled() ? node.id : undefined
  }, `${name}.selectedId`)

  const itemValues = computed(() => {
    const result: Array<string> = []
    for (const node of composite.items.array()) {
      const candidate = itemValue(node.id)
      if (candidate !== undefined && !result.includes(candidate)) {
        result.push(candidate)
      }
    }
    return result
  }, `${name}.itemValues`)

  const valueItems = computed(
    (): Array<CompositeNavigationItem> =>
      composite
        .navigationItems()
        .map((navigable) =>
          navigable.disabled || itemValue(navigable.id) !== undefined
            ? navigable
            : { ...navigable, disabled: true },
        ),
    `${name}.valueItems`,
  )

  const nextValueId = (
    intent: CompositeNavigationIntent,
    overrides?: CompositeNavigationOverrides,
  ): string | null | undefined =>
    composite.nextId(intent, { items: valueItems(), ...overrides })

  const navigateValue = action(
    (
      intent: CompositeNavigationIntent,
      overrides?: CompositeNavigationOverrides,
    ): string | null | undefined => {
      const id = nextValueId(intent, overrides)
      composite.move(id)
      return id
    },
    `${name}.navigateValue`,
  )

  const select = action(
    (itemValueOf: string): SelectValue | undefined =>
      value.set((state) => nextSelectValue(state, itemValueOf)),
    `${name}.select`,
  )

  // Ariakit keeps the restore point in `SelectList`'s component state and
  // refreshes it from an effect while the list is unmounted
  // (`select-list.tsx:75-83`). The snapshot is written here too, rather than
  // derived from `popover.mounted()`, and that is not a style choice: the
  // dialog's own Escape listener hides the popover from a *capture* listener on
  // the document, so by the time the list's `onKeyDown` reaches the reset the
  // list is already closed. A derivation would have unfrozen itself in between
  // and restored the very value it was asked to abandon.
  //
  // `undefined` means "nothing snapshotted yet", and then the current value
  // answers — which is how a default value that is only seeded when the value is
  // first pulled becomes the restore point without anything having to run.
  //
  // The cast works around `AtomState`, which drops `undefined` from a state
  // union because it infers through the optional `AtomLike.__state` property.
  const valueOnShow = atom<SelectValue | undefined>(
    undefined,
    `${name}.valueOnShow`,
  ).extend(
    withComputed(((state: SelectValue | undefined) => {
      // Read unconditionally, so the dependency is never dropped.
      const current = value()
      return state === undefined ? current : state
    }) as (state: SelectValue) => SelectValue),
  )

  // The list opening freezes the value into it…
  popover.extend(
    withMiddleware(() => (next, ...params) => {
      // `peek` before `next`: the settled previous state.
      const wasOpen = peek(popover)
      const state = next(...(params as [any]))
      if (params.length === 0) return state
      if (state === true && !wasOpen) valueOnShow.set(peek(value))
      return state
    }),
  )

  // …and a value written while the list is closed refreshes it, because a value
  // the list never showed is not something `reset` should abandon. Attached to
  // the atom that holds the state, like the seeding above, so that writing an
  // adopted atom directly counts too.
  valueState.extend(
    withMiddleware(() => (next, ...params) => {
      const state = next(...(params as [any]))
      if (params.length === 0) return state
      if (!peek(popover.mounted)) valueOnShow.set(state)
      return state
    }),
  )

  const reset = action(
    (): SelectValue | undefined => value.set(valueOnShow() as SelectValue),
    `${name}.reset`,
  )

  // Ariakit resets the active id when the list unmounts, "so that the active id
  // won't be pointing to another item when the popover is shown again"
  // (`select-store.ts:134-144`), and then activates the selected item while the
  // list is hidden (`:146-163`) — which is what makes a reopened list start at
  // the current selection. Two listeners, one derivation.
  //
  // With a combobox both are off: the combobox resets the shared active id to
  // its own initial one when its list closes, and Ariakit skips the second
  // listener for a combobox explicitly.
  if (!combobox) {
    composite.extend(
      withComputed((state) => {
        // Read unconditionally, so no dependency of the derivation is dropped.
        const isMounted = popover.mounted()
        const id = selectedId()

        let next = state
        ifChanged(popover.mounted, (mounted, _prevMounted, isFirst) => {
          if (!isFirst && !mounted) next = initActiveId
        })
        if (!isMounted && id !== undefined) next = id

        return next
      }),
    )
    // Anchor the first frame, like `withDisclosure` does for `animating`: an
    // atom pulled for the first time has no previous `mounted` to diff against.
    peek(composite)
  }

  // "Selection follows focus", Ariakit's `batch(select, ['setValueOnMove',
  // 'moves'])` listener. The action _is_ the event, so the policy is a
  // middleware on it — which keeps `select.composite.set(id)` the silent
  // "activate without selecting" of Ariakit's `setActiveId`.
  //
  // One difference: Ariakit's listener also fires when `setValueOnMove` itself
  // changes, so turning the flag on writes the active item's value into a value
  // the user never touched. A policy change is not an interaction.
  composite.move.extend(
    withMiddleware(() => (next, ...params) => {
      const payload = next(...params)
      const id = params[0]

      // `undefined` is the "nowhere to go" result of a navigation query, and
      // `null` is the base element — neither addresses an item.
      if (typeof id !== 'string') return payload
      // A closed select writes the value on every move; an open one only with
      // the flag, because there the value is committed by picking an item.
      if (!setValueOnMove() && popover.mounted()) return payload
      // A multi-select is never written by moving: a move would have to mean
      // "add" or "replace", and neither is what the arrow keys promise.
      if (multiSelectable()) return payload

      const itemValueOf = itemValue(id)
      if (itemValueOf === undefined) return payload
      if (composite.items.item(id)?.disabled()) return payload

      value.set(itemValueOf)
      return payload
    }),
  )

  return value
    .extend(() => ({
      composite,
      popover,
      combobox,
      setValueOnMove,
      multiSelectable,
      values,
      valueOnShow,
      labelElement,
      selectElement,
      listElement,
      selectedId,
      itemValues,
      valueItems,
      itemId,
      itemValue,
      item,
      isSelected,
      renderItem,
      unrenderItem,
      select,
      reset,
      nextValueId,
      navigateValue,
    }))
    .extend(
      withSelectProps({
        id: elementId,
        popupRole,
        composite: isComposite,
        showOnKeyDown,
        moveOnKeyDown,
        toggleOnClick,
        focusOnHover,
        hideOnClick,
        setValueOnClick,
        hideOnEnter,
        resetOnEscape,
        nativeName,
        nativeForm,
        nativeRequired,
        // Read off `options` rather than destructured: both keys are the
        // popover's too, and the list record and the popover's own `content`
        // record have to agree about them.
        alwaysVisible: options.alwaysVisible,
        hidden: options.hidden,
        name,
      }),
    ) as unknown as Select
}
