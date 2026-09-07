/**
 * Layer 1 for `tag`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/tag/tag-store.ts`, plus the transitions
 * Ariakit keeps in `packages/ariakit-react-components/src/tag/*.tsx`.
 */

import type { Action, AssignerExt, Atom, Computed } from '@reatom/core'
import { action, atom, computed, named, peek, ReatomError } from '@reatom/core'

import type {
  CompositeItemInit,
  CompositeItemNode,
  CompositeModel,
  CompositeOptions,
} from '../composite/reatomComposite'
import {
  compositeElementId,
  reatomComposite,
} from '../composite/reatomComposite'
import type { TagPropRecords, TagPropsOptions } from './props'
import { withTagProps } from './props'
import { addTagValue, removeTagValue } from './tagIntent'

/** Options accepted by both {@link reatomTag} and {@link withTag}. */
export interface TagExtOptions {
  /**
   * Initial value of the tag input — the text the user is typing, not the tags.
   *
   * @default ''
   */
  value?: string
  /**
   * Adopt a caller-owned atom for the input value instead of creating one.
   *
   * @remarks
   *   Unlike `reatomCheckbox`, the adopted atom needs no proxy: the tag model
   *   only reads and writes it, so it is never `extend`ed and stays the single
   *   source of truth. That is what "controlled" means here.
   */
  valueAtom?: Atom<string>
  /**
   * Initially selected tag values.
   *
   * @default [ ]
   */
  values?: Array<string>
  /**
   * Adopt a caller-owned atom for the tag values — a `reatomField`, a route
   * search param, or the atom of another widget.
   *
   * @remarks
   *   Note that a plain array in `reatomForm`'s init state becomes a
   *   `FieldArrayAtom`, which models a list of _fields_ rather than a list of
   *   strings; pass an explicit `reatomField<Array<string>>` for a tag field.
   * @example
   *   const form = reatomForm(
   *     { invitees: reatomField<Array<string>>([], 'form.fields.invitees') },
   *     'form',
   *   )
   *   const tag = reatomTag({ valuesAtom: form.fields.invitees })
   */
  valuesAtom?: Atom<Array<string>>
  /**
   * The DOM `id` of the input element, which is also its composite item id.
   * Defaults to `${compositeElementId(name)}-input`.
   *
   * @remarks
   *   Ariakit reads the id off the input element (`inputElement.id`, filled in by
   *   a `useId`), which makes it unknowable before the element exists. Owning
   *   it in the model instead is what lets the input be the default active item
   *   from the start, and keeps the markup stable between the server and the
   *   client.
   */
  inputId?: string
  /**
   * The DOM `id` of the label element. Defaults to
   * `${compositeElementId(name)}-label`.
   */
  labelId?: string
  /**
   * Whether the widget is used with a touch screen, where the tags are a plain
   * list rather than a listbox of options — see {@link TagUnits.touch}.
   *
   * @default false
   */
  touch?: boolean
}

/**
 * Options of the {@link reatomTag} factory.
 *
 * Everything {@link reatomComposite}, {@link withTag}, and `tagProps` accept,
 * minus the composite prop records: the factory builds those itself.
 */
export interface TagOptions
  extends CompositeOptions, TagExtOptions, Omit<TagPropsOptions, 'composite'> {}

