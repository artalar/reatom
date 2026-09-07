/**
 * The composite typeahead: printable characters move the active item to the
 * next one whose text starts with them.
 *
 * Layer 1 — the matcher is a pure function of a plain item list, and the
 * character buffer is one atom whose reset lives in the flow as `await
 * wrap(sleep(ms))` plus `withAbort()` (`PORTING_PLAN.md` §2.4) rather than in a
 * stored timeout handle.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/composite/composite-typeahead.tsx` and
 * the `typeaheadText` item option of
 * `packages/ariakit-components/src/composite/composite-store.ts`, both read on
 * `main`.
 *
 * Ariakit keeps the buffer in a module-level `WeakMap<CompositeStore,
 * TypeaheadState>` so that two composites on a page do not share it. Here the
 * buffer _is_ a model: one per composite by construction, named, and
 * observable.
 */

import type { AbortExt, Action, Atom } from '@reatom/core'
import {
  action,
  atom,
  isAbort,
  named,
  sleep,
  withAbort,
  wrap,
} from '@reatom/core'

import type { CompositeNavigationItem } from './getNextId'
import { flipItems, getEnabledItems } from './getNextId'

/**
 * How long the typed characters survive a pause, in milliseconds — Ariakit's
 * `setTimeout(clearChars, 500)`.
 */
export const TYPEAHEAD_TIMEOUT = 500

/** The plain item snapshot the typeahead matches against. */
export interface TypeaheadItem extends CompositeNavigationItem {
  /** The item's text content, which Ariakit reads from `element.textContent`. */
  text?: string
  /**
   * The text the typeahead matches instead of {@link TypeaheadItem.text} —
   * Ariakit's `typeaheadText` item option, for an item whose visible label is
   * not what the user would type (an icon plus a name, a localized alias).
   *
   * An empty string opts the item out of matching altogether, which is how a
   * decorative or non-searchable item is excluded.
   */
  typeaheadText?: string
  /**
   * The item's value, the last fallback. A composite item has no value, but a
   * select or combobox item does, and the typeahead is generic over all of
   * them.
   */
  value?: string
}

/**
 * The minimal shape of a key event the typeahead reads.
 *
 * Structural on purpose: a DOM `KeyboardEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface TypeaheadKeyEvent {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/**
 * A single printable character, unicode-aware: `é`, `ж`, and `字` are typeahead
 * keys, `Enter` and `+` are not.
 */
const PRINTABLE_CHAR = /^[\p{Letter}\p{Number}]$/u

const DIACRITICS = /[\u0300-\u036f]/g

/**
 * Whether the key press belongs to the typeahead.
 *
 * Ported from Ariakit's `isValidTypeaheadEvent`, minus its
 * `isTextField(target)` guard — that one reads the DOM, so it stays in Layer
 * 2.
 *
 * @example
 *   isTypeaheadKey({ key: 'a' }) // true
 *   isTypeaheadKey({ key: 'ArrowDown' }) // false
 *   isTypeaheadKey({ key: 'a', ctrlKey: true }) // false
 *   isTypeaheadKey({ key: ' ' }) // false — nothing typed yet
 *   isTypeaheadKey({ key: ' ' }, 'ne') // true — inside a word
 *
 * @param chars - The characters typed so far. Space only counts once the buffer
 *   is non-empty, so it keeps activating the focused item otherwise.
 */
export const isTypeaheadKey = (
  event: TypeaheadKeyEvent,
  chars = '',
): boolean => {
  if (event.key === ' ' && chars.length > 0) return true
  return (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    PRINTABLE_CHAR.test(event.key)
  )
}

/**
 * The text one item is matched by: `typeaheadText ?? text ?? value`.
 *
 * `typeaheadText` wins even when empty, which is what opts an item out; `text`
 * and `value` fall through when empty, since an item with no rendered text is
 * not opting out of anything.
 *
 * @example
 *   typeaheadItemText({ id: 'a', text: 'Apple' }) // 'Apple'
 *   typeaheadItemText({ id: 'a', text: 'Apple', typeaheadText: 'Pomme' }) // 'Pomme'
 *   typeaheadItemText({ id: 'a', text: 'Apple', typeaheadText: '' }) // ''
 *   typeaheadItemText({ id: 'a', value: 'Apple' }) // 'Apple'
 */
export const typeaheadItemText = (item: TypeaheadItem): string | undefined =>
  item.typeaheadText ?? (item.text || item.value || undefined)

