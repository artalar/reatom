/**
 * Layer 1 text and keyboard policy for `tag`: how typed text, pasted text, and
 * key presses turn into tag values, as pure functions of plain data.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tag/tag-input.tsx` (the delimiter
 * splitting, the change and paste transitions, the Backspace rule, and the
 * caret guard it inherits from
 * `packages/ariakit-react-components/src/composite/composite-item.tsx`) and
 * `packages/ariakit-react-components/src/tag/tag.tsx` (the remove keys and the
 * "typing on a tag types in the input" rule).
 *
 * Ariakit inlines all of it in event handlers, so the delimiter matrix can only
 * be exercised by typing into a rendered input. Splitting it out keeps the DOM
 * out of the decision: the prop records read the event, these functions decide
 * what it means, and the model applies it.
 */

import type { CompositeOrientation } from '../composite/getNextId'

/**
 * What breaks the input value into several tags.
 *
 * A string, a regular expression, an array of either — the value is split by
 * the **first** matching entry, so `['\n', ',']` pasted with both characters
 * splits by newlines only and keeps the commas inside the values — or `null` to
 * never split.
 */
export type TagDelimiter =
  | string
  | RegExp
  | ReadonlyArray<string | RegExp>
  | null

/**
 * The default delimiters: a newline, a semicolon, a comma, and any whitespace —
 * Ariakit's `DEFAULT_DELIMITER`.
 */
export const TAG_DELIMITERS: ReadonlyArray<string | RegExp> = [
  '\n',
  ';',
  ',',
  /\s/,
]

/**
 * Normalizes a {@link TagDelimiter} option into the list the splitter walks.
 *
 * @remarks
 *   Port of Ariakit's `getDelimiters`. `undefined` means "not configured" and
 *   falls back to `fallback`, while `null` and an empty array both mean "never
 *   split" — that difference is what lets a component default differ from the
 *   library default.
 * @example
 *   getTagDelimiters(undefined) // ['\n', ';', ',', /\s/]
 *   getTagDelimiters(',') // [',']
 *   getTagDelimiters(null) // []
 */
export const getTagDelimiters = (
  delimiter?: TagDelimiter,
  fallback: TagDelimiter = TAG_DELIMITERS,
): Array<string | RegExp> => {
  const final = delimiter === undefined ? fallback : delimiter
  if (!final) return []
  if (typeof final === 'string' || final instanceof RegExp) return [final]
  return [...final]
}

/**
 * Splits a value by the first delimiter that matches it, after dropping the
 * delimiters it starts with.
 *
 * @remarks
 *   Port of Ariakit's `splitValueByDelimiter`. Two behaviors are worth naming
 *   because callers depend on them:
 *
 *   - A value no delimiter matches returns an **empty** array, not `[value]`. The
 *       callers read that as "nothing to add", so a partially typed tag is left
 *       alone.
 *   - Leading delimiters are stripped instead of producing empty values, which is
 *       what keeps `", tag"` from adding a tag before the user typed one. The
 *       stripping happens _before_ the "does it match at all" check, so a value
 *       whose only delimiters are leading ones also returns an empty array
 *       (`",,a"` splits into nothing).
 *
 *   A string delimiter is matched as a regular expression (`String.match`
 *   compiles it) but split literally, exactly as in Ariakit. It only matters
 *   for delimiters with regex syntax in them — pass a `RegExp` for those.
 * @example
 *   splitTagValue('a,b', [',']) // ['a', 'b']
 *   splitTagValue('a b', [',']) // [] — no delimiter matched
 *   splitTagValue(',a,b', [',']) // ['a', 'b'] — the leading comma is dropped
 */
export const splitTagValue = (
  value: string,
  delimiters: ReadonlyArray<string | RegExp>,
): Array<string> => {
  for (const delimiter of delimiters) {
    let match = value.match(delimiter)

    while (match?.index === 0) {
      value = value.slice(match[0].length)
      match = value.match(delimiter)
    }

    if (!match) continue
    return value.split(delimiter)
  }

  return []
}

