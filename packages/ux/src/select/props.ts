/**
 * Layer 2 for `select`: the reactive prop records of the elements a select is
 * made of — the button that opens it, its label, the list of items, one item,
 * the arrow, and the hidden native `<select>` that makes browser autofill
 * work.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/select/select.tsx`, `select-item.tsx`,
 * `select-list.tsx`, `select-popover.tsx`, `select-label.tsx`, and
 * `select-arrow.tsx`.
 *
 * `SelectValue`, `SelectItemCheck`, `SelectGroup`, `SelectGroupLabel`,
 * `SelectRow`, `SelectSeparator`, `SelectHeading`, and `SelectDismiss` are not
 * ported: they render text, a checkmark, a grouping element, or reuse the
 * dialog's own dismiss record — a view concern with no state of its own.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import { isCompositeGrid } from '../composite/getNextId'
import {
  mapEntryIntent,
  mapNavigationIntent,
} from '../composite/navigationIntent'
import { applyTypeaheadIntent } from '../composite/props'
import { compositeElementId } from '../composite/reatomComposite'
import { VISUALLY_HIDDEN_STYLE } from '../dialog/dialogDom'
import { isDisclosureContentHidden } from '../disclosure/props'
import { isApple } from '../focusable/focusableDom'
import { isSelfTarget } from '../interactions/element'
import { queueBeforeEvent } from '../interactions/queueBeforeEvent'
import type { PopoverBasePlacement } from '../popover/popoverPlacement'
import type { PopoverContentProps } from '../popover/props'
import type { SelectModel } from './reatomSelect'
import {
  readNativeSelectValue,
  readNativeSelectValues,
} from './reatomSelectDom'
import {
  isSelectHideKey,
  isSelectResetKey,
  isSelectShowKey,
  mapSelectMoveIntent,
} from './selectIntent'
import { isSelectItemAutoFocus } from './selectValue'

/**
 * A select model of any value shape, which is what the prop records need: none
 * of them is typed by the value.
 */
export type AnySelectModel = SelectModel<any>

/**
 * The ARIA role of the element that holds the items — Ariakit's "any valid
 * select popup role".
 */
export type SelectPopupRole = 'listbox' | 'menu' | 'tree' | 'grid' | 'dialog'

/** The ARIA role of one item, which follows the popup's. */
export type SelectItemRole = 'option' | 'menuitem' | 'treeitem'

/**
 * The item role that belongs to a popup role.
 *
 * Port of Ariakit's `getPopupItemRole` (`select-item.tsx`); a `grid` or
 * `dialog` popup falls back to `option`, as it does there.
 *
 * Deliberately duplicated from `combobox/props.ts` rather than imported: the
 * `combobox` edge of `select` is type-only, and a runtime import would make
 * every select pull the combobox module in. Both copies should move to
 * `interactions/` together.
 *
 * @example
 *   selectItemRole('listbox') // 'option'
 *   selectItemRole('menu') // 'menuitem'
 *   selectItemRole('tree') // 'treeitem'
 */
export const selectItemRole = (popupRole: SelectPopupRole): SelectItemRole => {
  if (popupRole === 'menu') return 'menuitem'
  if (popupRole === 'tree') return 'treeitem'
  return 'option'
}

/**
 * Whether a popup role is one that accepts `aria-multiselectable`.
 *
 * Port of Ariakit's `isCompositeRole` check in `select-list.tsx`: a `menu`
 * announces multiple selection through `aria-checked` on its items instead.
 */
export const isSelectMultiSelectableRole = (
  popupRole: SelectPopupRole,
): boolean =>
  popupRole === 'listbox' || popupRole === 'tree' || popupRole === 'grid'

/** The minimal shape of an event every select record reads. */
export interface SelectPropsEvent {
  readonly defaultPrevented?: boolean
  preventDefault?: () => void
}

/**
 * An event that carries its targets.
 *
 * @remarks
 *   Both targets are `unknown` so that a real DOM event — whose `currentTarget`
 *   is `EventTarget | null` — stays assignable, and so a unit test can pass a
 *   plain object. The handlers narrow them at runtime.
 */
export interface SelectTargetedEvent extends SelectPropsEvent {
  readonly target: unknown
  readonly currentTarget: unknown
}

/** A `click` event, which only needs the element that was clicked. */
export interface SelectClickEvent extends SelectPropsEvent {
  readonly currentTarget?: unknown
  readonly altKey?: boolean
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
}

/** A `keydown` event. */
export interface SelectKeyboardEvent extends SelectTargetedEvent {
  readonly key: string
  /** `Ctrl+Home` / `Ctrl+End` leave the current row and jump to the whole grid. */
  readonly ctrlKey?: boolean
}

/** A `focus` event. */
export interface SelectFocusEvent extends SelectTargetedEvent {}

/** A `mousemove` or `mouseleave` event. */
export interface SelectMouseEvent extends SelectPropsEvent {}