/**
 * Whether an item is matched by the typed characters.
 *
 * Ported from Ariakit's `itemTextStartsWith`: the item text is normalized
 * (`NFD` minus the combining marks, so `Ångström` is reachable by typing `an`),
 * trimmed, and compared case-insensitively.
 *
 * @example
 *   typeaheadItemStartsWith({ id: 'a', text: ' Ångström ' }, 'an') // true
 *   typeaheadItemStartsWith(
 *     { id: 'a', text: 'Apple', typeaheadText: '' },
 *     'a',
 *   ) // false
 */
export const typeaheadItemStartsWith = (
  item: TypeaheadItem,
  text: string,
): boolean => {
  const itemText = typeaheadItemText(item)
  if (!itemText) return false
  return itemText
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .trim()
    .toLowerCase()
    .startsWith(text.toLowerCase())
}

/** What {@link restartTypeaheadItems} decides. */
export interface TypeaheadRestart<T extends TypeaheadItem = TypeaheadItem> {
  /** The items to search, in the order they must be searched. */
  items: Array<T>
  /** The buffer to search with, reset to the single character on a restart. */
  chars: string
}

/** Arguments of {@link restartTypeaheadItems}. */
export interface TypeaheadRestartContext<
  T extends TypeaheadItem = TypeaheadItem,
> {
  /** The candidate items, already filtered to the enabled ones. */
  items: ReadonlyArray<T>
  /** The active item id the restart is relative to. */
  activeId?: string | null
  /** The character just typed, lowercased. */
  char: string
  /** The whole buffer, i.e. the previous one with `char` appended. */
  chars: string
}

/**
 * Decides between continuing the search and restarting it on the typed
 * character alone.
 *
 * @remarks
 *   Ported from Ariakit's `getSameInitialItems`, which mutates the shared `chars`
 *   in place; here the decision is data.
 *
 *   Typing the same letter repeatedly cycles through the items that start with it
 *   (`o`, `o`, `o` walks `One`, `Only`, `Other`), while typing a word keeps
 *   narrowing it down (`o`, `o` matches `Oof` rather than moving on). The
 *   difference is whether the active item still matches the whole buffer.
 * @example
 *   const items = [{ id: 'one' }, { id: 'oof' }, { id: 'other' }].map(
 *     (item) => ({
 *       ...item,
 *       text: item.id,
 *     }),
 *   )
 *
 *   // cycling: the buffer restarts and the search starts after the active item
 *   restartTypeaheadItems({ items, activeId: 'one', char: 'o', chars: 'o' })
 *   // { chars: 'o', items: [oof, other] }
 *
 *   // narrowing: `oo` still matches the active item, so nothing restarts
 *   restartTypeaheadItems({ items, activeId: 'oof', char: 'o', chars: 'oo' })
 *   // { chars: 'oo', items: [one, oof, other] }
 */
export const restartTypeaheadItems = <T extends TypeaheadItem>(
  context: TypeaheadRestartContext<T>,
): TypeaheadRestart<T> => {
  const { items, activeId, char, chars } = context
  const keep: TypeaheadRestart<T> = { items: [...items], chars }

  if (!activeId) return keep
  const activeItem = items.find((item) => item.id === activeId)
  if (!activeItem) return keep
  if (!typeaheadItemStartsWith(activeItem, char)) return keep
  // "Typing 'oo' will match 'oof' instead of moving to the next item."
  if (chars !== char && typeaheadItemStartsWith(activeItem, chars)) return keep

  return {
    // "If we're looping through the items, we'll want to reset the chars so
    // 'oo' becomes just 'o'."
    chars: char,
    // `flipItems` puts the items before the active one at the end of the list,
    // so a plain scan cycles through them; the active item itself is excluded so
    // that the cycle always advances.
    items: flipItems(
      items.filter((item) => typeaheadItemStartsWith(item, char)),
      activeId,
    ).filter((item) => item.id !== activeId),
  }
}

/** Arguments of {@link matchTypeahead}. */
export interface TypeaheadMatchContext<
  T extends TypeaheadItem = TypeaheadItem,
> {
  /** The items to match, in navigation order. Disabled items are skipped. */
  items: ReadonlyArray<T>
  /** The active item id, which the cycling is relative to. */
  activeId?: string | null
  /** The characters typed so far, _before_ this key. */
  chars?: string
}