/**
 * Trims the values and drops the empty ones — the cleanup Ariakit applies to
 * every split result before adding tags.
 */
export const cleanTagValues = (
  values: ReadonlyArray<string>,
): Array<string> => {
  const cleaned: Array<string> = []
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed !== '') cleaned.push(trimmed)
  }
  return cleaned
}

/**
 * Turns pasted text into the tag values it stands for.
 *
 * @remarks
 *   Port of the `onPaste` body of Ariakit's `useTagInput`: the clipboard text is
 *   trimmed, split by the first matching delimiter, and each value trimmed
 *   again. An empty result means the paste is a plain text insertion and must
 *   keep its default behavior.
 * @example
 *   parseTagValues('  react, jsx  ') // ['react', 'jsx']
 *   parseTagValues('react jsx', ',') // [] — only commas split here
 *
 * @param text - The pasted text.
 * @param delimiter - See {@link TagDelimiter}.
 */
export const parseTagValues = (
  text: string,
  delimiter?: TagDelimiter,
): Array<string> =>
  cleanTagValues(splitTagValue(text.trim(), getTagDelimiters(delimiter)))

/** The input state {@link mapTagChangeIntent} decides on. */
export interface TagChangeContext {
  /** The value the input element reports. */
  value: string
  /**
   * Caret start, or `null` for a control with no selection API — an `email` or
   * `number` input, where reading `selectionStart` returns `null` or throws.
   *
   * A `null` caret counts as **the end of the value** here, so the delimiter
   * still splits. This is the one deliberate divergence from Ariakit, see
   * {@link mapTagChangeIntent}.
   */
  selectionStart?: number | null
  /** Caret end. Defaults to {@link TagChangeContext.selectionStart}. */
  selectionEnd?: number | null
  /** See {@link TagDelimiter}. */
  delimiter?: TagDelimiter
}

/** What a change of the input value asks the tag model to do. */
export interface TagChangeIntent {
  /** The values to add, in order. */
  values: Array<string>
  /** What stays in the input: the part after the last delimiter. */
  value: string
}

/**
 * Maps a change of the input value to the tags it produces, or `null` when the
 * value only has to be stored.
 *
 * @remarks
 *   Ported from the `onChange` body of Ariakit's `useTagInput`. The caret guard
 *   is the interesting half: splitting only happens while the caret sits after
 *   the whole value, so typing a comma in the middle of an existing tag edits
 *   the text instead of cutting it in two.
 *
 *   **Divergence.** Ariakit reads the caret through `getTextboxSelection`, which
 *   answers `{ start: 0, end: 0 }` for an element with no selection API — and
 *   `0 === value.length` only holds for an empty value, so a `TagInput`
 *   rendered as `<input type="email">` never splits on change at all. A missing
 *   caret is read as the end of the value here instead, which keeps the
 *   delimiter working on those inputs and makes the function usable from a
 *   caller that has a value and no caret. Pass `selectionStart: 0` explicitly
 *   for the Ariakit reading.
 * @example
 *   mapTagChangeIntent({ value: 'react,' }) // { values: ['react'], value: '' }
 *   // only the added values are trimmed, the trailing one is still being typed
 *   mapTagChangeIntent({ value: 'react, js' }) // { values: ['react'], value: ' js' }
 *   mapTagChangeIntent({ value: 'react' }) // null — nothing to add yet
 *   mapTagChangeIntent({ value: 'a,b', selectionStart: 1 }) // null — mid-edit
 */
export const mapTagChangeIntent = (
  context: TagChangeContext,
): TagChangeIntent | null => {
  const { value, delimiter } = context
  const start = context.selectionStart ?? value.length
  const end = context.selectionEnd ?? start

  if (start !== end || start !== value.length) return null

  const parts = splitTagValue(value, getTagDelimiters(delimiter))
  const trailing = parts.pop() ?? ''
  const values = cleanTagValues(parts)

  if (!values.length) return null
  return { values, value: trailing }
}

