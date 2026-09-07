/**
 * Layer 2 for `dialog`: the DOM primitives its behaviors need.
 *
 * Every function here is a plain DOM operation that returns a restore callback,
 * so the Reatom layer only has to decide _when_ to apply it.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/dialog/utils/*` (`orchestrate.ts`,
 * `walk-tree-outside.ts`, `disable-tree.ts`, `use-prevent-body-scroll.ts`,
 * `prepend-hidden-dismiss.ts`, `is-backdrop.ts`, `is-focus-trap.ts`,
 * `supports-inert.ts`).
 */

import { isFocusable } from '../focusable/focusableDom'

/** Undoes a DOM mutation applied by this module. */
export type Restore = () => void

const noop: Restore = () => {}

/** One applied mutation of a key, and whether its owner is done with it. */
interface RestoreEntry {
  restore: Restore
  disposed: boolean
}

const restorers = new WeakMap<Element, Map<string, Array<RestoreEntry>>>()

/**
 * Applies a DOM mutation that can be applied more than once to the same element
 * and the same property, and still restores to the original value.
 *
 * @remarks
 *   Two open dialogs may both want `inert` on the same background element, and
 *   they close in an arbitrary order. Ariakit solves it with a per-element,
 *   per-key stack of restore callbacks (`orchestrate.ts`); this is a direct
 *   port.
 *
 *   A restore that is not the top of its stack only _marks_ its entry: running it
 *   would undo the mutation of a newer owner that is still active — the
 *   background of an outer dialog becoming interactive again the moment the
 *   inner one closes (react-components 0.2.0, "stale nested dialog effects no
 *   longer restore page accessibility state while a newer effect is active").
 *   The marked entries are unwound when the entry above them is disposed too,
 *   so the original value is reached whichever order the dialogs closed in.
 * @param element - The element being mutated.
 * @param key - What is being mutated, e.g. an attribute or property name.
 * @param setup - Applies the mutation and returns its restore callback.
 */
export const orchestrate = (
  element: Element,
  key: string,
  setup: () => Restore,
): Restore => {
  let stacks = restorers.get(element)
  if (!stacks) restorers.set(element, (stacks = new Map()))
  let stack = stacks.get(key)
  if (!stack) stacks.set(key, (stack = []))

  // Applied before the entry is pushed, so `setup` snapshots the value the
  // owner below it left behind.
  const entry: RestoreEntry = { restore: setup(), disposed: false }
  stack.push(entry)

  return () => {
    if (entry.disposed) return
    entry.disposed = true

    // Only the top entry may restore without overwriting a newer owner's
    // mutation. Once it is disposed, unwind any older disposed entries too.
    while (stack.length) {
      const current = stack[stack.length - 1]!
      if (!current.disposed) return
      stack.pop()
      current.restore()
    }
    stacks.delete(key)
  }
}

/** Sets an attribute and returns a callback restoring the previous value. */
export const setAttribute = (
  element: Element,
  attribute: string,
  value: string,
): Restore =>
  orchestrate(element, attribute, () => {
    const previous = element.getAttribute(attribute)
    element.setAttribute(attribute, value)
    return () => {
      if (previous == null) element.removeAttribute(attribute)
      else element.setAttribute(attribute, previous)
    }
  })

/** Sets a DOM property and returns a callback restoring the previous value. */
export const setProperty = <T extends Element, K extends keyof T & string>(
  element: T,
  property: K,
  value: T[K],
): Restore =>
  orchestrate(element, property, () => {
    const exists = property in element
    const previous = element[property]
    element[property] = value
    return () => {
      if (exists) element[property] = previous
      else delete element[property]
    }
  })

/** Assigns inline styles and returns a callback restoring the previous ones. */
export const assignStyle = (
  element: HTMLElement,
  style: Partial<CSSStyleDeclaration>,
): Restore =>
  orchestrate(element, 'style', () => {
    const previous = element.style.cssText
    Object.assign(element.style, style)
    return () => {
      element.style.cssText = previous
    }
  })