/** What one typeahead key press resolves to. */
export interface TypeaheadMatch {
  /** The item to move to, `undefined` when nothing matched. */
  id?: string
  /**
   * The buffer to keep: the appended one, the single character when the search
   * restarted, and `''` when nothing matched — a failed search starts over, so
   * the next key is a fresh first character.
   */
  chars: string
}

/**
 * Resolves one typeahead key press to the item it lands on and the buffer to
 * keep.
 *
 * Ported from the body of Ariakit's `onKeyDownCapture`, minus the DOM: the
 * guards on the event target and the `store.move` call stay in Layer 2.
 *
 * @example
 *   const items = [
 *     { id: 'a', text: 'Apple' },
 *     { id: 'b', text: 'Apricot', disabled: true },
 *     { id: 'c', text: 'Banana' },
 *   ]
 *
 *   matchTypeahead('b', { items }) // { id: 'c', chars: 'b' }
 *   matchTypeahead('p', { items, chars: 'a' }) // { id: 'a', chars: 'ap' }
 *   matchTypeahead('z', { items }) // { chars: '' } — nothing matched
 *
 * @param key - The `key` of the event, in any case.
 * @param context - See {@link TypeaheadMatchContext}.
 */
export const matchTypeahead = <T extends TypeaheadItem>(
  key: string,
  context: TypeaheadMatchContext<T>,
): TypeaheadMatch => {
  const { items, activeId, chars: previous = '' } = context
  // "Always consider the lowercase version of the key."
  const char = key.toLowerCase()

  const restart = restartTypeaheadItems({
    items: getEnabledItems(items),
    activeId,
    char,
    chars: previous + char,
  })

  const item = restart.items.find((candidate) =>
    typeaheadItemStartsWith(candidate, restart.chars),
  )

  return item ? { id: item.id, chars: restart.chars } : { chars: '' }
}

/** What {@link TypeaheadUnits.press} reports. */
export interface TypeaheadPress {
  /**
   * Whether the typeahead consumed the key, so a handler must call
   * `preventDefault` — which it has to do even when nothing matched, since
   * otherwise `Space` inside a word would activate the focused item.
   */
  handled: boolean
  /** The id the typeahead moved to, `undefined` when nothing matched. */
  id?: string
}

/**
 * The delayed buffer reset.
 *
 * `withAbort()`'s last-in-win is Ariakit's `clearTimeout` plus `setTimeout`
 * pair: the next key supersedes the pending reset, and
 * {@link TypeaheadUnits.clear} aborts it outright.
 */
export interface TypeaheadExpire extends Action<[], Promise<void>>, AbortExt {}

/**
 * Starts the delayed buffer reset and ignores the rejection an abort produces.
 *
 * A key handler is not an `await` site: it starts the wait and returns, so the
 * promise `withAbort()` rejects on cancellation would otherwise surface as an
 * unhandled rejection — and being superseded by the next keypress is the
 * _normal_ outcome here. Awaiting {@link TypeaheadExpire} directly still
 * observes it.
 *
 * @example
 *   // in a view's own key handler, next to the prop record
 *   scheduleTypeaheadExpire(composite.typeahead.expire)
 */
export const scheduleTypeaheadExpire = (expire: TypeaheadExpire): void =>
  void expire().catch((error: unknown) => {
    if (!isAbort(error)) throw error
  })

/** Options of {@link reatomTypeahead}. */
export interface TypeaheadOptions<T extends TypeaheadItem = TypeaheadItem> {
  /**
   * The items to match, in navigation order. A composite passes its
   * `typeaheadItems` snapshot.
   */
  items: () => ReadonlyArray<T>
  /** The active item id, which the same-initial cycling is relative to. */
  activeId?: () => string | null | undefined
  /**
   * Applies a match. A composite passes its `move`, so the typeahead is a focus
   * move like any other and everything watching `move` — the select's
   * "selection follows focus", `withCompositeFocus` — follows it.
   */
  move?: (id: string) => void
  /**
   * How long the buffer survives a pause, in milliseconds.
   *
   * @default 500
   */
  timeout?: number
  /**
   * Whether typing navigates at all — Ariakit's `typeahead` prop.
   *
   * @default true
   */
  enabled?: boolean
  /** The model name. */
  name?: string
}