/** Units {@link withTag} adds on top of the composite ones. */
export interface TagUnits {
  /**
   * The value of the tag input: the text being typed, which becomes a tag once
   * it is followed by a delimiter.
   */
  value: Atom<string>
  /**
   * The selected tag values, in order — the state a form field binds to.
   *
   * Write it directly for a bulk change (Ariakit's `setValues`); use
   * {@link TagUnits.addValue} and {@link TagUnits.removeValue} for a single tag,
   * because they are guarded against duplicates and report what they did.
   */
  values: Atom<Array<string>>
  /** The DOM `id` of the input element, and the id of its composite item. */
  inputId: Atom<string>
  /** The DOM `id` of the label element. */
  labelId: Atom<string>
  /** The input element handle, assigned from the `input` record's `ref`. */
  inputElement: Atom<HTMLElement | null>
  /** The label element handle, assigned from the `label` record's `ref`. */
  labelElement: Atom<HTMLElement | null>
  /**
   * Whether the widget is used with a touch screen.
   *
   * @remarks
   *   A screen reader on a touch device cannot move a virtual cursor into a
   *   `listbox` of `option`s, so Ariakit downgrades the roles to `list` /
   *   `listitem` and turns the decorative remove button into a real one. It
   *   detects the device in an effect so that the server-rendered markup is the
   *   pointer one; here the atom starts `false` for the same reason and
   *   `withTagTouch()` (Layer 2) fills it in.
   */
  touch: Atom<boolean>
  /**
   * The composite item of the input, `null` until the input element is
   * registered.
   */
  inputItem: Computed<CompositeItemNode | null>
  /**
   * The rendered tag items, in order — the rendered composite items that stand
   * for a tag value, so neither the input nor any other item of the list.
   *
   * Ariakit gets the same list by adding a `value` field to its composite items
   * and filtering on it; the id registry behind {@link TagUnits.tagId} makes it
   * a derivation instead.
   */
  tagItems: Computed<Array<CompositeItemNode>>
  /**
   * Ids of the rendered tag items — the `aria-owns` list of the accessible
   * listbox element.
   */
  tagIds: Computed<Array<string>>
  /**
   * The DOM `id` of the element of a tag value, allocated on first use and
   * stable for the lifetime of the model, so removing and re-adding a tag
   * reuses its id.
   *
   * @remarks
   *   A tag value is arbitrary text — Ariakit's own example adds `"abc def"` —
   *   and would be an invalid `id`, so the ids are generated instead of
   *   derived. The allocation order is the render order, which keeps hydration
   *   stable.
   */
  tagId: (value: string) => string
  /**
   * The tag value an item id stands for, `undefined` for the input, an unknown
   * id, or a nullish one. Never throws: unknown ids are normal during
   * mount/unmount races.
   */
  tagValue: (id?: string | null) => string | undefined
  /** The composite item of a tag value, `null` while it is not registered. */
  tagItem: (value: string) => CompositeItemNode | null
  /**
   * Registers the element of a tag value as a rendered composite item, so it
   * becomes navigable. `props.tag(value)` calls it from its `ref`.
   */
  renderTag: Action<
    [value: string, init?: CompositeItemInit],
    CompositeItemNode
  >
  /** Undoes one {@link TagUnits.renderTag}. */
  unrenderTag: Action<[value: string], boolean>
  /**
   * Registers the input element as a rendered composite item. `props.input`
   * calls it from its `ref`.
   */
  renderInput: Action<[init?: CompositeItemInit], CompositeItemNode>
  /** Undoes one {@link TagUnits.renderInput}. */
  unrenderInput: Action<[], boolean>
  /** Adds a tag value unless it is already there; returns whether it was added. */
  addValue: Action<[value: string], boolean>
  /** Removes a tag value; returns whether it was there. */
  removeValue: Action<[value: string], boolean>
  /**
   * Removes the last tag value and returns it, or `undefined` when there is
   * none — the `Backspace` transition of the input.
   */
  removeLastValue: Action<[], string | undefined>
  /**
   * Removes a tag and moves the active item to a neighbour, which is what
   * pressing `Backspace` or `Delete` on a tag does.
   *
   * @remarks
   *   The move is resolved _after_ the removal but while the removed tag is still
   *   rendered, exactly as in Ariakit: its neighbours are only knowable while
   *   it is still in the list. The view unrenders the item afterwards, when it
   *   unmounts the element.
   *
   *   `'previous'` falls back to the next tag when the removed one was the first,
   *   so `Backspace` on the first tag lands on the second — Ariakit's
   *   `previous() || next()`.
   */
  removeTag: Action<
    [value: string, direction?: 'previous' | 'next'],
    string | null | undefined
  >
  /**
   * Moves the active item to the input, as a focus move — Ariakit's
   * `composite.move(inputElement?.id)`.
   */
  moveToInput: Action<[], void>
}

/**
 * A tag model: a {@link CompositeModel} — reading it reads the active item id —
 * extended with the tag input value, the tag values, and the transitions
 * between them.
 */
export interface TagModel extends CompositeModel, TagUnits {}

/**
 * The model returned by {@link reatomTag}: a {@link TagModel} plus the prop
 * records.
 */
export interface Tag extends TagModel {
  /** Reactive prop records for the tag list and its elements. */
  props: TagPropRecords
}

