/**
 * Layer 2 for `select`: the two DOM reads the prop records need, both around
 * the hidden native `<select>` that makes browser autofill work.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `getSelectedValues` and the `onFocus` /
 * `onChange` handlers of the hidden `<select>` in
 * `packages/ariakit-react-components/src/select/select.tsx`.
 */

/**
 * The values a native `<select>` reports as selected.
 *
 * @remarks
 *   Port of Ariakit's `getSelectedValues`, which is how an autofill reaches the
 *   custom widget: the browser writes the native element, the `change` event
 *   fires, and these values become the model's value.
 *
 *   The argument is `unknown` because a handler receives `event.target`, which is
 *   `EventTarget | null` in the DOM types and a plain object in a node test.
 *   Anything that is not a multi-select element reads as an empty list, and a
 *   single-value read belongs to {@link readNativeSelectValue} instead.
 * @example
 *   readNativeSelectValues(element) // ['Apple', 'Orange']
 *   readNativeSelectValues(null) // []
 */
export const readNativeSelectValues = (element: unknown): Array<string> => {
  const options = (element as HTMLSelectElement | null)?.selectedOptions
  if (!options) return []
  return Array.from(options, (option) => option.value)
}

/**
 * The single value a native `<select>` reports, `''` for anything that has
 * none.
 *
 * Ariakit reads `event.target.value` inline for the same purpose; it is a
 * function here so the `onChange` handler stays free of casts.
 */
export const readNativeSelectValue = (element: unknown): string => {
  const value = (element as { value?: unknown } | null)?.value
  return typeof value === 'string' ? value : ''
}