/** Units attached to the character buffer by {@link reatomTypeahead}. */
export interface TypeaheadUnits {
  /** How long the buffer survives a pause, in milliseconds. */
  timeout: Atom<number>
  /** Whether typing navigates at all. */
  enabled: Atom<boolean>
  /**
   * Feeds one key press to the typeahead: appends the character, moves to the
   * item it matched, and schedules the buffer reset.
   *
   * The DOM guards Ariakit applies around it — the event target being a text
   * field or something other than the widget and its items — belong to Layer 2,
   * see `applyTypeaheadIntent`.
   */
  press: Action<[event: TypeaheadKeyEvent], TypeaheadPress>
  /** Drops the buffer now, cancelling a pending reset. */
  clear: Action<[], void>
  /** The delayed buffer reset, see {@link TypeaheadExpire}. */
  expire: TypeaheadExpire
}

/**
 * A typeahead model: the atom of characters typed so far, plus the key press
 * transition.
 *
 * Reading the model gives the buffer, which is what a view would render as a
 * "typing…" hint; writing it is not part of the contract, since the buffer only
 * ever means "these characters were typed within the last
 * {@link TypeaheadUnits.timeout} milliseconds".
 */
export interface TypeaheadModel extends Atom<string>, TypeaheadUnits {}

/**
 * Creates a typeahead model: the character buffer of "type to jump to an item",
 * bound to a list of items.
 *
 * @remarks
 *   Prefer the one {@link reatomComposite} already builds (`composite.typeahead`);
 *   this factory is for a widget that matches items of its own — a virtualized
 *   list that knows more items than the composite does, or a non-composite
 *   list.
 *
 *   Two Ariakit mechanics change shape: the `WeakMap<CompositeStore,
 *   TypeaheadState>` module global becomes the model itself (one buffer per
 *   instance by construction), and the `cleanupTimeout` handle becomes `await
 *   wrap(sleep(timeout))` inside {@link TypeaheadUnits.expire} with
 *   `withAbort()` — so the next keypress supersedes the pending reset instead
 *   of clearing a stored id.
 * @example
 *   const items = [
 *     { id: 'a', text: 'Apple' },
 *     { id: 'b', text: 'Banana' },
 *   ]
 *   let activeId = 'a'
 *
 *   const typeahead = reatomTypeahead({
 *     items: () => items,
 *     activeId: () => activeId,
 *     move: (id) => (activeId = id),
 *     name: 'fruit.typeahead',
 *   })
 *
 *   typeahead.press({ key: 'b' }) // { handled: true, id: 'b' }
 *   typeahead() // 'b' — the buffer, cleared 500ms later
 *
 * @see https://ariakit.com/reference/composite-typeahead
 */
export const reatomTypeahead = <T extends TypeaheadItem>(
  options: TypeaheadOptions<T>,
): TypeaheadModel => {
  const {
    items,
    activeId,
    move,
    timeout: initTimeout = TYPEAHEAD_TIMEOUT,
    enabled: initEnabled = true,
    name = named('typeahead'),
  } = options

  const chars = atom('', name)
  const timeout = atom(initTimeout, `${name}.timeout`)
  const enabled = atom(initEnabled, `${name}.enabled`)

  const expire: TypeaheadExpire = action(async () => {
    const ms = timeout()
    // A zero timeout resets the buffer within the same key press, which is what
    // "no buffer" means; skipping the `await` keeps it out of a microtask.
    if (ms > 0) await wrap(sleep(ms))
    chars.set('')
  }, `${name}.expire`).extend(withAbort())

  const clear = action(() => {
    expire.abort(`${name}.clear`)
    chars.set('')
  }, `${name}.clear`)

  const press = action((event: TypeaheadKeyEvent): TypeaheadPress => {
    // Ariakit returns early without touching the buffer when the `typeahead`
    // prop is off: the characters of a widget that stopped listening are not
    // the widget's business.
    if (!enabled()) return { handled: false }

    if (!isTypeaheadKey(event, chars())) {
      clear()
      return { handled: false }
    }

    const match = matchTypeahead(event.key, {
      items: items(),
      activeId: activeId?.(),
      chars: chars(),
    })

    chars.set(match.chars)
    // An empty buffer has nothing left to reset, and a failed search must not
    // keep a stale timer alive.
    if (match.chars) scheduleTypeaheadExpire(expire)
    else expire.abort(`${name}.miss`)

    if (match.id !== undefined) move?.(match.id)

    return { handled: true, id: match.id }
  }, `${name}.press`)

  return chars.extend(() => ({ timeout, enabled, press, clear, expire }))
}