/**
 * Adds the tag behavior to an existing composite model.
 *
 * @remarks
 *   Ariakit's `createTagStore` is `createStore(tagState, createCompositeStore())`
 *   — a tag list _is_ a composite whose items are the tags plus the input — so
 *   this extension is the same composition: the composite owns navigation and
 *   the roving tabindex, and the tag layer owns the text and the values.
 *
 *   Two Ariakit mechanics change shape:
 *
 *   - `setValues` / `setValue` / `setInputElement` / `setLabelElement` are gone:
 *       write the atoms. Only the guarded transitions stay as actions.
 *   - The `setup` + `sync` listener that makes the input the default active element
 *       becomes a single silent write here, see below.
 *
 *   **The input is the default active element.** Ariakit seeds `activeId` from a
 *   listener on `inputElement`, which in React wins over the composite's own
 *   "first rendered item" seed because refs are assigned before the effects
 *   that register the items. That ordering is a React detail, not a contract,
 *   so the seed is explicit here: the active id starts at `inputId`, which is
 *   why `Tab` enters the widget at the input even when tags are rendered before
 *   it. It is a plain write, not a `move`, so nothing steals focus on mount.
 *   Pass `activeId` to opt out.
 *
 *   Undo and redo are **not** ported. Ariakit routes `setValues` through a global
 *   `UndoManager` and binds `Cmd+Z` in `TagList`; a shared undo stack is a
 *   cross-cutting concern rather than tag behavior, and every transition here
 *   is a named action over one `values` atom, which is all an undo layer
 *   needs.
 * @example
 *   // a tag list whose values live in a form field
 *   const invitees = reatomField<Array<string>>([], 'invitees')
 *   const tag = reatomComposite({ name: 'invitees' }).extend(
 *     withTag({ valuesAtom: invitees }),
 *     withTagProps(),
 *   )
 *
 * @see {@link reatomTag} for the batteries-included factory.
 */
export const withTag = (
  options: TagExtOptions = {},
): AssignerExt<TagUnits, CompositeModel> => {
  const {
    value: initValue = '',
    valueAtom,
    values: initValues,
    valuesAtom,
    inputId: initInputId,
    labelId: initLabelId,
    touch: initTouch = false,
  } = options

  return (target) => {
    const { name } = target

    if (valueAtom && options.value !== undefined) {
      throw new ReatomError(`${name}: pass either "value" or "valueAtom"`)
    }
    if (valuesAtom && initValues !== undefined) {
      throw new ReatomError(`${name}: pass either "values" or "valuesAtom"`)
    }

    const elementId = compositeElementId(name)

    const value = valueAtom ?? atom(initValue, `${name}.value`)
    const values = valuesAtom ?? atom(initValues ?? [], `${name}.values`)
    const inputId = atom(initInputId ?? `${elementId}-input`, `${name}.inputId`)
    const labelId = atom(initLabelId ?? `${elementId}-label`, `${name}.labelId`)
    const inputElement = atom<HTMLElement | null>(null, `${name}.inputElement`)
    const labelElement = atom<HTMLElement | null>(null, `${name}.labelElement`)
    const touch = atom(initTouch, `${name}.touch`)

    // The value <-> item id registry. Plain maps, not atoms: an id never
    // changes once allocated, and the reactive part — which of those items is
    // registered and rendered — belongs to the composite collection.
    const idsByValue = new Map<string, string>()
    const valuesById = new Map<string, string>()
    let idSeed = 0

    const tagId = (value: string): string => {
      let id = idsByValue.get(value)
      if (id === undefined) {
        id = `${elementId}-tag-${++idSeed}`
        idsByValue.set(value, id)
        valuesById.set(id, value)
      }
      return id
    }

    const tagValue = (id?: string | null): string | undefined =>
      id == null ? undefined : valuesById.get(id)

    const tagItem = (value: string): CompositeItemNode | null => {
      const id = idsByValue.get(value)
      return id === undefined ? null : target.items.item(id)
    }

    const inputItem = computed(
      () => target.items.item(inputId()),
      `${name}.inputItem`,
    )

    const tagItems = computed(
      () =>
        target.items.renderedItems().filter((item) => valuesById.has(item.id)),
      `${name}.tagItems`,
    )

    const tagIds = computed(
      () => tagItems().map((item) => item.id),
      `${name}.tagIds`,
    )

    const renderTag = action(
      (value: string, init?: CompositeItemInit): CompositeItemNode =>
        // The text is the tag value, which is what a composite typeahead would
        // match on — Ariakit's collection reads the same string out of the
        // element's `textContent`.
        target.items.renderItem({ text: value, ...init, id: tagId(value) }),
      `${name}.renderTag`,
    )

    const unrenderTag = action((value: string): boolean => {
      const id = idsByValue.get(value)
      return id === undefined ? false : target.items.unrenderItem(id)
    }, `${name}.unrenderTag`)

    const renderInput = action(
      (init?: CompositeItemInit): CompositeItemNode =>
        target.items.renderItem({ ...init, id: inputId() }),
      `${name}.renderInput`,
    )

    const unrenderInput = action(
      (): boolean => target.items.unrenderItem(inputId()),
      `${name}.unrenderInput`,
    )

    const addValue = action((value: string): boolean => {
      const previous = values()
      const next = addTagValue(previous, value)
      if (next === previous) return false
      values.set(next)
      return true
    }, `${name}.addValue`)

    const removeValue = action((value: string): boolean => {
      const previous = values()
      const next = removeTagValue(previous, value)
      if (next === previous) return false
      values.set(next)
      return true
    }, `${name}.removeValue`)

    const removeLastValue = action((): string | undefined => {
      const previous = values()
      const last = previous[previous.length - 1]
      if (last === undefined) return undefined
      values.set(previous.slice(0, -1))
      return last
    }, `${name}.removeLastValue`)

    const moveToInput = action(
      (): void => target.move(inputId()),
      `${name}.moveToInput`,
    )

    const removeTag = action(
      (
        value: string,
        direction: 'previous' | 'next' = 'next',
      ): string | null | undefined => {
        removeValue(value)
        const neighbour =
          direction === 'previous'
            ? // `||` and not `??`: the composite element (`null`) is not a place
              // to leave focus after a removal either.
              target.previous() || target.next()
            : target.next()
        target.move(neighbour)
        return neighbour
      },
      `${name}.removeTag`,
    )

    // The input is the default active element. `peek` instead of a read keeps
    // the seed out of anybody's dependencies, and a plain write instead of
    // `move` keeps it silent, so `withCompositeFocus()` does not focus the
    // input on mount.
    if (peek(target) === undefined) target.set(peek(inputId))

    return {
      value,
      values,
      inputId,
      labelId,
      inputElement,
      labelElement,
      touch,
      inputItem,
      tagItems,
      tagIds,
      tagId,
      tagValue,
      tagItem,
      renderTag,
      unrenderTag,
      renderInput,
      unrenderInput,
      addValue,
      removeValue,
      removeLastValue,
      removeTag,
      moveToInput,
    }
  }
}