/**
 * Sets one inline CSS property and returns a callback restoring it.
 *
 * @remarks
 *   Port of Ariakit's `setCSSProperty` (`orchestrate.ts`). Unlike
 *   {@link assignStyle}, which snapshots and restores the whole `cssText`, this
 *   touches a single declaration — so a restore cannot clobber inline styles
 *   somebody else wrote to the same element in the meantime, and a custom
 *   property (`--scrollbar-width`) can be written at all.
 * @param property - A CSS property name in **kebab-case**, custom properties
 *   included.
 */
export const setCssProperty = (
  element: HTMLElement,
  property: string,
  value: string,
): Restore =>
  orchestrate(element, property, () => {
    const previous = element.style.getPropertyValue(property)
    const priority = element.style.getPropertyPriority(property)
    element.style.setProperty(property, value)
    return () => {
      if (previous) element.style.setProperty(property, previous, priority)
      else element.style.removeProperty(property)
    }
  })

/** An element in a lib version that already types the `inert` property. */
type InertElement = Element & { inert: boolean }

/** `true` when the browser implements the `inert` attribute. */
export const supportsInert = (): boolean =>
  typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype

/** `true` when `element` is `ancestor` or is contained by it. */
export const contains = (
  ancestor: Element | null | undefined,
  element: Node | null | undefined,
): boolean => !!ancestor && !!element && ancestor.contains(element)

/**
 * Every tabbable element inside `container`, in DOM order.
 *
 * @remarks
 *   Ariakit keeps a hand-written selector for this (`getAllTabbableIn`). Here the
 *   already ported `isFocusable` check is reused instead, which costs a walk
 *   over the subtree — acceptable for a dialog, which is small by construction,
 *   and it keeps a single definition of "focusable" in the package.
 * @param includeContainer - Include `container` when it is itself tabbable.
 */
export const getTabbableIn = (
  container: Element,
  includeContainer = false,
): Array<HTMLElement> => {
  const elements = Array.from(container.querySelectorAll<HTMLElement>('*'))
  const tabbables = elements.filter(
    (element) => isFocusable(element) && element.tabIndex >= 0,
  )
  const root = container as HTMLElement
  if (includeContainer && isFocusable(root) && root.tabIndex >= 0) {
    tabbables.unshift(root)
  }
  return tabbables
}

/**
 * `true` when the pointer coordinates of `event` fall inside `element`.
 *
 * Port of Ariakit's `isMouseEventOnDialog`
 * (`utils/use-hide-on-interact-outside.ts`): a zero-sized element never counts,
 * which is how an unmounted or collapsed dialog is skipped.
 */
export const isPointerEventInside = (
  event: Event,
  element: Element,
): boolean => {
  if (!('clientY' in event)) return false
  const { clientX, clientY } = event as MouseEvent
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  return (
    rect.top <= clientY &&
    clientY <= rect.top + rect.height &&
    rect.left <= clientX &&
    clientX <= rect.left + rect.width
  )
}

/**
 * `true` when the element is still part of its document.
 *
 * Port of Ariakit's `isInDocument` (`use-hide-on-interact-outside.ts`): an
 * element unmounted right after it received focus fires its focus event when it
 * is already detached, and that event must be ignored.
 */
export const isInDocument = (element: Element): boolean => {
  if (element.tagName === 'HTML') return true
  return contains(element.ownerDocument.body, element)
}

const isElementNode = (value: unknown): value is Element =>
  !!value && (value as Node).nodeType === 1

/**
 * Every element an event passed through, innermost first.
 *
 * @remarks
 *   A listener on the document sees `event.target` retargeted to the _host_ of
 *   the shadow root the event came from, so the element the user really
 *   interacted with only appears in the composed path. Scanning the whole path
 *   is what lets a dialog — or a nested dialog, a disclosure, a focus-trap
 *   sentinel — rendered inside an open shadow root recognise its own events
 *   instead of dismissing itself (react-components 0.3.4, "interacting with
 *   elements returned by `getPersistentElements` across open shadow roots no
 *   longer closes the component before it receives focus").
 *
 *   Port of Ariakit's `getEventTargets` (`use-previous-mouse-down-ref.ts`)
 *   without its iframe host chain, which is a separate contract. A closed
 *   shadow root reports the retargeted path, so its internals stay private here
 *   too.
 * @returns The path, or the target alone for an event that has no
 *   `composedPath` (a synthetic one in a node test).
 */
