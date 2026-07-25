/**
 * Layer 2 for `radio`: keeping the bound element's _properties_ in sync with
 * the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): the `useEffect` blocks of
 * `packages/ariakit-react-components/src/radio/radio.tsx`.
 */

import { effect, getCalls } from '@reatom/core'

import type { RadioItemModel, RadioModel } from './reatomRadio'

/**
 * The element properties a radio binds to. A non-native element receives them
 * as expandos, which is what Ariakit does too — form libraries and test helpers
 * read them.
 */
type RadioElement = HTMLElement & {
  checked?: boolean
  name?: string
  value?: string
}

/** Options of {@link reatomRadioElementSync}. */
export interface RadioElementSyncOptions {
  /**
   * Whether the bound element is a native `<input type="radio">`.
   *
   * @default true
   */
  native?: boolean
  /** The `name` property mirrored onto a non-native element. */
  nativeName?: string
  /** Unit name of the effect. */
  name?: string
}

/**
 * Keeps one radio element's `checked` property in step with the model — the
 * part of a radio that no prop record can express.
 *
 * @remarks
 *   Two DOM facts make this necessary, and both are group-wide rather than
 *   per-element:
 *
 *   - A native radio flips its own `checked` property _before_ the model sees the
 *       event, so a refused selection (`disabled` / `readOnly`) leaves the DOM
 *       ahead of the state.
 *   - The browser also unchecks the other radios of the same `name` while doing it,
 *       so the element of the radio that is still checked in the model needs
 *       the write-back too.
 *
 *   Because the second case leaves this radio's own state untouched, the effect
 *   re-runs on every group-wide selection _attempt_ — `getCalls(model.select)`
 *   — not only on its own `checked` changes. Ariakit reaches the same result
 *   with a `schedulePropertyUpdate` force-update signal; here the action is the
 *   event.
 * @example
 *   const plan = reatomRadio({ name: 'plan' })
 *   const free = plan.item('free')
 *   const sync = reatomRadioElementSync(plan, free)
 *   // on unmount:
 *   sync.unsubscribe()
 *
 * @param model - The radio group model.
 * @param item - One of its `item(value)` sub-models.
 * @param options - See {@link RadioElementSyncOptions}.
 * @returns The effect; call `unsubscribe()` to stop it when the element is
 *   gone.
 */
export const reatomRadioElementSync = (
  model: RadioModel,
  item: RadioItemModel,
  options: RadioElementSyncOptions = {},
) => {
  const {
    native = true,
    nativeName,
    name = `${item.name}.elementSync`,
  } = options

  return effect(() => {
    // Re-run on every selection attempt in the group, not only on every state
    // change of this radio.
    getCalls(model.select)

    const element = item.element() as RadioElement | null
    const checked = item.checked()
    if (!element) return

    element.checked = checked

    if (native) return
    if (nativeName !== undefined) element.name = nativeName
    element.value = String(item.value)
  }, name)
}