/** A `change` event of the hidden native `<select>`. */
export interface SelectChangeEvent extends SelectPropsEvent {
  readonly target: unknown
}

/** Props to spread on the select button — the element that opens the list. */
export interface SelectButtonProps {
  /**
   * The widget id, which the label points at. The list element carries
   * `${id}-list`, so one name gives the whole widget stable ids.
   */
  id: string
  /** Keeps a `<button>` inside a `<form>` from submitting it. */
  type: 'button'
  /**
   * A custom select is announced as a combobox, not as a button: it is a
   * collapsed listbox control. Ariakit sets the same role.
   */
  role: 'combobox'
  /** There is nothing to type into, so nothing can be completed. */
  'aria-autocomplete': 'none'
  /** The role of the popup this button controls. */
  'aria-haspopup': SelectPopupRole
  'aria-expanded': boolean
  /** The list element, which must render the same id. */
  'aria-controls': string
  /**
   * The `label` record's element, once it is mounted. Ariakit reads
   * `labelElement?.id` for the same reason: a label that is not rendered must
   * not be referenced.
   */
  'aria-labelledby': string | undefined
  /**
   * Assigns `selectElement` and the popover's `disclosureElement` — the button
   * is both, and being the disclosure is also what anchors the list to it
   * unless the `anchor` record set an explicit anchor.
   */
  ref: (element: HTMLElement | null) => void
  /** Toggles the list. */
  onClick: (event?: SelectClickEvent) => void
  /**
   * Opens the list, and moves the active item — which on a closed select also
   * writes the value, so the arrow keys change a closed select.
   */
  onKeyDown: (event: SelectKeyboardEvent) => void
  /**
   * The typeahead: typing on the button jumps to the item whose text starts
   * with the characters, which on a closed select writes its value too.
   *
   * The capture phase is Ariakit's own choice: a printable key must not reach a
   * child that would act on it — `Space` on a nested button, for one.
   */
  onKeyDownCapture: (event: SelectKeyboardEvent) => void
}

/**
 * Props to spread on the label of the select button.
 *
 * @remarks
 *   Not a native `<label>`: the button is not a form control, so Ariakit renders
 *   a `div` that focuses the button when clicked, and this record does the
 *   same. A native `<label htmlFor>` would work as well — the button carries an
 *   `id` — and then only `ref` and `id` from this record are needed.
 */
export interface SelectLabelProps {
  /** The id the button's `aria-labelledby` points at. */
  id: string
  /** A label for a non-native control must not show a text cursor. */
  style: { cursor: 'default' }
  /** Assigns the model's `labelElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /** Focuses the select button, the way clicking a native label would. */
  onClick: (event?: SelectPropsEvent) => void
}

/** Props to spread on the element that holds the items. */
export interface SelectListProps {
  /** The id the button's `aria-controls` points at. */
  id: string
  role: SelectPopupRole
  /**
   * `true` while the select is multi-selectable, on a popup role that accepts
   * the attribute — see {@link isSelectMultiSelectableRole}.
   */
  'aria-multiselectable': true | undefined
  /** The `label` record's element, once it is mounted. */
  'aria-labelledby': string | undefined
  /**
   * The virtually focused item. `undefined` while `virtualFocus` is off, or
   * while the list is not the composite element — see
   * {@link SelectPropsOptions.composite}.
   */
  'aria-activedescendant': string | undefined
  /**
   * `0` while the list holds focus for the widget, which with `virtualFocus` is
   * always. `undefined` — no attribute — otherwise.
   */
  tabIndex: number | undefined
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  /**
   * Assigns the model's `listElement`, and the composite `baseElement` while
   * the list is the composite element.
   */
  ref: (element: HTMLElement | null) => void
  /**
   * Restores the value on `Escape`, closes the list on `Enter` or `Space`, and
   * navigates the items.
   */
  onKeyDown: (event: SelectKeyboardEvent) => void
  /**
   * The typeahead, as on the button — typing inside an open list jumps to the
   * matching item.
   */
  onKeyDownCapture: (event: SelectKeyboardEvent) => void
  /** Focusing the list itself makes the list, not an item, the active element. */
  onFocus: (event: SelectFocusEvent) => void
}

/**
 * Props to spread on a popover that _is_ the list — Ariakit's `SelectPopover`,
 * which renders `SelectList` and `Popover` on one element.
 */
export interface SelectPopoverProps
  extends
    Omit<
      PopoverContentProps,
      'role' | 'tabIndex' | 'ref' | 'onKeyDown' | 'aria-labelledby'
    >,
    Pick<
      SelectListProps,
      | 'role'
      | 'aria-multiselectable'
      | 'aria-labelledby'
      | 'aria-activedescendant'
      | 'tabIndex'
      | 'ref'
      | 'onKeyDown'
      | 'onKeyDownCapture'
      | 'onFocus'
    > {}