export const getEventTargets = (event: Event): Array<Element> => {
  const path =
    typeof event.composedPath === 'function' ? event.composedPath() : []
  const elements = path.filter(isElementNode)
  if (elements.length) return elements
  return isElementNode(event.target) ? [event.target] : []
}

/**
 * `true` when the event target belongs to the dialog's disclosure element.
 *
 * Port of Ariakit's `isDisclosure` (`use-hide-on-interact-outside.ts`): a
 * composite disclosure (a combobox, say) keeps DOM focus on itself and points
 * at the active item with `aria-activedescendant`, so that item counts as part
 * of the disclosure too.
 */
export const isDisclosureTarget = (
  disclosure: Element | null,
  target: Element,
): boolean => {
  if (!disclosure) return false
  if (contains(disclosure, target)) return true

  const activeId = target.getAttribute?.('aria-activedescendant')
  if (!activeId) return false

  const active = disclosure.ownerDocument.getElementById(activeId)
  return !!active && contains(disclosure, active)
}

const claimedEscapes = new WeakSet<object>()

/**
 * Claims an Escape event for one dialog, and reports whether the claim
 * succeeded.
 *
 * @remarks
 *   Every mounted dialog listens for Escape on the document, and a nested dialog
 *   is usually rendered inside its parent, so a single key press reaches
 *   several dialogs. `topmost` alone is not enough to pick one: it is read from
 *   live atoms, and the innermost dialog closes _synchronously_ inside the
 *   event, so a handler that runs after it would see itself as topmost and
 *   close too.
 *
 *   Ariakit has the same problem and solves it with a DOM marker that its React
 *   state update outlives (`dialog.tsx`, `isElementMarked` /
 *   `mark-tree-outside.ts`). Claiming the event object is the same guarantee
 *   without a document-wide side effect, and it holds whichever order the
 *   listeners were attached in: a dialog that is not topmost bails on its own
 *   and leaves the claim to the one that is.
 * @param event - The Escape event, or nothing when it is triggered manually.
 * @returns `true` when the caller may act on the event.
 */
export const claimEscape = (event?: object | null): boolean => {
  if (!event) return true
  if (claimedEscapes.has(event)) return false
  claimedEscapes.add(event)
  return true
}

/** `true` when the element is a dialog backdrop. Port of Ariakit's `isBackdrop`. */
export const isBackdrop = (element: Element): boolean =>
  element.hasAttribute('data-backdrop')

/** `true` when the element is a focus-trap sentinel. */
export const isFocusTrap = (element: Element): boolean =>
  element.hasAttribute('data-focus-trap')

const IGNORED_TAGS = ['SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD']

/**
 * Walks every element that is outside `elements` but shares an ancestor with
 * them, from the innermost level up to `<body>`.
 *
 * @remarks
 *   Port of Ariakit's `walkTreeOutside` (`walk-tree-outside.ts`) without the
 *   document snapshot: for each kept element it visits the siblings of every
 *   ancestor, skipping branches that contain one of the kept elements. Elements
 *   whose ancestor is already in the list are not walked twice.
 * @param elements - The elements that must stay interactive.
 * @param callback - Called once per element outside them.
 */
export const walkTreeOutside = (
  elements: ReadonlyArray<Element | null>,
  callback: (element: Element) => void,
): void => {
  for (const kept of elements) {
    if (!kept?.isConnected) continue

    const hasAncestorAlready = elements.some(
      (candidate) =>
        candidate && candidate !== kept && candidate.contains(kept),
    )
    const body = kept.ownerDocument.body
    let element: Element = kept

    while (element.parentElement && element !== body) {
      if (!hasAncestorAlready) {
        for (const child of element.parentElement.children) {
          if (IGNORED_TAGS.includes(child.tagName)) continue
          // A branch containing a kept element must stay reachable.
          if (elements.some((entry) => entry && child.contains(entry))) continue
          callback(child)
        }
      }
      element = element.parentElement
    }
  }
}