/**
 * Creates a tag model: a composite whose items are the selected tags plus the
 * text input that adds them, with the delimiter, remove, and navigation
 * transitions a tag input needs.
 *
 * @remarks
 *   Ported from Ariakit's `createTagStore` and the behavior its `Tag*` components
 *   carry ([`props.ts`](./props.ts), [`tagIntent.ts`](./tagIntent.ts)). See
 *   {@link withTag} for the mapping decisions, including why the input is the
 *   default active item and why undo is out of scope.
 *
 *   The tags are keyed by **value**: `values` is the source of truth, and the
 *   composite item id of a tag is allocated from its value by
 *   {@link TagUnits.tagId}. That is what replaces the `value` field Ariakit adds
 *   to its composite items, which a model outside `reatomComposite` cannot
 *   add.
 * @example
 *   const tag = reatomTag({ values: ['react'], name: 'invitees' })
 *
 *   tag.addValue('jsx') // true
 *   tag.addValue('jsx') // false — already there
 *   tag() // 'invitees-input' — the input is the default active item
 *
 *   // the view registers the elements, usually through the prop records
 *   tag.renderTag('react')
 *   tag.renderTag('jsx')
 *   tag.renderInput()
 *
 *   tag.first() // the 'react' item id
 *   tag.last() // 'invitees-input'
 *   tag.removeTag('jsx', 'previous') // moves to the 'react' item
 *   tag.values() // ['react']
 *
 * @example
 *   // @reatom/jsx — every record is keyed by the tag value
 *   ;<label $spread={tag.props.label}>Invitees</label>
 *   <div $spread={tag.props.list}>
 *   <div $spread={tag.props.listbox} />
 *   {list(tag.values, (value) => (
 *   <span $spread={tag.props.tag(value())}>
 *   {value}
 *   <span $spread={tag.props.remove(value())} />
 *   </span>
 *   ))}
 *   <input $spread={tag.props.input} />
 *   </div>
 *
 * @see https://ariakit.com/components/tag
 */
export const reatomTag = (options: TagOptions = {}): Tag => {
  const {
    value,
    valueAtom,
    values,
    valuesAtom,
    inputId,
    labelId,
    touch,

    delimiter,
    label,
    addValueOnChange,
    addValueOnPaste,
    setValueOnChange,
    removeOnBackspace,
    tabbable,

    name = named('tag'),
    ...compositeOptions
  } = options

  return reatomComposite({ ...compositeOptions, name }).extend(
    withTag({
      value,
      valueAtom,
      values,
      valuesAtom,
      inputId,
      labelId,
      touch,
    }),
    withTagProps({
      delimiter,
      label,
      addValueOnChange,
      addValueOnPaste,
      setValueOnChange,
      removeOnBackspace,
      tabbable,
    }),
  ) as Tag
}