/** Props to spread on one item element. */
export interface SelectItemProps {
  id: string
  /** Follows the popup role — see {@link selectItemRole}. */
  role: SelectItemRole
  /** Announces and enforces that the item cannot be activated. */
  'aria-disabled': true | undefined
  /**
   * Whether the item is part of the value. Only a `listbox` (`option`) or a
   * `tree` (`treeitem`) item announces it; a `menu` uses `aria-checked`, and a
   * `grid` / `dialog` item has no selected state, so `aria-selected` there
   * would be invalid ARIA and stays `undefined`.
   */
  'aria-selected': boolean | undefined
  'data-active-item': true | undefined
  /**
   * Whether the item is the one the list should open at — the value picked
   * last. The dialog's initial-focus pass looks for this attribute.
   */
  'data-autofocus': true | undefined
  /**
   * The same answer as a real prop, for a view that honours `autoFocus`.
   *
   * @remarks
   *   Suppressed while a {@link SelectModel.combobox} has virtual focus off (iOS
   *   Safari), because then "a re-mounted selected item [would steal] focus
   *   from the combobox input (which dismisses the iOS keyboard)" — Ariakit
   *   issue #5047. `data-autofocus` stays set, so the dialog can still find the
   *   element.
   */
  autoFocus: boolean
  /**
   * `-1` keeps a non-active item out of the tab order — the roving tabindex.
   * With `virtualFocus` no item is tabbable at all.
   */
  tabIndex: number | undefined
  /**
   * Assigns the element **and** registers the item as rendered, because the
   * element being in the DOM is exactly what that registration means. Pass
   * `null` on unmount.
   */
  ref: (element: HTMLElement | null) => void
  /** Picks the item: writes the value and closes the list. */
  onClick: (event?: SelectClickEvent) => void
  /** Navigates the items, for the roving-tabindex mode. */
  onKeyDown: (event: SelectKeyboardEvent) => void
  /** Focusing an item makes it the active one. */
  onFocus: (event: SelectFocusEvent) => void
  /** Activates the item under the pointer while `focusOnHover` is on. */
  onMouseMove: (event?: SelectMouseEvent) => void
  /** Blurs the item when the pointer leaves it, the counterpart of the above. */
  onMouseLeave: (event?: SelectMouseEvent) => void
}

/**
 * Props to spread on the arrow inside the select button.
 *
 * The glyph itself is a view concern: Ariakit renders an SVG path and rotates
 * it per side, which this record exposes as `data-side` for CSS to act on.
 */
export interface SelectArrowProps {
  'aria-hidden': true
  /** The side the list is on, i.e. the direction the arrow points in. */
  'data-side': PopoverBasePlacement
}

/**
 * Props to spread on a hidden native `<select>`, for browser autofill and plain
 * form submission.
 *
 * @remarks
 *   Render it next to the select button with an `<option>` per
 *   {@link SelectPropRecords.nativeOptions} entry. Ariakit renders the same
 *   element whenever its `name` prop is given.
 *
 *   Ariakit's `data-autofill` styling hook is not ported: it is component state
 *   that tracks whether the last write came from this element, which a prop
 *   record has no lifetime for.
 */
export interface SelectNativeProps {
  /** The field name; `undefined` disables the element (no name, no submission). */
  name: string | undefined
  /** The `id` of the form to submit with, for an element outside it. */
  form: string | undefined
  required: boolean | undefined
  /** Follows the value shape, so a multi-select submits every value. */
  multiple: boolean
  /** The model's value, `''` while nothing is chosen. */
  value: string | ReadonlyArray<string>
  /** Out of the tab order: the select button is the widget's tab stop. */
  tabIndex: -1
  'aria-hidden': true
  style: typeof VISUALLY_HIDDEN_STYLE
  /**
   * Hands focus to the select button.
   *
   * @remarks
   *   Ariakit's comment: "Even though this element is visually hidden and is not
   *   tabbable, it's still focusable. Some autofill extensions like 1password
   *   will move focus to the next form element on autofill. In this case, we
   *   want to move focus to our custom select element."
   */
  onFocus: (event?: SelectPropsEvent) => void
  /** Writes what the browser autofilled into the model. */
  onChange: (event: SelectChangeEvent) => void
}

