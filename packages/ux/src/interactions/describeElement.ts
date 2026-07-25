/**
 * DOM readers that turn live elements into the plain {@link ElementDescriptor}
 * records the pure interaction mappers consume.
 *
 * Layer 2: this is the only place in `command` / `focusable` that reads element
 * properties and attributes.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC): `packages/ariakit-utils/src/dom.ts`.
 */

import type { ElementDescriptor } from './element'

/**
 * `true` when text can be selected inside `element`.
 *
 * Port of Ariakit's `isTextField` (`ariakit-utils/src/dom.ts`). It probes
 * `selectionStart` instead of checking an input-type allowlist: Safari throws
 * when reading `selectionStart` on non-text inputs, and the set of types that
 * support the selection API changes as the HTML spec evolves.
 */
export const isTextFieldElement = (element: Element): boolean => {
  try {
    // Realm-bound constructors reject elements from same-origin iframes.
    if (element.tagName === 'TEXTAREA') return true
    if (element.tagName !== 'INPUT') return false
    return (element as HTMLInputElement).selectionStart !== null
  } catch {
    return false
  }
}

/**
 * Reduces a live element to the plain record the pure mappers understand.
 *
 * Call it once per event, on `event.currentTarget`, exactly where Ariakit reads
 * the element inline.
 *
 * @example
 *   const intent = mapActivationIntent({
 *     type: 'keydown',
 *     key: 'Enter',
 *     element: describeElement(event.currentTarget as HTMLElement),
 *   })
 */
export const describeElement = (element: Element): ElementDescriptor => {
  const control = element as HTMLInputElement
  return {
    tagName: element.tagName.toLowerCase(),
    type: typeof control.type === 'string' ? control.type : undefined,
    disabled: control.disabled === true,
    ariaDisabled: element.getAttribute('aria-disabled'),
    readOnly: control.readOnly === true,
    contentEditable: (element as HTMLElement).isContentEditable === true,
    textField: isTextFieldElement(element),
    role: element.getAttribute('role'),
    dataName: (element as HTMLElement).dataset?.name ?? null,
    focusVisible: element.hasAttribute('data-focus-visible'),
  }
}
