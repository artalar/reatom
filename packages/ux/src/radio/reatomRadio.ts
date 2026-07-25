/**
 * Layer 1 for `radio`: a composite plus the group value.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/radio/radio-store.ts` and the a11y behavior
 * Ariakit keeps in `packages/ariakit-react-components/src/radio/radio.tsx` and
 * `radio-group.tsx`.
 */

import type { Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  createAtom,
  named,
  ReatomError,
  withComputed,
  withMiddleware,
} from '@reatom/core'

import type {
  Composite,
  CompositeItemNode,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { RadioPropRecords, RadioPropsOptions } from './props'
import { withRadioProps } from './props'

/**
 * The value of a single radio — the `value` attribute of the bound element.
 *
 * @remarks
 *   Ariakit's `RadioOptions['value']` is the same union: a number is kept as a
 *   number in the state and only stringified when it reaches the DOM.
 */
export type RadioItemValue = string | number

/**
 * The value of a radio group: the checked radio's value, or `null` while
 * nothing is checked.
 *
 * @remarks
 *   `null` — not `undefined` — is Ariakit's "nothing selected" default, and it is
 *   what a form field holds for an unanswered radio question.
 */
export type RadioValue = RadioItemValue | null

/**
 * Derives whether one radio is checked from the group value.
 *
 * @remarks
 *   Ported from `getIsChecked` in `ariakit-react-components/src/radio/radio.tsx`.
 *   The `itemValue`-less form mirrors Ariakit's `!!storeValue` fallback, which
 *   is what a radio rendered without a `value` prop reports.
 * @example
 *   isRadioItemChecked('apple', 'apple') // true
 *   isRadioItemChecked('apple', 'orange') // false
 *   isRadioItemChecked(null, 'apple') // false
 *   isRadioItemChecked(0, 0) // true
 *   isRadioItemChecked('apple') // true — "something is selected"
 *
 * @param state - The group value.
 * @param itemValue - The radio's value, or `undefined` for a radio that has
 *   none.
 * @returns Whether the radio is the checked one.
 */
export const isRadioItemChecked = (
  state: RadioValue,
  itemValue?: RadioItemValue,
): boolean => {
  if (itemValue != null && state != null) return state === itemValue
  return Boolean(state)
}

/**
 * Derives the item id of a radio from the group id and the radio's value.
 *
 * @remarks
 *   Ariakit generates a random `id-${random}` per radio and therefore needs a
 *   second identifier (`value`) next to it. Deriving the id from the value
 *   removes that duplication, keeps the markup stable between the server and
 *   the client, and makes the value → id direction a pure function — which is
 *   what lets {@link RadioUnits.checkedId} stay a plain `computed`.
 *
 *   The group id prefix is what keeps two groups with the same values apart, the
 *   same problem Ariakit solves for the native `name` attribute (issue #3833).
 * @example
 *   radioItemId('plan', 'free') // 'plan-free'
 *   radioItemId('plan', 'a b') // 'plan-a-b' — non-word characters collapse
 */
export const radioItemId = (groupId: string, value: RadioItemValue): string =>
  compositeElementId(`${groupId}-${value}`)

/**
 * Registration payload of one radio — plain data, never atoms.
 *
 * Applied to the underlying composite item, so a repeated registration only
 * overwrites the keys it carries.
 */
export interface RadioItemPatch {
  /**
   * Keeps arrow keys from landing on the radio and makes selecting it a no-op.
   * The radio stays registered, so it keeps its place in the group and remains
   * reachable for screen readers — Ariakit's `accessibleWhenDisabled` default
   * for composite items.
   *
   * @default false
   */
  disabled?: boolean
  /** The radio's text content, for typeahead. */
  text?: string
  /** The bound element. Usually assigned by the prop record's `ref` instead. */
  element?: HTMLElement | null
}

/** Registration payload of one radio, including the value that identifies it. */
export interface RadioItemInit extends RadioItemPatch {
  /** The value this radio contributes to the group. */
  value: RadioItemValue
}

/**
 * One radio of a group: the value-addressed sub-model that owns its derived
 * a11y state and its registration in the group's item collection.
 *
 * @remarks
 *   The composite item node behind it is looked up reactively, so the sub-model
 *   survives a full unregister / re-register cycle without going stale — and so
 *   a radio can be described, and its prop record built, before its element
 *   mounts.
 * @template T - The group value type.
 */
export interface RadioItemModel<T extends RadioValue = RadioValue> {
  /** Unit name of this radio — `plan#free`. */
  name: string
  /** The value this radio contributes to the group. */
  value: RadioItemValue
  /** The composite item id, which is also the DOM `id` of the element. */
  id: string
  /**
   * The composite item, registered when the sub-model was created. `null` only
   * after the item was unregistered by hand.
   */
  node: Computed<CompositeItemNode | null>
  /** Whether this radio is the checked one. */
  checked: Computed<boolean>
  /**
   * Whether the group or the radio itself is disabled. Write the radio's own
   * flag with {@link RadioItemModel.update}.
   */
  disabled: Computed<boolean>
  /**
   * Whether user intent is accepted: the group is editable and the radio is
   * enabled.
   */
  editable: Computed<boolean>
  /**
   * Whether this radio is the group's active item — the source of
   * `data-active-item`.
   */
  active: Computed<boolean>
  /** Whether this radio holds the group's single tab stop (roving tabindex). */
  tabbable: Computed<boolean>
  /** The bound element, assigned by the prop record's `ref`. */
  element: Computed<HTMLElement | null>
  /**
   * Applies a registration payload — `disabled`, `text`, `element` — to the
   * already registered radio, and returns its node. Only the keys it carries
   * are written, exactly like a repeated registration in the collection.
   */
  update: Action<[patch?: RadioItemPatch], CompositeItemNode | null>
  /**
   * Marks the radio as rendered, i.e. present in the DOM, which is what makes
   * it navigable. Call it when the element mounts; the prop record's `ref` does
   * it for you.
   */
  render: Action<[patch?: RadioItemPatch], CompositeItemNode>
  /**
   * Undoes one {@link RadioItemModel.render} and clears the element handle. The
   * radio stays registered — it keeps its `disabled` and `text` across a mount
   * cycle — so this returns `false`.
   */
  unrender: Action<[], boolean>
  /**
   * Selects this radio, returning the resulting group value. Refused when the
   * group is not editable or the radio is disabled.
   */
  select: Action<[], T>
}

/** Options of {@link reatomRadio}. */
export interface RadioOptions<T extends RadioValue = RadioValue>
  extends Omit<CompositeOptions, 'items'>, RadioPropsOptions {
  /**
   * Initial value of the model-owned value atom. Mutually exclusive with
   * `valueAtom`.
   *
   * @default null
   */
  value?: T
  /**
   * Adopt a caller-owned atom instead of creating one — this is what
   * "controlled" means in Reatom.
   *
   * @remarks
   *   Pass a `reatomForm` field to drop the group into a form (the field's dirty
   *   tracking and `validateOnChange` react to the write), a search-param atom
   *   to keep the answer in the URL, or the same atom to two models to drive
   *   one group from two widgets.
   * @example
   *   const form = reatomForm({ plan: 'free' }, 'form')
   *   const plan = reatomRadio({ valueAtom: form.fields.plan })
   */
  valueAtom?: Atom<T>
  /**
   * Radios to register upfront, in order. They are registered but not rendered,
   * exactly like {@link CompositeOptions.items} — so nothing is navigable until
   * an element mounts.
   */
  items?: Array<RadioItemInit>
  /**
   * Loops from the last radio back to the first one.
   *
   * @remarks
   *   Ariakit's radio store overrides the composite default here
   *   (`defaultValue(props.focusLoop, syncState?.focusLoop, true)`) because a
   *   radio group is a single-choice list: the APG keyboard contract expects
   *   arrow keys to cycle through it.
   * @default true
   */
  focusLoop?: CompositeOptions['focusLoop']
  /**
   * Whether moving the active radio also selects it — the APG's "selection
   * follows focus" for radio groups.
   *
   * @remarks
   *   Ariakit expresses the same policy implicitly: its `Radio` selects from the
   *   `onFocus` handler, but only for a native `<input type="radio">` and only
   *   when the focus came from a `moves` bump. Set it to `false` to get the
   *   custom-element behavior, where arrow keys only move and `Space` selects.
   * @default true
   */
  selectOnMove?: boolean
  /**
   * Initial group-level disabled flag. Selection is refused while it is set;
   * navigation still works, so a screen-reader user can read the whole group.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * Initial group-level read-only flag: the group can be navigated and read,
   * but not changed.
   *
   * @default false
   */
  readOnly?: boolean
}

/**
 * Units attached to the value atom by {@link reatomRadio}.
 *
 * @template T - The group value type.
 */
export interface RadioUnits<T extends RadioValue = RadioValue> {
  /**
   * The composite sub-model: its own state is the active item id, and it
   * carries the item collection, the navigation flags, and the navigation
   * queries.
   *
   * @remarks
   *   A sub-model instead of a merged surface, because a radio group has two
   *   distinct states — which radio is checked (this model) and which radio is
   *   focused (`radio.composite()`) — and Ariakit's flat store shape is exactly
   *   what makes them easy to confuse.
   * @example
   *   radio.composite() // the active item id
   *   radio.composite.navigate({ move: 'next' }) // arrow-key navigation
   *   radio.composite.extend(withCompositeFocus()) // move real DOM focus
   */
  composite: Composite
  /** Whether moving the active radio also selects it. */
  selectOnMove: Atom<boolean>
  /** Group-level disabled flag. */
  disabled: Atom<boolean>
  /** Group-level read-only flag. */
  readOnly: Atom<boolean>
  /** `false` while user intent must be ignored: `disabled` or `readOnly`. */
  editable: Computed<boolean>
  /**
   * The item id of the checked radio, or `undefined` while nothing is checked.
   * A pure derivation of the value, see {@link radioItemId}.
   */
  checkedId: Computed<string | undefined>
  /**
   * Returns the memoized sub-model of one radio, registering it in the group on
   * first access. Calling it twice with the same value returns the same model,
   * so prop-record identity is stable.
   *
   * @remarks
   *   Registering is not rendering: the radio is known to the group and keeps its
   *   `disabled` / `text` state, but it is not navigable until its element
   *   mounts. That makes the first call a write, so describe radios where you
   *   create the model or in a component body — not inside a `computed`.
   */
  item: (value: RadioItemValue) => RadioItemModel<T>
  /**
   * Selects a value, returning the resulting group value.
   *
   * @remarks
   *   Refused — the previous value is returned unchanged — when the group is not
   *   editable or the addressed radio is disabled. `null` clears the selection,
   *   which no user interaction can do; it is there for a "reset" button.
   *
   *   Writing the model atom directly bypasses both guards, which is what makes
   *   it the right tool for hydration and tests.
   */
  select: Action<[value: RadioValue], T>
  /**
   * Hands the group's single tab stop back to the checked radio, and returns
   * the id it moved to — or `undefined` when nothing is checked or the checked
   * radio is not rendered.
   *
   * @remarks
   *   The APG contract is that `Tab` enters a radio group at the checked radio.
   *   Arrow keys can leave the active item elsewhere — a group with
   *   `selectOnMove` off navigates without selecting — so the tab stop has to be
   *   put back when focus leaves the group. Ariakit does exactly this from
   *   `RadioGroup`'s `onBlurCapture` (react-components 0.3.0: "tabbing back into
   *   a group focuses the checked `Radio` after another unchecked `Radio` has
   *   received focus"); {@link RadioGroupProps.onBlur} is the port of it.
   *
   *   A plain `composite.set`, not a `move`: putting the tab stop back is not a
   *   navigation, so "selection follows focus" must not fire.
   */
  activateChecked: Action<[], string | undefined>
}

/**
 * A radio group model: the value atom extended with the composite sub-model,
 * the group-level flags, and the value-addressed radio sub-models.
 *
 * Reading the model reads the checked value; writing it sets the value with no
 * guards at all.
 *
 * @template T - The group value type.
 */
export interface RadioModel<T extends RadioValue = RadioValue>
  extends Atom<T>, RadioUnits<T> {}

/**
 * The model returned by {@link reatomRadio}: a {@link RadioModel} plus the prop
 * records.
 */
export interface Radio<
  T extends RadioValue = RadioValue,
> extends RadioModel<T> {
  /** Reactive prop records for the group element and its radios. */
  props: RadioPropRecords
}

/**
 * Wraps a caller-owned atom in a model-owned pass-through atom.
 *
 * @remarks
 *   The model can not `extend` the adopted atom directly: `extend` mutates its
 *   target in place and throws on already existing keys, so adopting a
 *   `reatomForm` field would both pollute the field and collide on its
 *   `disabled` member. Reading and writing through a proxy keeps the adopted
 *   atom the single source of truth — no mirroring, no second state that can
 *   diverge, and the same atom can back several models.
 *
 *   Deliberately duplicated from `checkbox/reatomCheckbox.ts` instead of being
 *   imported: hoisting it into `interactions/` touches the checkbox port, which
 *   is a separate change. Both copies should move there together.
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
 * Creates a headless radio group model: an ordered, navigable group of radios
 * plus the single value they share.
 *
 * @remarks
 *   Ported from Ariakit's `createRadioStore`
 *   (`ariakit-components/src/radio/radio-store.ts`), which is a composite store
 *   with a `value` state and `focusLoop` defaulted to `true`, together with the
 *   behavior Ariakit keeps in its `Radio` and `RadioGroup` components.
 *
 *   Three Ariakit mechanics change shape, all of them for the better:
 *
 *   - `setValue` is gone. Guarded selection is {@link RadioUnits.select}; an
 *       unguarded write is `radio.set(...)`.
 *   - The random per-radio `id` plus a separate `value` prop collapse into one
 *       identity: the item id is derived from the value ({@link radioItemId}).
 *   - The `useEffect` in `radio.tsx` that pushes `activeId` onto the checked radio
 *       — commented "TODO: Maybe this could be done in the radio store
 *       directly?" — is a `withComputed` derivation here, so the checked radio
 *       is the group's tab stop before anything renders or subscribes.
 *
 *   "Selection follows focus" (the APG contract for radio groups, and what
 *   Ariakit's native-radio `onFocus` implements through the `moves` counter) is
 *   a middleware on the composite's `move` action: navigating selects, writing
 *   `radio.composite.set(id)` does not. See {@link RadioOptions.selectOnMove}.
 * @example
 *   const plan = reatomRadio({ value: 'free', name: 'plan' })
 *
 *   plan.item('free').render()
 *   plan.item('pro').render()
 *
 *   plan.composite() // 'plan-free' — the checked radio is the tab stop
 *   plan.item('free').checked() // true
 *
 *   plan.composite.navigate({ move: 'next' }) // arrow key
 *   plan() // 'pro' — selection followed focus
 *
 * @example
 *   // @reatom/jsx
 *   ;<div $spread={plan.props.group}>
 *   <input $spread={plan.props.item(plan.item('free'))} />
 *   <input $spread={plan.props.item(plan.item('pro'))} />
 *   </div>
 *
 * @example
 *   // as a form field
 *   const form = reatomForm({ plan: null as RadioValue }, 'form')
 *   const plan = reatomRadio({ valueAtom: form.fields.plan, name: 'plan' })
 *
 * @param options - See {@link RadioOptions}.
 * @returns The value atom extended with the radio units and prop records.
 * @see https://ariakit.com/components/radio
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/radio/
 */
export function reatomRadio(options?: RadioOptions): Radio
export function reatomRadio<T extends RadioValue>(
  options: RadioOptions<T>,
): Radio<T>

export function reatomRadio(options: RadioOptions = {}): Radio {
  const {
    value: initValue,
    valueAtom,
    items: initItems,
    focusLoop = true,
    selectOnMove: initSelectOnMove = true,
    disabled: initDisabled = false,
    readOnly: initReadOnly = false,
    id: initId,
    name = named('radio'),
    // prop-record options, forwarded as the group-wide defaults
    native,
    nativeName,
    clickOnEnter,
    labelledBy,
    describedBy,
    ...compositeOptions
  } = options

  if (valueAtom && initValue !== undefined) {
    throw new ReatomError(
      `${name}: pass either "value" or "valueAtom", not both`,
    )
  }

  const value = valueAtom
    ? adoptAtom(valueAtom, name)
    : atom<RadioValue>(initValue ?? null, name)

  // The group id prefixes every radio id, so two groups with the same values
  // stay apart, and it is the default native `name` too (Ariakit issue #3833).
  const groupId = initId ?? compositeElementId(name)

  const composite = reatomComposite({
    ...compositeOptions,
    focusLoop,
    id: groupId,
    name: `${name}.composite`,
  })

  const selectOnMove = atom(initSelectOnMove, `${name}.selectOnMove`)
  const disabled = atom(initDisabled, `${name}.disabled`)
  const readOnly = atom(initReadOnly, `${name}.readOnly`)
  const editable = computed(
    () => !disabled() && !readOnly(),
    `${name}.editable`,
  )

  const checkedId = computed(() => {
    const state = value()
    return state === null ? undefined : radioItemId(groupId, state)
  }, `${name}.checkedId`)

  // Ariakit does this in its component, with an effect that calls `setActiveId`
  // whenever the checked radio changes (`radio.tsx`, "TODO: Maybe this could be
  // done in the radio store directly?"). A derivation that must stay writable —
  // arrow keys move the active radio without selecting it when `selectOnMove` is
  // off — is exactly `withComputed`, and it stacks on top of the composite's own
  // "first enabled item" seed: the checked radio wins when there is one.
  composite.extend(
    withComputed((state) => {
      const id = checkedId()
      if (id === undefined) return state
      // Only a rendered radio can hold the tab stop; an unrendered one has no
      // element to focus.
      return composite.items.item(id)?.rendered() ? id : state
    }),
  )

  const select = action((next: RadioValue): RadioValue => {
    if (!editable()) return value()
    if (next !== null) {
      // A disabled radio is skipped by navigation, but `select` can still be
      // called with its value — Ariakit refuses the same transition in its
      // `onChange` guard.
      const node = composite.items.item(radioItemId(groupId, next))
      if (node?.disabled()) return value()
    }
    return value.set(next)
  }, `${name}.select`)

  const activateChecked = action((): string | undefined => {
    const id = checkedId()
    if (id === undefined) return undefined
    // Only a rendered radio can hold the tab stop, the same guard the
    // `withComputed` seed above applies.
    if (!composite.items.item(id)?.rendered()) return undefined
    composite.set(id)
    return id
  }, `${name}.activateChecked`)

  const itemsByValue = new Map<RadioItemValue, RadioItemModel>()
  const itemsById = new Map<string, RadioItemModel>()

  const createItem = (
    itemValue: RadioItemValue,
    patch: RadioItemPatch = {},
  ): RadioItemModel => {
    const id = radioItemId(groupId, itemValue)
    const itemName = `${name}#${itemValue}`

    // Registering on creation is what makes the per radio state outlive a mount
    // cycle: `unrender` then only drops the render reference, so `disabled` and
    // `text` survive. The node is still looked up reactively, because a caller
    // can unregister the item by hand.
    composite.items.registerItem({ ...patch, id })

    const node = computed(() => composite.items.item(id), `${itemName}.node`)
    const itemDisabled = computed(
      () => disabled() || (node()?.disabled() ?? false),
      `${itemName}.disabled`,
    )

    const model: RadioItemModel = {
      name: itemName,
      value: itemValue,
      id,
      node,
      checked: computed(
        () => isRadioItemChecked(value(), itemValue),
        `${itemName}.checked`,
      ),
      disabled: itemDisabled,
      editable: computed(
        () => editable() && !(node()?.disabled() ?? false),
        `${itemName}.editable`,
      ),
      active: computed(() => node()?.active() ?? false, `${itemName}.active`),
      tabbable: computed(
        () => node()?.tabbable() ?? false,
        `${itemName}.tabbable`,
      ),
      element: computed(() => node()?.element() ?? null, `${itemName}.element`),
      update: action((patch: RadioItemPatch = {}) => {
        const target = node()
        if (!target) return null
        // Writing the atoms instead of re-registering: a repeated registration
        // would also add a reference the caller never asked for.
        if (patch.disabled !== undefined) target.disabled.set(patch.disabled)
        if (patch.text !== undefined) target.text.set(patch.text)
        if (patch.element !== undefined) target.element.set(patch.element)
        return target
      }, `${itemName}.update`),
      render: action(
        (patch: RadioItemPatch = {}) =>
          composite.items.renderItem({ ...patch, id }),
        `${itemName}.render`,
      ),
      unrender: action(() => {
        const target = node()
        if (!target) return false
        // The element is gone before the collection knows, so clear the handle
        // first: the item survives the unrender (it is still registered) and must
        // not keep a detached element.
        target.element.set(null)
        return composite.items.unrenderItem(target)
      }, `${itemName}.unrender`),
      select: action(() => select(itemValue), `${itemName}.select`),
    }

    itemsByValue.set(itemValue, model)
    itemsById.set(id, model)

    return model
  }

  const item = (itemValue: RadioItemValue): RadioItemModel =>
    itemsByValue.get(itemValue) ?? createItem(itemValue)

  initItems?.forEach(({ value: itemValue, ...patch }) => {
    const model = itemsByValue.get(itemValue)
    if (model) model.update(patch)
    else createItem(itemValue, patch)
  })

  // "Selection follows focus": the APG contract of a radio group, and what
  // Ariakit's native `Radio` implements by watching the `moves` counter from its
  // `onFocus` handler. The action _is_ the event here, so the policy is a
  // middleware on it — which keeps `radio.composite.set(id)` the silent
  // "activate without selecting" of Ariakit's `setActiveId`.
  composite.move.extend(
    withMiddleware(() => (next, ...params) => {
      const payload = next(...params)
      const id = params[0]
      // `undefined` is the "nowhere to go" result of a navigation query, and
      // `null` is the group element itself — neither addresses a radio.
      if (selectOnMove() && typeof id === 'string') {
        itemsById.get(id)?.select()
      }
      return payload
    }),
  )

  return value
    .extend(() => ({
      composite,
      selectOnMove,
      disabled,
      readOnly,
      editable,
      checkedId,
      item,
      select,
      activateChecked,
    }))
    .extend(
      withRadioProps({
        native,
        nativeName,
        clickOnEnter,
        labelledBy,
        describedBy,
      }),
    ) as Radio
}
