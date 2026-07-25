/**
 * Layer 1 for `combobox`: the model — a composite of the items plus a popover
 * that holds them, around the three values a combobox juggles.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/combobox/combobox-store.ts`, plus the
 * transitions Ariakit keeps in
 * `packages/ariakit-react-components/src/combobox/*.tsx`.
 */

import type { Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  createAtom,
  ifChanged,
  isCausedBy,
  named,
  peek,
  ReatomError,
  withComputed,
  withMiddleware,
} from '@reatom/core'

import type {
  Composite,
  CompositeItemInit,
  CompositeItemNode,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { Popover, PopoverOptions } from '../popover/reatomPopover'
import { reatomPopover } from '../popover/reatomPopover'
import type { TagModel } from '../tag/reatomTag'
import type {
  ComboboxAutoComplete,
  ComboboxSelectedValue,
} from './comboboxValue'
import {
  comboboxInputValue,
  isComboboxAutoCompleteInline,
  isComboboxItemSelected,
  isComboboxMultiSelectable,
  nextComboboxSelectedValue,
} from './comboboxValue'
import type { ComboboxPropRecords, ComboboxPropsOptions } from './props'
import { withComboboxProps } from './props'

/** Options {@link reatomCombobox} adds to the composite and popover ones. */
export interface ComboboxExtOptions<
  T extends ComboboxSelectedValue = ComboboxSelectedValue,
> {
  /**
   * Initial value of the input — what the user typed, which is _not_ what is
   * selected.
   *
   * @default ''
   */
  value?: string
  /**
   * Adopt a caller-owned atom for the input value: a `reatomField`, a route
   * search param, or another widget's atom. This is what "controlled" means in
   * Reatom.
   *
   * @remarks
   *   The adopted atom stays the single source of truth — the model reads and
   *   writes it through a pass-through proxy, because the model has to `extend`
   *   its own primary atom and must not add its members to yours.
   *
   *   {@link ComboboxExtOptions.resetValueOnHide} is attached to the adopted atom,
   *   since that is where the state lives. Ariakit does the same thing to a tag
   *   store: `mergeStore(props.store, pick(tag, ['value']))` makes the tag's
   *   `value` key _be_ the combobox's, and the reset writes that shared key.
   */
  valueAtom?: Atom<string>
  /**
   * Initially selected value(s). An array makes the combobox
   * [multi-selectable](https://ariakit.com/examples/combobox-multiple), which
   * also flips the defaults of {@link ComboboxExtOptions.resetValueOnSelect} and
   * {@link ComboboxExtOptions.resetValueOnHide}.
   *
   * @default ''
   */
  selectedValue?: T
  /**
   * Adopt a caller-owned atom for the selection. Unlike
   * {@link ComboboxExtOptions.valueAtom} it needs no proxy: the model only reads
   * and writes it.
   *
   * @example
   *   const form = reatomForm({ fruit: '' }, 'form')
   *   const combobox = reatomCombobox({
   *     selectedValueAtom: form.fields.fruit,
   *   })
   */
  selectedValueAtom?: Atom<T>
  /**
   * Whether picking an item clears the input value.
   *
   * @remarks
   *   Ariakit deprecated the store-level flag in favour of the per-item
   *   `resetValueOnSelect` prop, which is {@link ComboboxUnits.select}'s second
   *   argument here; this atom stays as its default.
   * @default multi-selectable
   */
  resetValueOnSelect?: boolean
  /**
   * Whether closing the popover restores the initial input value.
   *
   * @remarks
   *   The reset happens when the popover _unmounts_, not when it starts closing,
   *   so an animated combobox does not clear its field mid-animation — Ariakit
   *   keys the same listener on `mounted`.
   * @default multi-selectable and no `tag`
   */
  resetValueOnHide?: boolean
  /**
   * How the combobox completes what the user types. Only the
   * `aria-autocomplete` attribute and {@link ComboboxUnits.displayValue} depend
   * on it — the filtering itself is always the consumer's.
   *
   * @default 'list'
   */
  autoComplete?: ComboboxAutoComplete
  /**
   * Whether typing automatically activates the first item, so that Enter picks
   * it.
   *
   * @remarks
   *   Only effective with `virtualFocus`, because otherwise DOM focus would leave
   *   the input on every keystroke — Ariakit's `state.virtualFocus &&
   *   autoSelectProp`. See {@link ComboboxUnits.autoSelecting}.
   * @default false
   */
  autoSelect?: boolean
  /**
   * Whether this is a Safari touch device, where `aria-activedescendant` is
   * broken and virtual focus must be off — see
   * {@link ComboboxUnits.touchSafari}.
   *
   * @default false
   */
  touchSafari?: boolean
  /**
   * A tag model to render the combobox inside, for a multi-selectable combobox
   * whose selection is a list of tags.
   *
   * @remarks
   *   The two models _share_ atoms instead of syncing: the tag input's `value` is
   *   the combobox value, and the tag `values` are the combobox
   *   `selectedValue`. That deletes both halves of Ariakit's bidirectional
   *   `sync(combobox, ['selectedValue'])` / `sync(tag, ['values'])` pair.
   *
   *   The `rtl` flag follows the tag's while it is not passed explicitly, which
   *   is the other key Ariakit's `pick(tag, ['value', 'rtl'])` shares.
   * @example
   *   const invitees = reatomTag({ name: 'invitees' })
   *   const combobox = reatomCombobox({
   *     tag: invitees,
   *     name: 'invitees.combobox',
   *   })
   *
   *   combobox.select('jsx')
   *   invitees.values() // ['jsx'] — the same atom
   */
  tag?: TagModel | null
}

/**
 * Options of {@link reatomCombobox}: everything the composite, the popover, and
 * the prop records accept, plus {@link ComboboxExtOptions}.
 *
 * Five composite defaults differ from {@link reatomComposite}'s, matching
 * Ariakit's `createComboboxStore`: `activeId` is `null` (the input is the
 * initially active element), `orientation` is `'vertical'`, `focusLoop` and
 * `focusWrap` are on, `virtualFocus` is on, and `includesBaseElement` is
 * `true`. The popover is placed `'bottom-start'`.
 */
export interface ComboboxOptions<
  T extends ComboboxSelectedValue = ComboboxSelectedValue,
>
  extends
    CompositeOptions,
    Omit<PopoverOptions, 'name'>,
    ComboboxExtOptions<T>,
    ComboboxPropsOptions {}

/** Units attached to the input value atom by {@link reatomCombobox}. */
export interface ComboboxUnits<
  T extends ComboboxSelectedValue = ComboboxSelectedValue,
> {
  /**
   * The composite sub-model: its own state is the active item id, and it
   * carries the item collection, the navigation flags, and the navigation
   * queries. The combobox input is its base element.
   *
   * @remarks
   *   A sub-model instead of the flat state Ariakit merges, because a combobox
   *   has three different "values" and two different "active" notions, and the
   *   flat shape is what makes them easy to confuse. `null` is the meaningful
   *   active id here: it means the input itself is active, which is why
   *   `includesBaseElement` defaults to `true`.
   * @example
   *   combobox.composite() // the active item id, `null` for the input
   *   combobox.composite.navigate({ move: 'next' }) // arrow-key navigation
   */
  composite: Composite
  /**
   * The popover sub-model that holds the item list: its own state is `open`,
   * and it carries `mounted`, the dismissal policy, and the placement pair.
   *
   * @example
   *   combobox.popover.show()
   *   combobox.popover.mounted() // whether the list should be rendered
   */
  popover: Popover
  /**
   * The selected value(s) — what the widget is _for_, and what a form field
   * binds to. An array makes the combobox multi-selectable.
   *
   * Write it directly for a bulk change (Ariakit's `setSelectedValue`); use
   * {@link ComboboxUnits.select} for one item, because it also applies
   * `resetValueOnSelect`.
   */
  selectedValue: Atom<T>
  /**
   * The value of the item the user navigated to with the keyboard, or
   * `undefined`.
   *
   * @remarks
   *   This is the state behind the inline completion, and it deliberately does
   *   **not** follow the mouse: hovering an item activates it, but hovering is
   *   not a commitment, so completing the input from it would rewrite the field
   *   under the pointer.
   *
   *   Ariakit cannot tell the two apart without help, so it keeps a `moves`
   *   counter next to `activeId` and diffs it in two listeners
   *   (`combobox-store.ts:178-197`): "when the activeId changes, but the moves
   *   count doesn't, we reset the activeValue". Here the action _is_ the event
   *   — a write to the active id that `isCausedBy(composite.move)` fills this
   *   in, any other write clears it — so the counter, and with it the "moves
   *   incremented but nothing moved" state, is gone.
   *
   *   Ariakit's second listener, the one that re-resolves the value when
   *   `renderedItems` changes, is gone with it: an id here is allocated from
   *   the value ({@link ComboboxUnits.itemId}) before the element mounts, so a
   *   move to an item that is still loading already knows its value.
   *
   *   It is writable for the same reason Ariakit's is a state key: the inline
   *   completion layer may want to hold it. Closing the popover clears it.
   * @example
   *   combobox.composite.move(id) // keyboard: activeValue becomes the item value
   *   combobox.composite.set(id) // mouse or programmatic: activeValue clears
   */
  activeValue: Atom<string | undefined>
  /**
   * Whether the combobox selects several values, i.e. `selectedValue` is an
   * array.
   */
  multiSelectable: Computed<boolean>
  /** Whether picking an item clears the input value, by default. */
  resetValueOnSelect: Atom<boolean>
  /** Whether the input value is restored when the popover unmounts. */
  resetValueOnHide: Atom<boolean>
  /** How the combobox completes what the user types. */
  autoComplete: Atom<ComboboxAutoComplete>
  /** Whether {@link ComboboxUnits.autoComplete} completes the value inline. */
  inline: Computed<boolean>
  /**
   * Whether the _last interaction_ allows an inline completion: a keyboard move
   * enables it, and an edit that is not an insertion at the end of the value
   * disables it.
   *
   * @remarks
   *   Ariakit maintains the same flag as component state and enables it from a
   *   custom `combobox-item-move` DOM event that `ComboboxItem` dispatches on
   *   the input element (`combobox.tsx:232-243`, `combobox-item.tsx:213-222`).
   *   The event exists only because a store cannot express "a move happened";
   *   here `composite.move` is that event, so the flag is maintained from a
   *   middleware on it and the custom DOM event is gone.
   */
  canInline: Atom<boolean>
  /**
   * The value the input element should display, which is the typed value except
   * while an inline completion applies — see `comboboxInputValue`.
   *
   * Ariakit is explicit that this "will only affect the element's value, not
   * the combobox state".
   */
  displayValue: Computed<string>
  /** Whether typing automatically activates the first item. */
  autoSelect: Atom<boolean>
  /**
   * Whether the auto-select policy applies at all: it is on _and_ the focus is
   * virtual.
   *
   * @remarks
   *   Ariakit derives the same value and calls it `autoSelect` too
   *   (`combobox.tsx:153-156`): "We can only allow auto select when the
   *   combobox focus is handled via the aria-activedescendant attribute.
   *   Otherwise, the focus would move to the first item on every keypress."
   */
  autoSelectEnabled: Computed<boolean>
  /**
   * Whether the last interaction was one that may auto-select: typing sets it,
   * a key press, a blur, or opening the popover clears it.
   *
   * @remarks
   *   Ariakit keeps this in a `canAutoSelectRef` and clears it in six places, two
   *   of which need layout (a wheel or scroll event on the list, so that a
   *   virtualized list does not jump back to the first item). Those two are not
   *   ported — a consumer that virtualizes its list clears the atom from its
   *   own scroll handler.
   */
  canAutoSelect: Atom<boolean>
  /**
   * Whether an auto-select should happen right now: the policy is on, the last
   * interaction was typing, and the focus is virtual.
   */
  autoSelecting: Computed<boolean>
  /**
   * Whether virtual focus must be forced off because the widget runs on a
   * Safari touch device.
   *
   * @remarks
   *   Ariakit's comment (`combobox-store.ts:134-145`): "Safari doesn't support
   *   aria-activedescendant on combobox elements. This is particularly
   *   problematic when using touch devices as moving the VoiceOver virtual
   *   cursor through the combobox items will always move the focus to the input
   *   element." Its store therefore rewrites `virtualFocus` to `false` on every
   *   write, which is what the derivation plus the write middleware on
   *   `composite.virtualFocus` do here.
   *
   *   The override is one-way, like Ariakit's `setState('virtualFocus', false)`:
   *   clearing this atom stops the rewriting, it does not restore what was
   *   overwritten — write `composite.virtualFocus` for that.
   *
   *   The atom starts `false` and is filled in by `withComboboxTouchSafari()`
   *   (Layer 2), for the reason Ariakit probes the device in an effect: a
   *   platform check during render would make server-rendered markup differ
   *   from the client's.
   */
  touchSafari: Atom<boolean>
  /** The tag model this combobox shares its values with, or `null`. */
  tag: TagModel | null
  /**
   * The composite item id of a value, allocated on first use and stable for the
   * lifetime of the model, so an item that unmounts and mounts again keeps its
   * id.
   *
   * @remarks
   *   An item value is arbitrary text and would be an invalid `id`, so the ids
   *   are generated rather than derived — the same trade-off `reatomTag`
   *   documents. The allocation order is the render order, which keeps
   *   hydration stable.
   *
   *   This replaces the `value` field Ariakit adds to its composite items
   *   (`ComboboxStoreItem`), which a model outside `reatomComposite` cannot
   *   add.
   */
  itemId: (value: string) => string
  /**
   * The value an item id stands for; `undefined` for the input, an unknown id,
   * or a nullish one. Never throws: unknown ids are normal during mount and
   * unmount races.
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
  /** Undoes one {@link ComboboxUnits.renderItem}. */
  unrenderItem: Action<[value: string], boolean>
  /**
   * Picks one item: toggles it in the selection when the combobox is
   * multi-selectable, replaces the selection when it is not, and clears the
   * input value first when `resetValueOnSelect` applies.
   *
   * It does not close the popover and does not write the input value — those
   * are the `hideOnClick` and `setValueOnClick` policies of the item prop
   * record, which Ariakit also keeps per item.
   */
  select: Action<[value: string, resetValue?: boolean], T>
  /** Restores the initial input value — Ariakit's `resetValue`. */
  resetValue: Action<[], string>
  /**
   * Activates the item typing should pick, as a focus move: the first enabled
   * item that has a value, or the first enabled item, or `null` — the input
   * itself — when there is none.
   *
   * @remarks
   *   `null` matters: Ariakit's comment is "If there's no first item (that is,
   *   there are no items or all items are disabled), we should move the focus
   *   to the input (null), otherwise, with async items, the activeValue won't
   *   be reset."
   *
   *   Ariakit also skips items whose element has `role="tab"`, so that a combobox
   *   with tabs auto-selects a real item; preferring an item _with a value_ is
   *   the same exclusion without reading the DOM.
   */
  autoSelectFirst: Action<[], string | null>
}

/**
 * A combobox model: the input value atom extended with the composite and
 * popover sub-models, the selection, and the transitions between them.
 *
 * Reading the model reads what the user typed. `combobox.selectedValue()` is
 * what they picked, and `combobox.displayValue()` is what the input element
 * should show.
 *
 * @template T - The selected value type: `string`, or `Array<string>` for a
 *   multi-selectable combobox.
 */
export interface ComboboxModel<
  T extends ComboboxSelectedValue = ComboboxSelectedValue,
>
  extends Atom<string>, ComboboxUnits<T> {}

/**
 * The model returned by {@link reatomCombobox}: a {@link ComboboxModel} plus the
 * prop records.
 */
export interface Combobox<
  T extends ComboboxSelectedValue = ComboboxSelectedValue,
> extends ComboboxModel<T> {
  /** Reactive prop records for the input, the list, and the items. */
  props: ComboboxPropRecords
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
 *   Deliberately duplicated from `checkbox/reatomCheckbox.ts` and
 *   `radio/reatomRadio.ts` instead of being imported: hoisting it into
 *   `interactions/` touches both of those ports, which is a separate change.
 *   All three copies should move there together.
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
 * Creates a combobox model: a text input that filters a list of items, plus the
 * popover that holds them and the selection they feed.
 *
 * @remarks
 *   Ported from Ariakit's framework-agnostic `createComboboxStore`. Five of its
 *   mechanics change shape:
 *
 *   - The `moves` counter that discriminates a keyboard move from a mouse
 *       interaction is gone; `activeValue` is filled in from the write path of
 *       the active id, keyed on `isCausedBy(composite.move)`. See
 *       {@link ComboboxUnits.activeValue}.
 *   - The three `setup` + `sync` listeners that reset state when the popover closes
 *       become derivations (`withComputed` + `ifChanged`), so they are correct
 *       before anything subscribes to the model — Ariakit's only run while its
 *       store has a subscriber.
 *   - `mergeStore(props.store, pick(tag, ['value', 'rtl']))` and the two listeners
 *       that mirror `selectedValue` and `tag.values` become _shared atoms_: the
 *       tag's value atom is the combobox's value atom.
 *   - The `virtualFocus` rewrite for Safari touch devices becomes a writable
 *       derivation on `composite.virtualFocus`, and the platform probe moves to
 *       Layer 2 for SSR. See {@link ComboboxUnits.touchSafari}.
 *   - `setValue` / `setSelectedValue` / `setActiveId` identity setters are gone:
 *       write the atoms.
 *
 *   What is deliberately **not** ported, all of it component-lifetime bookkeeping
 *   around behavior that already exists here: highlighting the completion
 *   string with `setSelectionRange` (a view concern — `displayValue` says what
 *   to render, the caret is the adapter's), the `MutationObserver` on
 *   `data-placing` that delays the auto-select until the popover stopped moving
 *   (read `combobox.popover.placing()` instead), and the wheel / scroll
 *   listeners that disable the auto-select on a virtualized list (clear
 *   `canAutoSelect` from your own scroll handler).
 * @example
 *   const fruit = reatomCombobox({ name: 'fruit' })
 *
 *   fruit.renderItem('Apple')
 *   fruit.renderItem('Orange')
 *
 *   fruit.popover.show()
 *   fruit.composite.navigate({ move: 'first' }) // ArrowDown
 *   fruit.activeValue() // 'Apple' — a keyboard move
 *   fruit.select('Apple')
 *   fruit.selectedValue() // 'Apple'
 *
 * @example
 *   // multi-selectable: the shape of `selectedValue` is the mode
 *   const fruits = reatomCombobox({ selectedValue: [], name: 'fruits' })
 *
 *   fruits.multiSelectable() // true
 *   fruits.resetValueOnSelect() // true — typing starts over after each pick
 *   fruits.select('Apple')
 *   fruits.select('Orange')
 *   fruits.selectedValue() // ['Apple', 'Orange']
 *   fruits.select('Apple') // toggles
 *   fruits.selectedValue() // ['Orange']
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <input $spread={fruit.props.input} />
 *   <div $spread={fruit.popover.props.wrapper}>
 *   <div $spread={fruit.props.list}>
 *   {['Apple', 'Orange'].map((value) => (
 *   <div $spread={fruit.props.item(value)}>{value}</div>
 *   ))}
 *   </div>
 *   </div>
 *   </>
 *
 * @see https://ariakit.com/components/combobox
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 */
/**
 * The plain overload comes first so that `selectedValue: []` — the idiomatic
 * "make it multi-selectable" — keeps the `ComboboxSelectedValue` union instead
 * of inferring the useless `Array<never>` from the empty literal. It omits
 * `selectedValueAtom` so that adopting a typed atom does fall through to the
 * generic one, where the adopted atom's own type wins.
 */
export function reatomCombobox(
  options?: Omit<ComboboxOptions, 'selectedValueAtom'>,
): Combobox
export function reatomCombobox<T extends ComboboxSelectedValue>(
  options: ComboboxOptions<T>,
): Combobox<T>

export function reatomCombobox(options: ComboboxOptions = {}): Combobox {
  const {
    value: initValue,
    valueAtom,
    selectedValue: initSelectedValue,
    selectedValueAtom,
    resetValueOnSelect: initResetValueOnSelect,
    resetValueOnHide: initResetValueOnHide,
    autoComplete: initAutoComplete = 'list',
    autoSelect: initAutoSelect = false,
    touchSafari: initTouchSafari = false,
    tag = null,

    // Ariakit's combobox overrides of the composite and popover defaults.
    activeId: initActiveId = null,
    orientation = 'vertical',
    focusLoop = true,
    focusWrap = true,
    virtualFocus = true,
    includesBaseElement = true,
    placement = 'bottom-start',
    rtl,
    id: initId,

    // prop-record options, forwarded to the records the factory builds
    popupRole,
    showMinLength,
    showOnChange,
    showOnClick,
    showOnKeyPress,
    setValueOnChange,
    setValueOnClick,
    blurActiveItemOnClick,
    focusOnHover,
    hideWhenEmpty,
    cancelLabel,
    showLabel,
    hideLabel,

    name = named('combobox'),
    ...rest
  } = options

  if (valueAtom && initValue !== undefined) {
    throw new ReatomError(`${name}: pass either "value" or "valueAtom"`)
  }
  if (selectedValueAtom && initSelectedValue !== undefined) {
    throw new ReatomError(
      `${name}: pass either "selectedValue" or "selectedValueAtom"`,
    )
  }

  // The input element's id, which is the composite element id: the input _is_
  // the composite element of a combobox. It is derived from the model name and
  // not from the sub-model's, so a `fruit` combobox renders `id="fruit"`.
  const elementId = initId ?? compositeElementId(name)

  // Both sub-models receive the whole option rest: their factories destructure
  // what they know and ignore the rest, which keeps this factory from having to
  // enumerate two other option sets.
  const composite = reatomComposite({
    ...rest,
    id: elementId,
    activeId: initActiveId,
    orientation,
    focusLoop,
    focusWrap,
    virtualFocus,
    includesBaseElement,
    rtl: rtl ?? (tag ? peek(tag.rtl) : undefined),
    name: `${name}.composite`,
  })

  const popover = reatomPopover({
    ...rest,
    // The list element's id, which the input's `aria-controls` points at. The
    // dialog default would be `${name}-popover-content`; a combobox list reads
    // better, and Ariakit's own id is a random `useId` either way.
    contentId: rest.contentId ?? `${elementId}-list`,
    placement,
    name: `${name}.popover`,
  })

  // Ariakit's combobox store syncs the anchor from `baseElement ||
  // disclosureElement` rather than from the disclosure element alone
  // (`combobox-store.ts:133-157`), so the input anchors the list even when a
  // disclosure button of its own is around — and an explicitly set anchor still
  // wins over both.
  popover.anchorFallbackElement.extend(
    withComputed((state) => composite.baseElement() ?? state),
  )

  // Ariakit shares `rtl` with the tag store through `pick(tag, ['value','rtl'])`,
  // which mirrors the key in both directions. A writable derivation is the same
  // thing without the mirroring: the combobox follows the tag list's direction
  // unless the caller asked for one.
  if (tag && rtl === undefined) {
    composite.rtl.extend(withComputed(() => tag.rtl()))
  }

  // The value atom that holds the state: the caller's when adopted (including
  // the tag input's, which is what makes the two widgets one field), ours
  // otherwise. `value` below is what the model is built on.
  const adopted = valueAtom ?? tag?.value ?? null
  const initialValue = adopted ? peek(adopted) : (initValue ?? '')
  const valueState = adopted ?? atom(initialValue, name)
  const value = adopted ? adoptAtom(adopted, name) : valueState

  const selectedValue =
    selectedValueAtom ??
    // The tag values _are_ the selection, so the array shape also makes the
    // combobox multi-selectable — Ariakit resolves the same default from
    // `tagState?.values`.
    (tag?.values as unknown as Atom<ComboboxSelectedValue> | undefined) ??
    atom<ComboboxSelectedValue>(
      initSelectedValue ?? '',
      `${name}.selectedValue`,
    )

  const initialSelectedValue = peek(selectedValue)
  const initialMultiSelectable = isComboboxMultiSelectable(initialSelectedValue)

  const multiSelectable = computed(
    () => isComboboxMultiSelectable(selectedValue()),
    `${name}.multiSelectable`,
  )

  const resetValueOnSelect = atom(
    initResetValueOnSelect ?? initialMultiSelectable,
    `${name}.resetValueOnSelect`,
  )
  // Ariakit: `multiSelectable && !tag` — with a tag list the input value is the
  // tag draft, and the tag layer owns when it is cleared.
  const resetValueOnHide = atom(
    initResetValueOnHide ?? (initialMultiSelectable && !tag),
    `${name}.resetValueOnHide`,
  )

  const autoComplete = atom(initAutoComplete, `${name}.autoComplete`)
  const inline = computed(
    () => isComboboxAutoCompleteInline(autoComplete()),
    `${name}.inline`,
  )
  const canInline = atom(
    isComboboxAutoCompleteInline(initAutoComplete),
    `${name}.canInline`,
  )

  const autoSelect = atom(initAutoSelect, `${name}.autoSelect`)
  const canAutoSelect = atom(false, `${name}.canAutoSelect`)
  const autoSelectEnabled = computed(() => {
    // Both reads are unconditional so that neither dependency can be dropped.
    const policy = autoSelect()
    const virtual = composite.virtualFocus()
    return policy && virtual
  }, `${name}.autoSelectEnabled`)
  const autoSelecting = computed(() => {
    const enabled = autoSelectEnabled()
    const typed = canAutoSelect()
    return enabled && typed
  }, `${name}.autoSelecting`)

  const touchSafari = atom(initTouchSafari, `${name}.touchSafari`)
  // Ariakit rewrites the state on every write (`sync(combobox, ['virtualFocus'],
  // () => setState('virtualFocus', false))`), so an override that arrives later
  // is overridden too. That takes both halves of a write path: the derivation
  // reacts to the flag turning on, and it is only re-evaluated when one of
  // _its_ dependencies changes — a plain write wins over it — so the middleware
  // rewrites the requested value as well.
  composite.virtualFocus.extend(
    withComputed((state) => (touchSafari() ? false : state)),
    withMiddleware(
      () =>
        (next, ...params) =>
          // `peek`, because a middleware outside `computed` cannot subscribe;
          // the derivation above is what tracks the flag.
          params.length !== 0 && peek(touchSafari)
            ? next(false)
            : next(...(params as [any])),
    ),
  )

  // The value <-> item id registry. Plain maps, not atoms: an id never changes
  // once allocated, and the reactive part — which of those items is registered
  // and rendered — belongs to the composite collection.
  const idsByValue = new Map<string, string>()
  const valuesById = new Map<string, string>()
  let idSeed = 0

  const itemId = (itemValueOf: string): string => {
    let id = idsByValue.get(itemValueOf)
    if (id === undefined) {
      id = `${elementId}-item-${++idSeed}`
      idsByValue.set(itemValueOf, id)
      valuesById.set(id, itemValueOf)
    }
    return id
  }

  const itemValue = (id?: string | null): string | undefined =>
    id == null ? undefined : valuesById.get(id)

  const item = (itemValueOf: string): CompositeItemNode | null => {
    const id = idsByValue.get(itemValueOf)
    return id === undefined ? null : composite.items.item(id)
  }

  const isSelected = (itemValueOf: string): boolean =>
    isComboboxItemSelected(selectedValue(), itemValueOf) ?? false

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

  const resetValue = action(
    (): string => value.set(initialValue),
    `${name}.resetValue`,
  )

  const select = action(
    (
      itemValueOf: string,
      reset: boolean = resetValueOnSelect(),
    ): ComboboxSelectedValue => {
      // Ariakit's order: the value is cleared first, so a `setValueOnClick` that
      // runs afterwards still wins.
      if (reset) resetValue()
      return selectedValue.set((state) =>
        nextComboboxSelectedValue(state, itemValueOf),
      )
    },
    `${name}.select`,
  )

  /** The first enabled rendered item that has a value, for the auto-select. */
  const firstValueItemId = (): string | undefined =>
    composite
      .navigationItems()
      .find((navigable) => !navigable.disabled && valuesById.has(navigable.id))
      ?.id

  const autoSelectFirst = action((): string | null => {
    const id = firstValueItemId() ?? composite.first() ?? null
    composite.move(id)
    return id
  }, `${name}.autoSelectFirst`)

  const activeValue = atom<string | undefined>(
    undefined,
    `${name}.activeValue`,
  ).extend(
    // Ariakit resets the same state when the popover closes, by writing
    // `moves = 0` and letting its own listener clear it
    // (`combobox-store.ts:169-197`).
    //
    // The cast works around `AtomState`, which drops `undefined` from a state
    // union because it infers through the optional `AtomLike.__state` property
    // — the same workaround `reatomComposite` needs for its `activeId` seed.
    withComputed(((state: string | undefined) => {
      let next = state
      ifChanged(popover, (open, _prevOpen, isFirst) => {
        if (!isFirst && !open) next = undefined
      })
      return next
    }) as (state: string) => string),
  )
  // Anchor the first frame, like `withDisclosure` does for `animating`: an atom
  // pulled for the first time has no previous `open` to diff against.
  peek(activeValue)

  // The mouse-vs-keyboard discrimination, on the write path of the active id.
  // A middleware and not a derivation, because "how the active id was reached"
  // is a property of the write, not of the state — and `isCausedBy` is only
  // reliable outside a `computed`.
  composite.extend(
    withMiddleware(() => (next, ...params) => {
      // `peek` before `next`: the settled previous state. Its return value is
      // the *requested* one, which is what Ariakit's `setState` listener sees
      // too — a derivation that overrides it only re-runs on the next pull.
      const previous = peek(composite)
      const state = next(...(params as [any]))
      if (params.length === 0) return state

      if (isCausedBy(composite.move)) {
        // A move to an unknown id or to `null` — the input — has no value, which
        // is what clears the completion when the list becomes empty.
        activeValue.set(itemValue(state as string | null))
      } else if (state !== previous) {
        // A hover, a DOM focus, or a programmatic write. Ariakit's guard is the
        // same "did it actually change": re-activating the item that is already
        // active is what its own focus handler does right after a keyboard
        // move, and it must not undo the move.
        activeValue.set(undefined)
      }

      return state
    }),
  )

  // Ariakit resets the active id when the popover closes, so that reopening the
  // list starts at the input again (`combobox-store.ts:169-176`).
  composite.extend(
    withComputed((state) => {
      let next = state
      ifChanged(popover, (open, _prevOpen, isFirst) => {
        if (!isFirst && !open) next = initActiveId
      })
      return next
    }),
  )
  peek(composite)

  // Ariakit enables the inline completion from a custom `combobox-item-move` DOM
  // event dispatched on the input; the action is that event.
  composite.move.extend(
    withMiddleware(() => (next, ...params) => {
      const payload = next(...params)
      // `undefined` is the "nowhere to go" result of a navigation query, which
      // `move` itself ignores too.
      if (params[0] !== undefined && peek(inline)) canInline.set(true)
      return payload
    }),
  )

  // Ariakit restores the initial value when the popover unmounts. The listener
  // is a writable derivation here, attached to the atom that _holds_ the state,
  // so an adopted atom (a tag input's, a form field's) resets as well.
  //
  // Only the unmount triggers it, while Ariakit's listener keys on
  // `['resetValueOnHide', 'mounted']` and therefore also clears the field when
  // the flag is turned on while the popover is already closed — a policy change
  // is not an interaction, and clearing what the user typed for it would be
  // surprising.
  valueState.extend(
    withComputed((state) => {
      const reset = resetValueOnHide()
      let next = state
      ifChanged(popover.mounted, (isMounted, _prevMounted, isFirst) => {
        if (!isFirst && !isMounted && reset) next = initialValue
      })
      return next
    }),
  )
  peek(valueState)

  const displayValue = computed(() => {
    // Every read is unconditional, so that no dependency of the displayed value
    // can be dropped by a short circuit.
    const typed = value()
    const active = activeValue()
    const inlining = inline() && canInline()
    const selection = selectedValue()
    // Ariakit's `isFirstItemAutoSelected(items, activeValue, autoSelect)`: the
    // typed prefix is only kept when the active item is the one the auto-select
    // picked, because that is the item the user did not choose on purpose.
    const first = itemValue(firstValueItemId())

    return comboboxInputValue({
      value: typed,
      activeValue: active,
      inline: inlining,
      autoSelected:
        autoSelectEnabled() && active !== undefined && active === first,
      selectedValue: selection,
    })
  }, `${name}.displayValue`)

  return value
    .extend(() => ({
      composite,
      popover,
      selectedValue,
      activeValue,
      multiSelectable,
      resetValueOnSelect,
      resetValueOnHide,
      autoComplete,
      inline,
      canInline,
      displayValue,
      autoSelect,
      autoSelectEnabled,
      canAutoSelect,
      autoSelecting,
      touchSafari,
      tag,
      itemId,
      itemValue,
      item,
      isSelected,
      renderItem,
      unrenderItem,
      select,
      resetValue,
      autoSelectFirst,
    }))
    .extend(
      withComboboxProps({
        popupRole,
        showMinLength,
        showOnChange,
        showOnClick,
        showOnKeyPress,
        setValueOnChange,
        setValueOnClick,
        blurActiveItemOnClick,
        focusOnHover,
        hideWhenEmpty,
        cancelLabel,
        showLabel,
        hideLabel,
        // Read off `options` rather than destructured: both keys are the
        // popover's too, and the list record and the popover's own `content`
        // record have to agree about them.
        alwaysVisible: options.alwaysVisible,
        hidden: options.hidden,
        name,
      }),
    ) as unknown as Combobox
}
