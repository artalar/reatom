// The regex that recognises an already-encoded token, so a raw value that looks
// like one (`s-61`) is encoded instead of passed through, keeping the value ->
// token direction injective.
const ENCODED = /^s-(?:[0-9a-f]+(?:-[0-9a-f]+)*)?$/

/**
 * Encodes a string value into an id-safe token, so an item id can be derived
 * from its value as a pure function — stable between the server and the client,
 * with no counter or map that could drift across Reatom contexts.
 *
 * @remarks
 *   Mirrors `radioItemId`'s scheme, restricted to strings: a value made of word
 *   characters and dashes is used verbatim; anything else becomes `s-<hex code
 *   points>`. The `s-...` guard keeps a literal value that already looks
 *   encoded from colliding with a real encoding.
 *
 *   Shared by `combobox` and `select`, whose ids are derived from string values.
 * @example
 *   encodeValueKey('Apple') // 'Apple'
 *   encodeValueKey('a b, c') // 's-61-20-62-2c-20-63'
 */
export const encodeValueKey = (value: string): string =>
  /^[\w-]+$/.test(value) && !ENCODED.test(value)
    ? value
    : `s-${Array.from(value, (character) =>
        character.codePointAt(0)!.toString(16),
      ).join('-')}`

// Reserves both the `n-` and `s-` namespaces, so a literal string that looks
// encoded cannot collide with a real encoding.
const TYPED_ENCODED = /^[ns]-(?:[0-9a-f]+(?:-[0-9a-f]+)*)?$/

/**
 * Encodes a `string | number` value into an id-safe token that keeps the
 * value's type, so `2` and `'2'` never share a key. A value made of word
 * characters and dashes is used verbatim; every number, and any unsafe or
 * already-encoded string, becomes `n-<hex>` / `s-<hex>` of its code points.
 *
 * @remarks
 *   Shared by `radio` (item ids) and `checkbox` (item names), whose values are
 *   `string | number`. Unlike {@link encodeValueKey}, this keeps the number tag
 *   because those widgets accept numbers; the string-only combobox/select
 *   encoder does not, which is why the two stay separate.
 * @example
 *   encodeTypedValueKey('free') // 'free'
 *   encodeTypedValueKey(2) // 'n-32' — numbers keep their type
 *   encodeTypedValueKey('a b') // 's-61-20-62' — unsafe values are encoded
 */
export const encodeTypedValueKey = (value: string | number): string =>
  typeof value === 'string' &&
  /^[\w-]+$/.test(value) &&
  !TYPED_ENCODED.test(value)
    ? value
    : `${typeof value === 'number' ? 'n' : 's'}-${Array.from(
        String(value),
        (character) => character.codePointAt(0)!.toString(16),
      ).join('-')}`