/** Options of {@link selectProps} and {@link withSelectProps}. */
export interface SelectPropsOptions {
  /**
   * The DOM `id` of the select button, which is the widget id. Defaults to a
   * DOM-safe derivation of the model name.
   */
  id?: string
  /**
   * The ARIA role of the element that holds the items, which also decides the
   * item role and whether `aria-multiselectable` is emitted.
   *
   * @remarks
   *   Ariakit reads the role off the rendered element instead
   *   (`getPopupRole(contentElement)`, `getPopupItemRole(listElement)`), which
   *   makes the button's `aria-haspopup` and every item's role wrong on the
   *   first render. Owning it as an option keeps them correct from the start.
   * @default 'listbox'
   */
  popupRole?: SelectPopupRole
  /**
   * Whether the list element is the composite element, i.e. the element that
   * carries the arrow-key navigation and `aria-activedescendant`.
   *
   * @remarks
   *   With a {@link SelectModel.combobox} it is not: the combobox input is the
   *   composite element, and the list only holds the items. That is exactly
   *   Ariakit's `composite = composite ?? !hasCombobox`.
   * @default no `combobox`
   */
  composite?: boolean
  /**
   * Whether an arrow key on the button opens the list. Which arrow does depends
   * on where the list is placed — see `isSelectShowKey`.
   *
   * @default true
   */
  showOnKeyDown?: boolean
  /**
   * Whether an arrow key on the button moves the active item while the list is
   * closed, which is what makes a closed select change its value.
   *
   * @default true
   */
  moveOnKeyDown?: boolean
  /**
   * Whether clicking the button toggles the list.
   *
   * @default true
   */
  toggleOnClick?: boolean
  /**
   * Whether hovering an item activates it. On by default, as in Ariakit — a
   * select list is not filtered, so nothing competes with the pointer.
   *
   * @default true
   */
  focusOnHover?: boolean
  /**
   * Whether clicking an item closes the list.
   *
   * @default not multi-selectable
   */
  hideOnClick?: boolean
  /**
   * Whether clicking an item writes its value. Turn it off for an item that
   * only navigates.
   *
   * @default true
   */
  setValueOnClick?: boolean
  /**
   * Whether `Enter` or `Space` on the list element — with no item active —
   * closes the list.
   *
   * @default true
   */
  hideOnEnter?: boolean
  /**
   * Whether `Escape` restores the value the list opened with. It only has an
   * effect while the value follows the active item, i.e. with `setValueOnMove`,
   * and never on a multi-select — Ariakit's `resetOnEscape &&
   * !multiSelectable`.
   *
   * @default true
   */
  resetOnEscape?: boolean
  /**
   * The `name` of the hidden native `<select>`. Leave it out to render no
   * native element, which is what Ariakit's missing `name` prop means.
   */
  nativeName?: string
  /** The `form` of the hidden native `<select>`. */
  nativeForm?: string
  /** The `required` of the hidden native `<select>`. */
  nativeRequired?: boolean
  /**
   * Keeps the list element visible even when it is not mounted, so a
   * third-party animation library can run its own exit transition.
   *
   * @default false
   */
  alwaysVisible?: boolean
  /** Forces the list's `hidden` prop. */
  hidden?: boolean
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/** Options of the {@link SelectPropRecords.item} record. */
export interface SelectItemPropsOptions {
  /**
   * Keeps arrow keys from landing on the item, and keeps its value out of the
   * selection and out of the default-value seeding.
   *
   * @default false
   */
  disabled?: boolean
  /** The row the item belongs to, which is what turns the list into a grid. */
  rowId?: string
  /**
   * The text the typeahead matches instead of the item's value — Ariakit's
   * `typeaheadText`, for an item whose value is not what the user would type.
   * An empty string opts the item out of the typeahead.
   */
  typeaheadText?: string
  /**
   * Whether clicking the item writes its value. Defaults to the model-wide
   * option.
   */
  setValueOnClick?: boolean
  /**
   * Whether clicking the item closes the list. Defaults to the model-wide
   * option.
   */
  hideOnClick?: boolean
  /** Whether hovering this item activates it. Defaults to the model-wide option. */
  focusOnHover?: boolean
  /** The record name. Defaults to `${model}.props.item#${value}`. */
  name?: string
}

/** Reactive prop records of a select model. */
export interface SelectPropRecords {
  /** Props for the select button — the element that opens the list. */
  select: Computed<SelectButtonProps>
  /** Props for the label of the select button. */
  label: Computed<SelectLabelProps>
  /** Props for the element that holds the items. */
  list: Computed<SelectListProps>
  /**
   * Props for a popover that _is_ the list: the popover's own `content` record
   * with the list's role, labelling, and navigation on top — Ariakit's
   * `SelectPopover`. Render it inside `select.popover.props.wrapper`, and do
   * not render {@link SelectPropRecords.list} as well.
   */
  popover: Computed<SelectPopoverProps>
  /**
   * Props for the element of one item value. The record is memoized per value,
   * so repeated calls keep the same identity; passing options returns a fresh,
   * uncached record.
   */
  item: (
    value: string,
    options?: SelectItemPropsOptions,
  ) => Computed<SelectItemProps>
  /** Props for an arrow rendered inside the select button. */
  arrow: Computed<SelectArrowProps>
  /** Props for a hidden native `<select>`, for autofill and form submission. */
  native: Computed<SelectNativeProps>
  /**
   * The values the hidden native `<select>` needs an `<option>` for: every
   * registered item value, preceded by anything the model holds that no item
   * carries — so a value set before its items arrived is still submittable.
   *
   * Not props: it is a list to render, not an object to spread.
   */
  nativeOptions: Computed<Array<string>>
}

/**
 * Builds the reactive prop records of a select model.
 *
 * @remarks
 *   Each record is a `computed` returning a plain object, so it is memoized,
 *   lazy, traceable by name, and neutral about the view library: React spreads
 *   it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it. Handlers are created
 *   once and `wrap`ped, which re-enters the Reatom frame so the logger
 *   attributes the state change to the DOM event, and they `notify()` so a host
 *   framework sees the update in the same tick — the `bindField` precedent.
 *
 *   The item record is keyed by **value** rather than by composite item node,
 *   because the value is what a select item _is_: the record allocates the item
 *   id from it ({@link SelectModel.itemId}) and registers the item from its own
 *   `ref`. That is also why the composite's own `base` and `item` records are
 *   not reused — they need a node that does not exist before the element
 *   mounts. The navigation half is the same {@link mapNavigationIntent} /
 *   {@link mapEntryIntent} pair they use.
 *
 *   Four Ariakit mechanics change shape:
 *
 *   - `nextWithValue(store, store.next)`, which walks the list with a growing
 *       `skip` until it finds an item that has a value, becomes
 *       {@link SelectModel.navigateValue} — one pass over a snapshot in which a
 *       value-less item counts as disabled.
 *   - The two roles read off the rendered elements become the `popupRole` option,
 *       so the button's `aria-haspopup` and the item roles are right on the
 *       first render.
 *   - The `defaultValue` the list remembers for `Escape` in component state becomes
 *       {@link SelectModel.valueOnShow}, so the reset works before anything
 *       renders.
 *   - `useBooleanEvent` — every `showOn*` / `setValueOn*` prop being either a
 *       boolean or a predicate over the event — becomes a plain optional
 *       boolean. A consumer that needs the predicate can read the event in its
 *       own handler and toggle the model.
 *
 *   `useCompositeTypeahead`, which Ariakit applies to both the button and the
 *   list, is the `onKeyDownCapture` of the `select`, `list`, and `popover`
 *   records: one handler over `composite.typeahead`, so typing on the closed
 *   button and typing inside the open list continue the same search. Each item
 *   registers its value as the text it is matched by, and
 *   {@link SelectItemPropsOptions.typeaheadText} overrides that.
 * @example
 *   const fruit = reatomSelect({ name: 'fruit' })
 *
 *   fruit.props.select().role // 'combobox'
 *   fruit.props.item('Apple')().ref(element) // registers the item
 *   fruit.props.item('Apple')().onClick() // selects it and closes the list
 */
export const selectProps = (
  model: AnySelectModel,
  options: SelectPropsOptions = {},
): SelectPropRecords => {
  const { composite, popover, combobox } = model
  const {
    name = model.name,
    id: elementId = compositeElementId(name),
    popupRole = 'listbox',
    // With a combobox the input is the composite element, and the list only
    // holds the items.
    composite: isComposite = !combobox,
    showOnKeyDown = true,
    moveOnKeyDown = true,
    toggleOnClick = true,
    focusOnHover: focusOnHoverDefault = true,
    hideOnClick: hideOnClickDefault,
    setValueOnClick: setValueOnClickDefault = true,
    hideOnEnter = true,
    resetOnEscape = true,
    nativeName,
    nativeForm,
    nativeRequired,
    alwaysVisible,
    hidden: hiddenProp,
  } = options

  const labelId = `${elementId}-label`
  const itemRole = selectItemRole(popupRole)
  const multiSelectableRole = isSelectMultiSelectableRole(popupRole)

  /**
   * The label of the widget, which is the `label` record's element and only
   * while it is mounted — Ariakit's `labelElement?.id`.
   */
  const labelledBy = (): string | undefined =>
    model.labelElement() ? labelId : undefined

  const ariaMultiSelectable = (): true | undefined =>
    multiSelectableRole && model.multiSelectable() ? true : undefined

  // --- the select button -----------------------------------------------------

  const selectRef = wrap((element: HTMLElement | null) => {
    model.selectElement.set(element)
    // The button is the popover's disclosure, which is what
    // `usePopoverDisclosure` assigns at the end of Ariakit's `useSelect`; the
    // popover anchors itself to it through `anchorFallbackElement`, so an
    // explicit anchor still wins.
    popover.disclosureElement.set(element)
  })

  const onSelectClick = wrap((event?: SelectClickEvent) => {
    if (event?.defaultPrevented) return
    if (!toggleOnClick) return
    popover.toggle()
    notify()
  })

  const onSelectKeyDown = wrap((event: SelectKeyboardEvent) => {
    if (event.defaultPrevented) return

    // Ariakit looks at the first enabled item that has a value: a list whose
    // items carry a `rowId` navigates in two dimensions, whatever the
    // orientation says.
    const grid = isCompositeGrid(model.valueItems())
    const intent = mapSelectMoveIntent(event, {
      orientation: composite.orientation(),
      grid,
    })

    if (showOnKeyDown && isSelectShowKey(event, popover.side())) {
      event.preventDefault?.()
      // Ariakit re-issues the move to the id it read _before_ the move branch
      // ran, so the key that opens the list undoes the move it also mapped: the
      // list opens at the item that was active, and the move event still lets
      // the value follow it. Skipping the move outright is the same end state,
      // and it does not write a value the user never saw.
      composite.move(composite())
      // Ariakit schedules the show after the key event has finished bubbling,
      // so opening the popover cannot make that same key scroll the page.
      const element = event.currentTarget as EventTarget | null
      if (
        element &&
        typeof element.addEventListener === 'function' &&
        typeof requestAnimationFrame === 'function'
      ) {
        queueBeforeEvent(element, 'keyup', () => {
          popover.show()
          notify()
        })
      } else {
        // Without a DOM there is nothing to race, which is what node tests see.
        popover.show()
      }
      return notify()
    }

    if (intent && moveOnKeyDown) {
      event.preventDefault?.()
      // The value-aware query, so a closed select never lands on an item that
      // has nothing to select.
      model.navigateValue(intent)
    }

    notify()
  })

  /**
   * The typeahead, shared by the button and the list.
   *
   * Ariakit applies `useCompositeTypeahead` to both elements, and the buffer
   * lives on the store, so typing on the button and typing inside the open list
   * continue one search. Here it is one handler over `composite.typeahead` for
   * the same reason.
   */
  const onTypeaheadKeyDown = wrap((event: SelectKeyboardEvent) => {
    applyTypeaheadIntent(composite, event)
    notify()
  })

  // --- the label -------------------------------------------------------------

  const labelRef = wrap((element: HTMLElement | null) => {
    model.labelElement.set(element)
  })

  const onLabelClick = wrap((event?: SelectPropsEvent) => {
    if (event?.defaultPrevented) return
    const element = model.selectElement()
    if (!element) return
    // Ariakit's comment: "queueMicrotask will guarantee that the focus and click
    // events will be triggered only after the current event queue is flushed
    // (which includes this click event)."
    queueMicrotask(wrap(() => element.focus()))
  })

  // --- the list --------------------------------------------------------------

  const listRef = wrap((element: HTMLElement | null) => {
    model.listElement.set(element)
    if (isComposite) composite.baseElement.set(element)
  })

  const onListKeyDown = wrap((event: SelectKeyboardEvent) => {
    if (event.defaultPrevented) return

    // A multi-select is never reset: its value does not follow the active item,
    // so there is nothing the keyboard could have changed by accident.
    if (resetOnEscape && !model.multiSelectable() && isSelectResetKey(event)) {
      model.reset()
    }

    // Only when no item handled the key: the list is a listbox, so Enter and
    // Space on the list itself confirm the selection.
    if (hideOnEnter && isSelectHideKey(event) && isSelfTarget(event)) {
      event.preventDefault?.()
      popover.hide()
      return notify()
    }

    if (isComposite && isSelfTarget(event)) {
      const virtual = composite.virtualFocus()
      const active = composite.activeItem()

      // With roving tabindex a mounted active item has DOM focus and handles its
      // own keys, so this is only the "enter the list" path.
      if (virtual || !active?.element()?.isConnected) {
        const shape = { orientation: composite.orientation() }
        const intent =
          virtual && active
            ? mapNavigationIntent(event, {
                ...shape,
                grid: active.rowId() !== undefined,
              })
            : mapEntryIntent(event, {
                ...shape,
                grid: isCompositeGrid(composite.navigationItems()),
              })
        if (intent && composite.navigate(intent) !== undefined) {
          event.preventDefault?.()
        }
      }
    }
    notify()
  })

  const onListFocus = wrap((event: SelectFocusEvent) => {
    if (!isComposite) return
    if (event.defaultPrevented) return
    // With virtual focus the list never stops being the focused element, so a
    // focus event says nothing about which item is active.
    if (composite.virtualFocus()) return
    if (!isSelfTarget(event)) return
    composite.set(null)
    notify()
  })

  const popoverRef = wrap((element: HTMLElement | null) => {
    popover.contentElement.set(element)
    listRef(element)
  })

  const onPopoverKeyDown = wrap((event: SelectKeyboardEvent) => {
    onListKeyDown(event)
    // The dialog's own handler, which closes the popover on Escape. It is pulled
    // here rather than captured so that this handler keeps one identity while
    // the popover record recomputes.
    popover.props.content().onKeyDown(event)
  })

  /** The composite half of the list and popover records. */
  const listNavigationProps = (): Pick<
    SelectListProps,
    'aria-activedescendant' | 'tabIndex'
  > => {
    if (!isComposite) {
      return { 'aria-activedescendant': undefined, tabIndex: undefined }
    }
    return {
      'aria-activedescendant': composite.activeDescendant(),
      tabIndex:
        composite.virtualFocus() || composite() === null ? 0 : undefined,
    }
  }

  // --- the item --------------------------------------------------------------

  const itemRecord = (
    value: string,
    itemPropsOptions: SelectItemPropsOptions = {},
  ): Computed<SelectItemProps> => {
    const id = model.itemId(value)
    const {
      disabled,
      rowId,
      typeaheadText,
      focusOnHover = focusOnHoverDefault,
      hideOnClick,
      setValueOnClick,
      // `#value` and not `#id`: the logger reads better with the text the user
      // sees, and it is the collection's own `items#id` convention.
      name: recordName = `${name}.props.item#${value}`,
    } = itemPropsOptions

    const isDisabled = (): boolean =>
      composite.items.item(id)?.disabled() ?? disabled ?? false

    const ref = wrap((element: HTMLElement | null) => {
      if (element) {
        model.renderItem(value, { element, disabled, rowId, typeaheadText })
      } else model.unrenderItem(value)
    })

    const activate = (): void => {
      if (isDisabled()) return
      if (setValueOnClick ?? setValueOnClickDefault) model.select(value)
      // Picking one of several values must leave the list open for the next one.
      if (hideOnClick ?? hideOnClickDefault ?? !model.multiSelectable()) {
        popover.hide()
      }
      notify()
    }

    const onClick = wrap((event?: SelectClickEvent) => {
      if (event?.defaultPrevented) return
      const element = event?.currentTarget as {
        tagName?: unknown
        type?: unknown
      } | null
      const tagName =
        typeof element?.tagName === 'string'
          ? element.tagName.toLowerCase()
          : undefined
      const navigationTarget =
        tagName === 'a' ||
        ((tagName === 'button' || tagName === 'input') &&
          element?.type === 'submit')
      if (
        navigationTarget &&
        (event?.altKey || (isApple() ? event?.metaKey : event?.ctrlKey))
      ) {
        return
      }
      activate()
    })

    const onFocus = wrap((event: SelectFocusEvent) => {
      if (event.defaultPrevented) return
      if (isDisabled()) return
      // Items can nest (a tree), and then a child's focus event bubbles through
      // its parent item — which must not steal it.
      if (!isSelfTarget(event)) return
      composite.set(id)
      notify()
    })

    const onKeyDown = wrap((event: SelectKeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!isSelfTarget(event)) return

      if (isSelectHideKey(event)) {
        const element = event.currentTarget as {
          tagName?: unknown
          type?: unknown
        } | null
        const tagName =
          typeof element?.tagName === 'string'
            ? element.tagName.toLowerCase()
            : undefined
        const inputType =
          typeof element?.type === 'string'
            ? element.type.toLowerCase()
            : undefined
        const nativeActivation =
          tagName === 'button' ||
          (tagName === 'input' &&
            (inputType === 'button' ||
              inputType === 'image' ||
              inputType === 'reset' ||
              inputType === 'submit')) ||
          (tagName === 'a' && event.key === 'Enter')
        if (nativeActivation) return

        event.preventDefault?.()
        activate()
        return
      }

      const node = composite.items.item(id)
      const intent = mapNavigationIntent(event, {
        orientation: composite.orientation(),
        grid: node?.rowId() !== undefined,
      })
      if (!intent) return

      if (composite.navigate(intent) !== undefined) event.preventDefault?.()
      notify()
    })

    const onMouseMove = wrap(() => {
      if (!focusOnHover) return
      if (isDisabled()) return
      // Ariakit's comment: "We have to disable focusOnHover when the popup is
      // closed, otherwise the active item will change to null (the container)
      // when the popup is closed by clicking on an item."
      if (!popover()) return
      // A plain write and not a `move`: hovering is not a commitment, which is
      // what keeps `setValueOnMove` from writing the value under the pointer.
      composite.set(id)
      notify()
    })

    const onMouseLeave = wrap(() => {
      if (!focusOnHover) return
      if (!popover()) return
      composite.set(null)
      notify()
    })

    return computed((): SelectItemProps => {
      const node = composite.items.item(id)
      const active = composite()
      const itemDisabled = node?.disabled() ?? disabled ?? false
      const autoFocus =
        !itemDisabled &&
        isSelectItemAutoFocus({
          value: model(),
          itemValue: value,
          active: active === id,
          // A stale or `null` active id addresses no item, and then the selected
          // item takes focus instead — which is what makes the list open at the
          // current selection.
          activeKnown: composite.items.item(active ?? null) !== null,
        })

      return {
        id,
        role: itemRole,
        'aria-disabled': itemDisabled || undefined,
        // Only `listbox`/`tree` items carry `aria-selected`; `menu` announces
        // selection through `aria-checked`, `grid`/`dialog` have no such state.
        'aria-selected':
          popupRole === 'listbox' || popupRole === 'tree'
            ? model.isSelected(value)
            : undefined,
        'data-active-item': active === id || undefined,
        'data-autofocus': autoFocus || undefined,
        autoFocus:
          // Ariakit reads `virtualFocus` off the combobox store, so the
          // suppression only applies to a select that has one.
          combobox && !combobox.composite.virtualFocus() ? false : autoFocus,
        // An unregistered item keeps its natural tab stop, which is the
        // composite's own fallback for an item it does not know yet.
        tabIndex: node && !node.tabbable() ? -1 : undefined,
        ref,
        onClick,
        onKeyDown,
        onFocus,
        onMouseMove,
        onMouseLeave,
      }
    }, recordName)
  }