/**
 * The minimal shape of a key event the tag mappers read.
 *
 * Structural on purpose: a DOM `KeyboardEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface TagKeyEvent {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
}

/** What a key press on a tag element asks for. */
export type TagKeyIntent =
  | {
      type: 'remove'
      /**
       * Where the active item goes next: `Backspace` steps back to the tag
       * before the removed one, `Delete` forward to the one after it.
       */
      move: 'previous' | 'next'
    }
  | {
      /**
       * Hands the key to the input element. Deliberately without
       * `preventDefault`, so the character the user pressed lands in the input
       * — see the note on {@link mapTagKeyIntent}.
       */
      type: 'focusInput'
    }

/** The policy {@link mapTagKeyIntent} applies. */
export interface TagKeyContext {
  /**
   * Whether the platform is Apple, where paste is `Cmd+V` instead of `Ctrl+V`.
   *
   * @default false
   */
  apple?: boolean
  /**
   * Whether `Backspace` and `Delete` remove the tag.
   *
   * @default true
   */
  removeOnKeyPress?: boolean
}

/**
 * `true` for a key press that inserts a character — Ariakit's `isPrintableKey`
 * check: a single-character key with no modifier.
 */
export const isTagPrintableKey = (event: TagKeyEvent): boolean =>
  !event.ctrlKey && !event.metaKey && event.key.length === 1

/**
 * `true` for the paste shortcut of the platform: `Cmd+V` on Apple, `Ctrl+V`
 * elsewhere.
 */
export const isTagPasteShortcut = (
  event: TagKeyEvent,
  apple = false,
): boolean =>
  !!(apple ? event.metaKey : event.ctrlKey) &&
  (event.key === 'v' || event.key === 'V')

/**
 * Maps a key press on a tag element to what it means, or `null` when the key is
 * the tag list's business (an arrow key) or nobody's.
 *
 * @remarks
 *   Ported from the `onKeyDown` of Ariakit's `useTag`. The `'focusInput'` intent
 *   carries the widget's nicest detail: typing while a tag is focused moves
 *   focus to the input **without** preventing the default, so the browser
 *   inserts the character into the element that just received focus. It is a
 *   real DOM behavior rather than a state transition, which is why the model
 *   only reports the intent and `props.tag` carries it out.
 * @example
 *   mapTagKeyIntent({ key: 'Backspace' }) // { type: 'remove', move: 'previous' }
 *   mapTagKeyIntent({ key: 'Delete' }) // { type: 'remove', move: 'next' }
 *   mapTagKeyIntent({ key: 'a' }) // { type: 'focusInput' }
 *   mapTagKeyIntent({ key: 'v', ctrlKey: true }) // { type: 'focusInput' }
 *   mapTagKeyIntent({ key: 'ArrowLeft' }) // null
 */
export const mapTagKeyIntent = (
  event: TagKeyEvent,
  context: TagKeyContext = {},
): TagKeyIntent | null => {
  const { apple = false, removeOnKeyPress = true } = context

  if (removeOnKeyPress) {
    if (event.key === 'Backspace') return { type: 'remove', move: 'previous' }
    if (event.key === 'Delete') return { type: 'remove', move: 'next' }
  }

  if (isTagPrintableKey(event) || isTagPasteShortcut(event, apple)) {
    return { type: 'focusInput' }
  }

  return null
}

/** The caret of the tag input, as the two predicates below read it. */
export interface TagInputCaret {
  /**
   * Caret start. `null` — a control with no selection API — counts as `0`, like
   * Ariakit's `getTextboxSelection`.
   */
  selectionStart?: number | null
  /** Caret end. Defaults to {@link TagInputCaret.selectionStart}. */
  selectionEnd?: number | null
  /**
   * Length of the input value, for the "caret at the end" half of the guard.
   *
   * @default 0
   */
  length?: number
}

/**
 * `true` when `Backspace` must remove the last tag instead of editing the text:
 * the key is `Backspace` and the caret is collapsed at the start of the value.
 *
 * @remarks
 *   Ported from the `onKeyDown` of Ariakit's `useTagInput`. Note that it stays
 *   `true` for an empty input, which is the common case — the user cleared the
 *   input and keeps pressing `Backspace` to delete tags.
 * @example
 *   isTagRemoveLastKey({ key: 'Backspace' }) // true
 *   isTagRemoveLastKey({ key: 'Backspace' }, { selectionStart: 3 }) // false
 *   isTagRemoveLastKey({ key: 'Delete' }) // false
 */
