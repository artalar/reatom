import { effect, getCalls } from '@reatom/core'

import type { CheckboxItemModel } from './reatomCheckbox'
import { toNativeChecked } from './reatomCheckbox'

/**
 * The element properties a checkbox binds to. A non-native element receives
 * them as expandos, which is what Ariakit does too — form libraries and test
 * helpers read them.
 */
type CheckboxElement = HTMLElement & {
  indeterminate?: boolean
  checked?: boolean
  name?: string
  value?: string
}

/** Options of {@link reatomCheckboxElementSync}. */
export interface CheckboxElementSyncOptions {
  /**
   * Whether the bound element is a native `<input type="checkbox">`.
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
 * Keeps the bound element's _properties_ in sync with the model — the part of a
 * checkbox that can not be expressed by a prop record.
 *
 * @remarks
 *   Ported from the `createEffect` block of `useCheckbox`
 *   (`ariakit-solid-components/src/checkbox/checkbox.tsx`), MIT, © 2025–present
 *   Ariakit FZ-LLC. Two DOM quirks live here:
 *
 *   - `indeterminate` is a property with **no** attribute form, so `'mixed'` can
 *       only be applied imperatively.
 *   - A checkbox element flips its own `checked` property before the model sees the
 *       event, so a refused transition (`disabled` / `readOnly`) leaves the DOM
 *       ahead of the state until it is written back.
 *
 *   Ariakit re-runs its effect through a `schedulePropertyUpdate` force-update
 *   signal; here the `change` action itself is the event, observed with
 *   `getCalls`, so a refused change still re-applies the properties. Ariakit
 *   also skips `checked` for native inputs because React re-renders it from
 *   props — this effect writes it for both, since a headless model has no
 *   renderer to fall back on.
 * @example
 *   const agree = reatomCheckbox({ name: 'agree' })
 *   const sync = reatomCheckboxElementSync(agree)
 *   // on unmount:
 *   sync.unsubscribe()
 *
 * @param item - A checkbox model or one of its `item(value)` sub-models.
 * @param options - See {@link CheckboxElementSyncOptions}.
 * @returns The effect; call `unsubscribe()` to stop it when the element is
 *   gone.
 */
export const reatomCheckboxElementSync = (
  item: CheckboxItemModel,
  options: CheckboxElementSyncOptions = {},
) => {
  const {
    native = true,
    nativeName,
    name = `${item.name}.elementSync`,
  } = options

  return effect(() => {
    // Re-run on every change attempt, not only on every state change.
    getCalls(item.change)

    const element = item.element() as CheckboxElement | null
    const mixed = item.mixed()
    const checked = toNativeChecked(item.checked())
    if (!element) return

    if (mixed) element.indeterminate = true
    else if (element.indeterminate) element.indeterminate = false

    element.checked = checked

    if (native) return
    if (nativeName !== undefined) element.name = nativeName
    if (item.itemValue !== undefined) element.value = String(item.itemValue)
  }, name)
}