/**
 * Makes an element and its subtree non-interactive, and returns the restore.
 *
 * @remarks
 *   `inert` does all of it in one property: no focus, no pointer events, and the
 *   subtree leaves the accessibility tree. The fallback for browsers without it
 *   is Ariakit's: hide the subtree from assistive technology and block the
 *   pointer, then drop every tabbable element out of the tab order
 *   (`disable-tree.ts`).
 */
export const disableTree = (element: Element): Restore => {
  if (!('style' in element)) return noop

  if (supportsInert()) {
    return setProperty(element as unknown as InertElement, 'inert', true)
  }

  const restores = getTabbableIn(element, true).flatMap((tabbable) => [
    setAttribute(tabbable, 'tabindex', '-1'),
    orchestrate(tabbable, 'focus', () => {
      const hadOwnFocus = Object.hasOwn(tabbable, 'focus')
      const previousFocus = tabbable.focus
      tabbable.focus = noop
      return () => {
        if (hadOwnFocus) tabbable.focus = previousFocus
        else Reflect.deleteProperty(tabbable, 'focus')
      }
    }),
  ])
  restores.push(
    setAttribute(element, 'aria-hidden', 'true'),
    assignStyle(element as HTMLElement, {
      pointerEvents: 'none',
      userSelect: 'none',
      cursor: 'default',
    }),
  )

  return () => {
    for (const restore of restores.reverse()) restore()
  }
}

/**
 * Makes everything outside `elements` non-interactive — the actual mechanism
 * behind a modal dialog.
 *
 * @remarks
 *   Backdrops and focus-trap sentinels are skipped: the backdrop must keep
 *   receiving the click that dismisses the dialog, and a sentinel must stay
 *   tabbable so Tab can wrap (`disable-tree.ts`).
 * @param elements - The dialog element, plus anything that must stay
 *   interactive: nested dialogs, backdrops, `getPersistentElements` in
 *   Ariakit's terms.
 */
export const disableTreeOutside = (
  elements: ReadonlyArray<Element | null>,
): Restore => {
  const restores: Array<Restore> = []

  walkTreeOutside(elements, (element) => {
    if (isBackdrop(element)) return
    if (isFocusTrap(element)) return
    restores.unshift(disableTree(element))
  })

  return () => {
    for (const restore of restores) restore()
  }
}

interface ScrollLock {
  count: number
  restore: Restore
}

const scrollLocks = new WeakMap<Document, ScrollLock>()

/** The `CSS` global, which the `Window` type does not declare. */
interface WindowWithCss extends Window {
  CSS?: Pick<typeof CSS, 'supports'>
}

/**
 * `true` for a computed `overflow` value that lets the scroll propagate to the
 * viewport.
 *
 * `happy-dom` and `jsdom` answer an empty string for an unset computed value
 * where a browser answers the `visible` keyword, so both count.
 */
const isOverflowVisible = (value: string): boolean =>
  !value || value === 'visible'

