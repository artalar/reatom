/**
 * Layer 2 for `tag`: the reactive prop records of the six elements a tag input
 * is made of — the list, the accessible listbox, the label, the text input, one
 * tag, and its remove button.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tag/tag-list.tsx`, `tag-input.tsx`,
 * `tag.tsx`, `tag-remove.tsx`, and `tag-list-label.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import type { CompositeOrientation } from '../composite/getNextId'
import { mapNavigationIntent } from '../composite/navigationIntent'
import type {
  CompositeBaseProps,
  CompositePropRecords,
  CompositePropsOptions,
} from '../composite/props'
import { compositeProps } from '../composite/props'
import { isApple } from '../focusable/focusableDom'
import { isSelfTarget } from '../interactions/element'
import { queueBeforeEvent } from '../interactions/queueBeforeEvent'
import type { TagModel } from './reatomTag'
import {
  getClosestFocusable,
  readTagInput,
  setTagInputCaret,
} from './reatomTagDom'
import type { TagDelimiter } from './tagIntent'
import {
  canTagInputNavigate,
  isTagRemoveLastKey,
  mapTagChangeIntent,
  mapTagKeyIntent,
  parseTagValues,
} from './tagIntent'

/** The `aria-orientation` a tag list can carry; `both` has no ARIA counterpart. */
export type TagAriaOrientation = 'horizontal' | 'vertical'

/**
 * The `aria-orientation` of the tag listbox, or `undefined` when the tags are
 * navigable on both axes — Ariakit's `state.orientation === 'both' ? undefined
 * : state.orientation`.
 */
export const tagAriaOrientation = (
  orientation: CompositeOrientation,
): TagAriaOrientation | undefined =>
  orientation === 'both' ? undefined : orientation

/** The `id` of the remove button that describes the tag element `tagElementId`. */
export const tagRemoveElementId = (tagElementId: string): string =>
  `${tagElementId}-remove`