export const isTagRemoveLastKey = (
  event: TagKeyEvent,
  caret: TagInputCaret = {},
): boolean => {
  if (event.key !== 'Backspace') return false
  const start = caret.selectionStart ?? 0
  const end = caret.selectionEnd ?? start
  return start === end && start === 0
}

/** The caret plus the axis {@link canTagInputNavigate} needs. */
export interface TagInputNavigationContext extends TagInputCaret {
  /**
   * Which arrow keys navigate the tag list.
   *
   * @default 'both'
   */
  orientation?: CompositeOrientation
}

/**
 * `true` when an arrow key on the input may move the active item instead of the
 * caret.
 *
 * @remarks
 *   Ported from the textbox guard of Ariakit's `useCompositeItem`: a composite
 *   item that is a text field only navigates when the caret sits at the edge of
 *   its value it is leaving — at offset `0` for a backward key, at the end of
 *   the value for a forward one. Otherwise the user is moving through the text
 *   they are typing.
 *
 *   Each key looks at the end of the selection it faces — `selectionEnd` forward,
 *   `selectionStart` backward — so a selection that reaches the far edge
 *   navigates just like a collapsed caret there would.
 *
 *   Keys that are not arrows are never blocked: `Home` / `End` belong to the
 *   widget, which is how `End` reaches the input from a tag and `Home` reaches
 *   the first tag from the input.
 * @example
 *   canTagInputNavigate({ key: 'ArrowLeft' }) // true — caret at 0
 *   canTagInputNavigate({ key: 'ArrowLeft' }, { selectionStart: 2 }) // false
 *   canTagInputNavigate({ key: 'ArrowRight' }, { length: 3 }) // false
 *   canTagInputNavigate({ key: 'End' }, { selectionStart: 2, length: 3 }) // true
 */
export const canTagInputNavigate = (
  event: TagKeyEvent,
  context: TagInputNavigationContext = {},
): boolean => {
  const { orientation = 'both', length = 0 } = context
  const start = context.selectionStart ?? 0
  const end = context.selectionEnd ?? start
  const isVertical = orientation !== 'horizontal'
  const isHorizontal = orientation !== 'vertical'

  const isForward =
    (isHorizontal && event.key === 'ArrowRight') ||
    (isVertical && event.key === 'ArrowDown')
  if (isForward) return end === length

  const isBackward =
    (isHorizontal && event.key === 'ArrowLeft') ||
    (isVertical && event.key === 'ArrowUp')
  if (isBackward) return start === 0

  return true
}

/**
 * Adds a value to the tag values, keeping the array reference when the value is
 * already there.
 *
 * @remarks
 *   Ported from `addValue` in Ariakit's `createTagStore`. The kept reference is
 *   what lets the model report whether anything changed — Ariakit uses the same
 *   `next === prev` check to decide that there is nothing to undo.
 * @example
 *   addTagValue(['react'], 'jsx') // ['react', 'jsx']
 *   addTagValue(['react'], 'react') // the same array
 */
export const addTagValue = (
  values: Array<string>,
  value: string,
): Array<string> => (values.includes(value) ? values : [...values, value])

/**
 * Removes a value from the tag values, keeping the array reference when the
 * value is not there.
 *
 * @remarks
 *   Ported from `removeValue` in Ariakit's `createTagStore`, which filters
 *   unconditionally. Duplicates cannot exist — {@link addTagValue} is the only
 *   way in — so filtering removes exactly one tag.
 * @example
 *   removeTagValue(['react', 'jsx'], 'react') // ['jsx']
 *   removeTagValue(['react'], 'vue') // the same array
 */
export const removeTagValue = (
  values: Array<string>,
  value: string,
): Array<string> =>
  values.includes(value) ? values.filter((entry) => entry !== value) : values