/**
 * Prevents the document from scrolling, keeping the scrollbar's space reserved
 * so the page does not shift.
 *
 * @remarks
 *   Ariakit elects a single "root" dialog through a
 *   `data-dialog-prevent-body-scroll` attribute on `<body>` and a
 *   `MutationObserver` that retries when it is released (`use-root-dialog.ts`),
 *   because a second lock would measure a scrollbar width of `0` and overwrite
 *   the first one's compensation. A reference count expresses the same rule
 *   directly: only the first lock applies, only the last release restores.
 *
 *   Three techniques, in the order Ariakit picks them
 *   (`use-prevent-body-scroll.ts`, `@ariakit/react-components` 0.3.2):
 *
 *   1. **Nothing to compensate** — overlay scrollbars, or a page that does not
 *        overflow: hiding the overflow cannot shift anything, so only
 *        `overflow: hidden` on `<body>` is needed.
 *   2. **`scrollbar-gutter: stable` on `<html>`**, plus hidden `overflow` on it. The
 *        gutter keeps the scrollbar's space while the hidden overflow removes
 *        the scrollbar, so neither in-flow content nor a `position: fixed`
 *        element moves. It has to go on `<html>`: the property applies to the
 *        viewport from there and does not propagate from `<body>`. A page that
 *        reserves the gutter itself keeps its own value — `both-edges`
 *        included.
 *   3. **The body-padding fallback** for a browser without `scrollbar-gutter`
 *        (Safari below 18.2): the removed scrollbar is compensated with padding
 *        on the side it was on — RTL documents keep it on the left
 *        (`getPaddingProperty`) — and its width is published as
 *        `--scrollbar-width` so a userland `position: fixed` element can
 *        compensate too.
 *
 *   `<html>` gets `overflow` hidden through the two longhands rather than the
 *   shorthand, so restoring keeps a longhand the page set itself (`overflow-y:
 *   scroll`). On techniques 1 and 3 that only happens when the page scrolls
 *   through `<html>` itself, in which case hiding the body overflow alone would
 *   not lock anything (ariakit#4345).
 * @param element - Any element in the document to lock, usually the dialog.
 */
export const lockBodyScroll = (element: Element): Restore => {
  const document = element.ownerDocument
  const lock = scrollLocks.get(document)

  if (lock) {
    lock.count++
    return () => {
      if (--lock.count === 0) {
        scrollLocks.delete(document)
        lock.restore()
      }
    }
  }

  const { documentElement, body } = document
  const view = document.defaultView
  const style = view?.getComputedStyle(documentElement)

  // The page may reserve the gutter itself, and then the scrollbar measures `0`
  // because `clientWidth` already includes the reserved space — so the computed
  // style, not the measurement, is what says the lock belongs on the gutter
  // technique. It also carries the author's keywords, which must survive.
  const gutter = style?.getPropertyValue('scrollbar-gutter') ?? ''
  const hasGutter = gutter.includes('stable')
  const scrollbarWidth = view
    ? view.innerWidth - documentElement.clientWidth
    : 0

  const restores: Array<Restore> = []

  const hideHtmlOverflow = () => {
    restores.push(
      setCssProperty(documentElement, 'overflow-x', 'hidden'),
      setCssProperty(documentElement, 'overflow-y', 'hidden'),
    )
  }

  /**
   * The page scrolls through `<html>` itself whenever its own overflow is not
   * visible, and then the body overflow no longer propagates to the viewport.
   */
  const hideHtmlOverflowIfItScrolls = () => {
    if (!style) return
    if (
      !isOverflowVisible(style.getPropertyValue('overflow-x')) ||
      !isOverflowVisible(style.getPropertyValue('overflow-y'))
    ) {
      hideHtmlOverflow()
    }
  }

  if (!hasGutter && !scrollbarWidth) {
    restores.push(assignStyle(body, { overflow: 'hidden' }))
    hideHtmlOverflowIfItScrolls()
  } else if (
    hasGutter ||
    !!(view as WindowWithCss | null)?.CSS?.supports(
      'scrollbar-gutter',
      'stable',
    )
  ) {
    restores.push(
      setCssProperty(
        documentElement,
        'scrollbar-gutter',
        hasGutter ? gutter : 'stable',
      ),
    )
    hideHtmlOverflow()
  } else {
    const scrollbarX =
      Math.round(documentElement.getBoundingClientRect().left) +
      documentElement.scrollLeft
    const paddingProperty = scrollbarX ? 'paddingLeft' : 'paddingRight'

    restores.push(
      setCssProperty(
        documentElement,
        '--scrollbar-width',
        `${scrollbarWidth}px`,
      ),
      assignStyle(body, {
        overflow: 'hidden',
        [paddingProperty]: `${scrollbarWidth}px`,
      }),
    )
    hideHtmlOverflowIfItScrolls()
  }

  const restore = () => {
    for (const undo of restores.reverse()) undo()
  }

  const created: ScrollLock = { count: 1, restore }
  scrollLocks.set(document, created)

  return () => {
    if (--created.count === 0) {
      scrollLocks.delete(document)
      restore()
    }
  }
}