  const itemRecords = new Map<string, Computed<SelectItemProps>>()

  // --- the hidden native select ----------------------------------------------

  const onNativeFocus = wrap(() => {
    model.selectElement()?.focus()
  })

  const onNativeChange = wrap((event: SelectChangeEvent) => {
    if (event.defaultPrevented) return
    model.set(
      model.multiSelectable()
        ? readNativeSelectValues(event.target)
        : readNativeSelectValue(event.target),
    )
    notify()
  })

  return {
    select: computed(
      (): SelectButtonProps => ({
        id: elementId,
        type: 'button',
        role: 'combobox',
        'aria-autocomplete': 'none',
        'aria-haspopup': popupRole,
        'aria-expanded': popover(),
        'aria-controls': popover.contentId(),
        'aria-labelledby': labelledBy(),
        ref: selectRef,
        onClick: onSelectClick,
        onKeyDown: onSelectKeyDown,
        onKeyDownCapture: onTypeaheadKeyDown,
      }),
      `${name}.props.select`,
    ),

    label: computed(
      (): SelectLabelProps => ({
        id: labelId,
        style: { cursor: 'default' },
        ref: labelRef,
        onClick: onLabelClick,
      }),
      `${name}.props.label`,
    ),

    list: computed((): SelectListProps => {
      const hidden = isDisclosureContentHidden(
        popover.mounted(),
        hiddenProp,
        alwaysVisible,
      )

      return {
        id: composite.id(),
        role: popupRole,
        'aria-multiselectable': ariaMultiSelectable(),
        'aria-labelledby': labelledBy(),
        ...listNavigationProps(),
        hidden,
        style: hidden ? { display: 'none' } : undefined,
        ref: listRef,
        onKeyDown: onListKeyDown,
        onKeyDownCapture: onTypeaheadKeyDown,
        onFocus: onListFocus,
      }
    }, `${name}.props.list`),

    popover: computed((): SelectPopoverProps => {
      const base = popover.props.content()

      return {
        ...base,
        role: popupRole,
        'aria-multiselectable': ariaMultiSelectable(),
        // The select's own label wins over the dialog's heading, which is the
        // order Ariakit's `useSelectList` + `usePopover` chain produces.
        'aria-labelledby': labelledBy() ?? base['aria-labelledby'],
        ...listNavigationProps(),
        ref: popoverRef,
        // Both handlers run: the select's `Escape` restores the value and the
        // dialog's closes the popover, which is the order Ariakit's handler
        // chain gives.
        onKeyDown: onPopoverKeyDown,
        onKeyDownCapture: onTypeaheadKeyDown,
        onFocus: onListFocus,
      }
    }, `${name}.props.popover`),

    item: (value, itemPropsOptions) => {
      if (itemPropsOptions) return itemRecord(value, itemPropsOptions)

      let record = itemRecords.get(value)
      if (!record) itemRecords.set(value, (record = itemRecord(value)))
      return record
    },

    arrow: computed(
      (): SelectArrowProps => ({
        'aria-hidden': true,
        'data-side': popover.side(),
      }),
      `${name}.props.arrow`,
    ),

    native: computed(
      (): SelectNativeProps => ({
        name: nativeName,
        form: nativeForm,
        required: nativeRequired,
        multiple: model.multiSelectable(),
        value: model() ?? '',
        tabIndex: -1,
        'aria-hidden': true,
        style: VISUALLY_HIDDEN_STYLE,
        onFocus: onNativeFocus,
        onChange: onNativeChange,
      }),
      `${name}.props.native`,
    ),

    nativeOptions: computed(() => {
      const values = model.itemValues()
      // Ariakit renders the current value first when no item carries it, so a
      // value that arrived before its items is still submittable.
      const orphans = model.values().filter((value) => !values.includes(value))
      return [...orphans, ...values]
    }, `${name}.props.nativeOptions`),
  }
}

/**
 * Attaches {@link selectProps} to a select model as `model.props`.
 *
 * {@link reatomSelect} applies it already; use it explicitly when composing a
 * select model by hand.
 */
export const withSelectProps = (
  options: SelectPropsOptions = {},
): AssignerExt<{ props: SelectPropRecords }, AnySelectModel> => {
  return (target) => ({ props: selectProps(target, options) })
}