/** The minimal shape of an event every tag record reads. */
export interface TagPropsEvent {
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
export interface TagTargetedEvent extends TagPropsEvent {
  readonly target: unknown
  readonly currentTarget: unknown
}

/** A `keydown` event. */
export interface TagKeyboardEvent extends TagTargetedEvent {
  readonly key: string
  readonly ctrlKey?: boolean
  readonly metaKey?: boolean
}

/** An input event, including native and framework-wrapped IME state. */
export interface TagInputEvent extends TagTargetedEvent {
  /** Native DOM events expose the composition state directly. */
  readonly isComposing?: boolean
  /** React and similar adapters expose it on the wrapped native event. */
  readonly nativeEvent?: { readonly isComposing?: boolean }
}

/** A `paste` event; only its plain text is read. */
export interface TagClipboardEvent extends TagPropsEvent {
  readonly clipboardData?: { getData: (format: string) => string } | null
}

/**
 * Props to spread on the tag list — the element that wraps the tags and the
 * input, and is usually styled as the input field.
 *
 * @remarks
 *   The composite base props, plus one behavior. Unlike Ariakit, no `role` or
 *   `aria-*` is moved off this element onto the hidden listbox: the only ARIA
 *   the composite emits is `aria-activedescendant`, which must stay on the
 *   element that holds focus.
 */
export interface TagListProps extends CompositeBaseProps {
  /**
   * Focuses the input when the list itself is clicked, so the padding around
   * the tags behaves like the padding of a text field.
   */
  onMouseDown: (event: TagTargetedEvent) => void
}

/**
 * Props to spread on the accessible listbox: a visually hidden element that
 * _owns_ the tags for assistive technology.
 *
 * @remarks
 *   Ariakit's reason for the extra element (`tag-list.tsx`): a `listbox` accepts
 *   only `option` children, and the tag list has to contain an `input` too,
 *   because a text field that is a sibling of the tags is the only way to style
 *   the widget as one field. So the roles live on a separate element that
 *   references the tags with `aria-owns`, and `aria-live` announces a tag that
 *   is added or removed.
 */
export interface TagListboxProps {
  /** `list` on a touch device, see {@link TagModel.touch}. */
  role: 'listbox' | 'list'
  'aria-live': 'polite'
  'aria-relevant': 'all'
  'aria-atomic': true
  /**
   * Set from the `label` option, and then takes precedence over the label
   * element.
   */
  'aria-label': string | undefined
  /** The label element, once it is mounted. */
  'aria-labelledby': string | undefined
  'aria-orientation': TagAriaOrientation | undefined
  /** The tag element ids, space separated — the tags this listbox contains. */
  'aria-owns': string
  /**
   * Takes the element out of the layout without hiding it from assistive
   * technology, which `display: none` or `hidden` would.
   */
  style: TagListboxStyle
}

/** The style that keeps the accessible listbox out of the layout. */
export interface TagListboxStyle {
  position: 'fixed'
}

/** Props to spread on the label of the tag input. */
export interface TagLabelProps {
  id: string
  /**
   * Labels the input element. The DOM property name, so it works both as a
   * React prop and as a property assignment.
   */
  htmlFor: string
  /** Assigns the model's `labelElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/** Props to spread on the text input that adds tags. */
export interface TagInputProps {
  /** The input id, which the label points at and which is a composite item id. */
  id: string
  /** The controlled text value. */
  value: string
  'data-active-item': true | undefined
  /**
   * `undefined` — no attribute — while the input is `tabbable`, which is
   * Ariakit's default for `TagInput`: the input is exempt from the roving
   * tabindex, so `Tab` always reaches the field the user types in.
   */
  tabIndex: number | undefined
  /**
   * Assigns the model's `inputElement` **and** registers the input as a
   * rendered composite item, because the element being in the DOM is exactly
   * what that registration means. Pass `null` on unmount.
   */
  ref: (element: HTMLElement | null) => void
  /** Focusing the input makes it the active item. */
  onFocus: (event: TagTargetedEvent) => void
  /**
   * `Backspace` at the start of the value removes the last tag; the arrow keys
   * navigate the tags, but only from the edge of the value the caret is at.
   */
  onKeyDown: (event: TagKeyboardEvent) => void
  /**
   * Stores the typed value, and turns the part before a delimiter into tags.
   *
   * @remarks
   *   Ariakit's `onChange`, renamed to the event it actually needs. React's
   *   `onChange` on a text field _is_ the DOM `input` event — it fires on every
   *   keystroke — while the DOM's own `change` event only fires on blur, which
   *   would add a tag long after the user typed the delimiter. `onInput` is the
   *   one spelling that binds correctly in both worlds.
   */
  onInput: (event: TagInputEvent) => void
  /** Turns pasted text into tags, split by the delimiter. */
  onPaste: (event: TagClipboardEvent) => void
}

/** Props to spread on one tag element. */
export interface TagItemProps {
  id: string
  /**
   * `option` inside the accessible listbox, or `listitem` on a touch device —
   * see {@link TagModel.touch}.
   */
  role: 'option' | 'listitem'
  'data-active-item': true | undefined
  /** `-1` for every tag but the active one — the roving tabindex. */
  tabIndex: number | undefined
  /**
   * Points at the remove button, whose label tells the user which keys remove
   * the tag. `undefined` when the tag has no remove button, see
   * {@link TagItemPropsOptions.describeRemove}.
   */
  'aria-describedby': string | undefined
  /**
   * Assigns the tag element and registers it as a rendered composite item; pass
   * `null` on unmount.
   */
  ref: (element: HTMLElement | null) => void
  /** Focusing a tag makes it the active item. */
  onFocus: (event: TagTargetedEvent) => void
  /**
   * `Backspace` / `Delete` remove the tag, a printable key or the paste
   * shortcut hands the key to the input, and the arrow keys navigate.
   */
  onKeyDown: (event: TagKeyboardEvent) => void
}

/** Props to spread on the remove button of one tag. */
export interface TagRemoveProps {
  id: string
  /**
   * A real `button` on a touch device, where pressing keys is not an option;
   * decorative otherwise, because a button inside an `option` is not reachable
   * anyway.
   */
  role: 'button' | undefined
  /** Hidden from assistive technology while it is decorative. */
  'aria-hidden': true | undefined
  /**
   * `Remove <value>` on a touch device, where the button is the only way to
   * remove a tag; the keyboard hint otherwise, announced through the tag's
   * `aria-describedby`.
   */
  'aria-label': string | undefined
  /** Keeps a real button from submitting the form it sits in. */
  type: 'button' | undefined
  /** Removes the tag and returns focus to the input. */
  onClick: (event?: TagPropsEvent) => void
}

/** Options of {@link tagProps} and {@link withTagProps}. */
export interface TagPropsOptions extends CompositePropsOptions {
  /**
   * What breaks the typed or pasted text into several tags, see
   * {@link TagDelimiter}.
   *
   * @default ['\n', ';', ',', /\s/]
   */
  delimiter?: TagDelimiter
  /**
   * An accessible name for the listbox, as `aria-label`. Takes precedence over
   * the label element, matching Ariakit's `aria-label != null ? undefined :
   * labelId`.
   */
  label?: string
  /**
   * Whether typing a delimiter adds the text before it as a tag. Ariakit's
   * name; the event is {@link TagInputProps.onInput}.
   *
   * @default true
   */
  addValueOnChange?: boolean
  /**
   * Whether pasting text adds tags.
   *
   * @default true
   */
  addValueOnPaste?: boolean
  /**
   * Whether the typed text is stored in the model's `value`. Turn it off to
   * derive the value yourself — the tag splitting keeps working.
   *
   * @default true
   */
  setValueOnChange?: boolean
  /**
   * Whether `Backspace` at the start of the input removes the last tag.
   *
   * @default true
   */
  removeOnBackspace?: boolean
  /**
   * Whether the input is exempt from the roving tabindex, i.e. always in the
   * tab order — Ariakit's `tabbable` default for `TagInput`.
   *
   * @default true
   */
  tabbable?: boolean
  /**
   * The composite records the tag ones build on. Defaults to a fresh
   * {@link compositeProps}; pass the records a model already carries to reuse
   * their handlers instead of allocating a second set.
   */
  composite?: CompositePropRecords
}

/** Options of the {@link TagPropRecords.tag} record. */
export interface TagItemPropsOptions {
  /**
   * Whether `Backspace` and `Delete` remove the tag while it is focused.
   *
   * @default true
   */
  removeOnKeyPress?: boolean
  /**
   * Whether the tag is described by its remove button, i.e. whether the tag
   * renders one.
   *
   * @default true
   */
  describeRemove?: boolean
  /** The record name. Defaults to `${model}.props.tag#${value}`. */
  name?: string
}

/** Options of the {@link TagPropRecords.remove} record. */
export interface TagRemovePropsOptions {
  /**
   * The accessible name of the button on a touch device.
   *
   * @default value => `Remove ${value}`
   */
  removeLabel?: (value: string) => string
  /**
   * The keyboard hint announced through the tag's `aria-describedby`.
   *
   * @default 'Press Delete or Backspace to remove'
   */
  hint?: string
  /** The record name. Defaults to `${model}.props.remove#${value}`. */
  name?: string
}

/** Reactive prop records of a tag model. */
export interface TagPropRecords extends CompositePropRecords {
  /**
   * Props for the tag list element — the same record as
   * {@link TagPropRecords.list}.
   */
  base: Computed<TagListProps>
  /** Props for the tag list element, named after Ariakit's `TagList`. */
  list: Computed<TagListProps>
  /** Props for the visually hidden listbox that owns the tags. */
  listbox: Computed<TagListboxProps>
  /** Props for the label of the input. */
  label: Computed<TagLabelProps>
  /** Props for the text input. */
  input: Computed<TagInputProps>
  /**
   * Props for the element of one tag value. The record is memoized per value,
   * so repeated calls keep the same identity; passing options returns a fresh,
   * uncached record.
   */
  tag: (value: string, options?: TagItemPropsOptions) => Computed<TagItemProps>
  /** Props for the remove button of one tag value, memoized the same way. */
  remove: (
    value: string,
    options?: TagRemovePropsOptions,
  ) => Computed<TagRemoveProps>
}

/** The model {@link withTagProps} upgrades: a tag model with composite records. */
export interface TagPropsTarget extends TagModel {
  props: CompositePropRecords
}

const LISTBOX_STYLE: TagListboxStyle = { position: 'fixed' }

const REMOVE_HINT = 'Press Delete or Backspace to remove'

/**
 * Builds the reactive prop records of a tag model.
 *
 * @remarks
 *   Each record is a `computed` returning a plain object, so it is memoized,
 *   lazy, traceable by name, and neutral about the view library: React spreads
 *   it, `@reatom/jsx` `$spread`s it, Vue `v-bind`s it. Handlers are created
 *   once and `wrap`ped, which re-enters the Reatom frame so the logger
 *   attributes the state change to the DOM event, and they `notify()` so a host
 *   framework sees the update in the same tick — the `bindField` precedent.
 *
 *   Both element records are keyed by **tag value** rather than by composite item
 *   node, because `values` is the source of truth of the widget: the record
 *   allocates the item id from the value ({@link TagModel.tagId}) and registers
 *   the item from its own `ref`. The `item(node)` record inherited from
 *   `composite` stays available for an item that is neither a tag nor the
 *   input.
 *
 *   Consequently the two item handlers of `compositeItemProps` are re-implemented
 *   here instead of wrapped: they need the node, which does not exist before
 *   the element is mounted. Both are three lines over the same
 *   {@link mapNavigationIntent}.
 *
 *   Two Ariakit behaviors are deliberately absent. `TagList` binds `Cmd+Z` /
 *   `Cmd+Shift+Z` to a global `UndoManager`, which is not ported (see
 *   `withTag`). `Tag` renders its value as `children` and `TagRemove` renders
 *   an icon, which are view concerns.
 * @example
 *   const props = tagProps(tag)
 *   props.listbox() // { role: 'listbox', 'aria-owns': '', ... }
 *   props.tag('react')() // { id: 'tag-tag-1', role: 'option', ... }
 */
export const tagProps = (
  model: TagModel,
  options: TagPropsOptions = {},
): TagPropRecords => {
  const {
    delimiter,
    label,
    addValueOnChange = true,
    addValueOnPaste = true,
    setValueOnChange = true,
    removeOnBackspace = true,
    tabbable = true,
    name = model.name,
    composite = compositeProps(model, { name }),
  } = options
  // Captured as a unit, not read back through the record object: `base` is the
  // key `withTagProps` replaces, and reading it through the object would make
  // the wrapper wrap itself.
  const compositeBase = composite.base

  const onMouseDown = wrap((event: TagTargetedEvent) => {
    if (event.defaultPrevented) return
    const currentTarget = event.currentTarget as HTMLElement | null
    if (!currentTarget) return

    // A click that landed on something focusable inside the list belongs to
    // that element — a tag, or a remove button on a touch device.
    const focusable = getClosestFocusable(event.target as Element | null)
    if (
      focusable &&
      focusable !== currentTarget &&
      currentTarget.contains(focusable)
    ) {
      return
    }

    const input = model.inputElement()
    if (!input) return

    // Focusing during `mousedown` would be undone by the browser's own focus
    // handling for the same event, so the focus waits for `mouseup`.
    queueBeforeEvent(currentTarget, 'mouseup', () => input.focus())
  })

  const labelRef = wrap((element: HTMLElement | null) => {
    model.labelElement.set(element)
  })

  const inputRef = wrap((element: HTMLElement | null) => {
    model.inputElement.set(element)
    if (element) model.renderInput({ element })
    else model.unrenderInput()
  })

  const onInputFocus = wrap((event: TagTargetedEvent) => {
    if (event.defaultPrevented) return
    if (!isSelfTarget(event)) return
    model.set(model.inputId())
    notify()
  })

  const onInputKeyDown = wrap((event: TagKeyboardEvent) => {
    if (event.defaultPrevented) return
    if (!isSelfTarget(event)) return

    const caret = readTagInput(event.currentTarget)

    if (removeOnBackspace && isTagRemoveLastKey(event, caret)) {
      // No `preventDefault`: `Backspace` has nothing to delete in the text
      // anyway, and leaving the event alone lets a combobox react to it too.
      model.removeLastValue()
      notify()
      return
    }

    const orientation = model.orientation()
    if (!canTagInputNavigate(event, { ...caret, orientation })) return

    const intent = mapNavigationIntent(event, { orientation })
    if (!intent) return

    if (model.navigate(intent) !== undefined) event.preventDefault?.()
    notify()
  })

  const onInput = wrap((event: TagInputEvent) => {
    if (event.defaultPrevented) return

    const element = event.currentTarget
    const { value, selectionStart, selectionEnd } = readTagInput(element)

    if (setValueOnChange) {
      model.value.set(value)
      // The value reaches the element through the view, i.e. after this
      // handler, and re-assigning `value` moves the caret to the end.
      queueMicrotask(
        wrap(() => setTagInputCaret(element, selectionStart, selectionEnd)),
      )
    }

    // An IME may emit delimiter characters while the user is still composing.
    // Keep the controlled value current, but wait for the final input event
    // before turning any part of it into tags.
    if (event.isComposing || event.nativeEvent?.isComposing) {
      notify()
      return
    }

    const intent = mapTagChangeIntent({
      value,
      selectionStart,
      selectionEnd,
      delimiter,
    })

    if (intent && addValueOnChange) {
      // Ariakit prevents the default here so that a component sharing the same
      // event — a combobox rendered as the tag input — cannot overwrite the
      // value the tag layer just set, whichever handler ran first.
      event.preventDefault?.()
      for (const added of intent.values) model.addValue(added)
      model.value.set(intent.value)
    }

    notify()
  })

  const onPaste = wrap((event: TagClipboardEvent) => {
    if (event.defaultPrevented) return
    if (!addValueOnPaste) return

    const values = parseTagValues(
      event.clipboardData?.getData('text') ?? '',
      delimiter,
    )
    if (!values.length) return

    // The text became tags, so it must not also be inserted into the input.
    event.preventDefault?.()
    for (const value of values) model.addValue(value)
    notify()
  })

  const list = computed(
    (): TagListProps => ({ ...compositeBase(), onMouseDown }),
    `${name}.props.list`,
  )

  const tagRecords = new Map<string, Computed<TagItemProps>>()
  const removeRecords = new Map<string, Computed<TagRemoveProps>>()

  const tagRecord = (
    value: string,
    itemOptions: TagItemPropsOptions = {},
  ): Computed<TagItemProps> => {
    const id = model.tagId(value)
    const {
      removeOnKeyPress = true,
      describeRemove = true,
      // `#value` and not `#id`: the logger reads better with the tag the user
      // sees, and it is the collection's own `items#id` convention.
      name: recordName = `${name}.props.tag#${value}`,
    } = itemOptions

    const ref = wrap((element: HTMLElement | null) => {
      if (element) model.renderTag(value, { element })
      else model.unrenderTag(value)
    })

    const onFocus = wrap((event: TagTargetedEvent) => {
      if (event.defaultPrevented) return
      // A tag contains its remove button, whose focus event bubbles through it.
      if (!isSelfTarget(event)) return
      model.set(id)
      notify()
    })

    const onKeyDown = wrap((event: TagKeyboardEvent) => {
      if (event.defaultPrevented) return
      if (!isSelfTarget(event)) return

      const intent = mapTagKeyIntent(event, {
        apple: isApple(),
        removeOnKeyPress,
      })

      if (intent?.type === 'remove') {
        event.preventDefault?.()
        model.removeTag(value, intent.move)
        notify()
        return
      }

      if (intent?.type === 'focusInput') {
        // Deliberately no `preventDefault`: focus moves synchronously, so the
        // character the user pressed is inserted into the input that just
        // received it. That is the whole trick of "start typing anywhere".
        model.inputElement()?.focus()
        notify()
        return
      }

      const navigation = mapNavigationIntent(event, {
        orientation: model.orientation(),
      })
      if (!navigation) return

      if (model.navigate(navigation) !== undefined) event.preventDefault?.()
      notify()
    })

    return computed((): TagItemProps => {
      const item = model.items.item(id)

      return {
        id,
        role: model.touch() ? 'listitem' : 'option',
        'data-active-item': model() === id || undefined,
        // An unregistered tag keeps its natural tab stop, which is the
        // composite's own fallback for an item it does not know yet.
        tabIndex: item && !item.tabbable() ? -1 : undefined,
        'aria-describedby': describeRemove ? tagRemoveElementId(id) : undefined,
        ref,
        onFocus,
        onKeyDown,
      }
    }, recordName)
  }

  const removeRecord = (
    value: string,
    removeOptions: TagRemovePropsOptions = {},
  ): Computed<TagRemoveProps> => {
    const id = tagRemoveElementId(model.tagId(value))
    const {
      removeLabel = (value) => `Remove ${value}`,
      hint = REMOVE_HINT,
      name: recordName = `${name}.props.remove#${value}`,
    } = removeOptions

    const onClick = wrap((event: TagPropsEvent = {}) => {
      if (event.defaultPrevented) return
      model.removeValue(value)
      // Ariakit focuses the input, which activates it through the input's own
      // focus handler. The move is explicit here so that the active item is
      // right in a headless flow too, and focusing the same element twice is a
      // no-op.
      model.moveToInput()
      model.inputElement()?.focus()
      notify()
    })

    return computed((): TagRemoveProps => {
      const touch = model.touch()

      return {
        id,
        role: touch ? 'button' : undefined,
        'aria-hidden': touch ? undefined : true,
        'aria-label': touch ? removeLabel(value) : hint,
        type: touch ? 'button' : undefined,
        onClick,
      }
    }, recordName)
  }

  return {
    ...composite,

    base: list,
    list,

    listbox: computed((): TagListboxProps => {
      // Ariakit reads the id off the label element (`labelElement?.id`), so a
      // list with no label emits no `aria-labelledby` — a dangling reference
      // would be worse than none.
      const labelled = model.labelElement() ? model.labelId() : undefined

      return {
        role: model.touch() ? 'list' : 'listbox',
        'aria-live': 'polite',
        'aria-relevant': 'all',
        'aria-atomic': true,
        'aria-label': label,
        'aria-labelledby': label == null ? labelled : undefined,
        'aria-orientation': tagAriaOrientation(model.orientation()),
        'aria-owns': model.tagIds().join(' '),
        style: LISTBOX_STYLE,
      }
    }, `${name}.props.listbox`),

    label: computed(
      (): TagLabelProps => ({
        id: model.labelId(),
        htmlFor: model.inputId(),
        ref: labelRef,
      }),
      `${name}.props.label`,
    ),

    input: computed((): TagInputProps => {
      const id = model.inputId()
      const item = model.inputItem()

      return {
        id,
        value: model.value(),
        'data-active-item': model() === id || undefined,
        tabIndex: !tabbable && item && !item.tabbable() ? -1 : undefined,
        ref: inputRef,
        onFocus: onInputFocus,
        onKeyDown: onInputKeyDown,
        onInput,
        onPaste,
      }
    }, `${name}.props.input`),

    tag: (value, itemOptions) => {
      if (itemOptions) return tagRecord(value, itemOptions)

      let record = tagRecords.get(value)
      if (!record) tagRecords.set(value, (record = tagRecord(value)))
      return record
    },

    remove: (value, removeOptions) => {
      if (removeOptions) return removeRecord(value, removeOptions)

      let record = removeRecords.get(value)
      if (!record) removeRecords.set(value, (record = removeRecord(value)))
      return record
    },
  }
}

/**
 * Attaches {@link tagProps} to a tag model as `model.props`.
 *
 * {@link reatomTag} applies it already; use it explicitly to turn a
 * hand-composed `reatomComposite().extend(withTag())` into a tag widget.
 *
 * @remarks
 *   The composite records the target already carries are upgraded **in place**:
 *   `extend` refuses to replace an existing member with a different value, and
 *   the tag's `base` is a wrapper around the composite's, not a substitute for
 *   it — so returning the very same object is both the cheapest and the only
 *   way to express "the same records, with the tag layer on top".
 */
export const withTagProps = (
  options: TagPropsOptions = {},
): AssignerExt<{ props: TagPropRecords }, TagPropsTarget> => {
  return (target) => ({
    props: Object.assign(
      target.props,
      // `??` and not a spread default: an explicitly passed `composite:
      // undefined` must still mean "the records the target already has".
      tagProps(target, {
        ...options,
        composite: options.composite ?? target.props,
      }),
    ),
  })
}