/** Inline styles that hide an element visually but keep it in the a11y tree. */
export const VISUALLY_HIDDEN_STYLE = {
  border: '0px',
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: '0px',
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const satisfies Partial<CSSStyleDeclaration>

/**
 * Prepends a visually hidden dismiss button to a modal dialog.
 *
 * @remarks
 *   Without it a screen-reader user who reaches the end of a modal dialog has no
 *   way out, because everything outside is inert. Ariakit renders it only when
 *   the dialog has no `DialogDismiss` of its own
 *   (`prepend-hidden-dismiss.ts`).
 * @param container - The dialog element.
 * @param onClick - Called when the button is activated; wrap it with `wrap`.
 */
export const prependHiddenDismiss = (
  container: HTMLElement,
  onClick: () => unknown,
): Restore => {
  const button = container.ownerDocument.createElement('button')
  button.type = 'button'
  button.tabIndex = -1
  button.textContent = 'Dismiss popup'
  button.dataset.dialogHiddenDismiss = ''
  Object.assign(button.style, VISUALLY_HIDDEN_STYLE)

  button.addEventListener('click', onClick)
  container.prepend(button)

  return () => {
    button.removeEventListener('click', onClick)
    button.remove()
  }
}

/**
 * Resolves the element an opening dialog must focus.
 *
 * @remarks
 *   The candidate lookup for `pickDialogInitialFocus`: an explicit
 *   `initialFocus`, then `[data-autofocus=true]` / `[autofocus]` — Ariakit's
 *   `Focusable` consumes the native `autoFocus` prop and re-exposes it as the
 *   data attribute — then the first tabbable element, then the dialog itself,
 *   which is focusable through its `tabIndex={-1}`.
 */
export const resolveInitialFocus = (
  content: HTMLElement,
  initialFocus?: HTMLElement | null,
): HTMLElement => {
  if (initialFocus && isFocusable(initialFocus)) return initialFocus

  const autoFocus = content.querySelector<HTMLElement>(
    '[data-autofocus=true],[autofocus]',
  )
  if (autoFocus && isFocusable(autoFocus)) return autoFocus

  return getTabbableIn(content)[0] ?? content
}

/**
 * Resolves the element a closing dialog must restore focus to.
 *
 * @remarks
 *   Two Ariakit redirections, both from `focusOnHide` (`dialog.tsx`):
 *
 *   - When the target is an item of a composite widget that manages focus with
 *       `aria-activedescendant`, focus belongs on the composite element
 *       instead.
 *   - When the target is no longer focusable it usually sits inside another popup
 *       that closed with this dialog, so its own control (`aria-controls`) is
 *       tried next.
 */
export const resolveFinalFocus = (
  target: HTMLElement | null,
): HTMLElement | null => {
  if (!target) return null
  const document = target.ownerDocument

  if (target.id) {
    const composite = document.querySelector<HTMLElement>(
      `[aria-activedescendant="${target.id}"]`,
    )
    if (composite) return composite
  }

  if (!isFocusable(target)) {
    const parentDialog = target.closest('[data-dialog]')
    if (parentDialog?.id) {
      const control = document.querySelector<HTMLElement>(
        `[aria-controls~="${parentDialog.id}"]`,
      )
      if (control) return control
    }
  }

  return target
}

/**
 * `true` when focus already sits on a focusable element outside the dialog.
 *
 * Port of Ariakit's `isAlreadyFocusingAnotherElement` (`dialog.tsx`): the user
 * clicked or tabbed somewhere else while the dialog was closing, so restoring
 * focus would steal it back.
 */
export const isFocusOutsideDialog = (content: Element | null): boolean => {
  const active = content?.ownerDocument.activeElement ?? null
  if (!active) return false
  if (contains(content, active)) return false
  return isFocusable(active)
}
