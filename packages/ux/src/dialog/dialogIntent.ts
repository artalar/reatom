/**
 * Pure dismissal and focus policy for `dialog`.
 *
 * Layer 1 (pure). Ariakit inlines these decisions in React effects that read
 * live DOM nodes (`ariakit-react-components/src/dialog/dialog.tsx`,
 * `.../utils/use-hide-on-interact-outside.ts`,
 * `ariakit-react-components/src/focus-trap/focus-trap-region.tsx`). Here every
 * decision is reduced to a plain-data predicate, so the whole policy is
 * node-testable and the DOM layer only has to describe what it sees.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC).
 */

/** Why the dialog closed. `'outside'` suppresses focus restoration. */
export type DialogDismissIntent =
  | 'programmatic'
  | 'button'
  | 'escape'
  | 'outside'

/** Plain-data snapshot of an Escape keypress and the dialog it may close. */
export interface DialogEscapeContext {
  /** `event.key`. */
  key: string
  /** Another handler already handled the key. */
  defaultPrevented?: boolean
  /** The model's `hideOnEscape` flag. */
  enabled: boolean
  /**
   * `true` when no nested dialog of this one is open. Ariakit guarantees the
   * same by marking the elements outside the innermost dialog and bailing out
   * when the dialog itself is marked, so only the topmost one closes
   * (`dialog.tsx`: "Ignore the event if the current dialog is marked by another
   * dialog").
   */
  topmost: boolean
  /** The event target is `<body>` — nothing inside the page has focus. */
  bodyTarget?: boolean
  /** The event target is the dialog element or one of its descendants. */
  insideContent?: boolean
  /** A disclosure element is known for this dialog. */
  hasDisclosure?: boolean
  /** The event target is the disclosure element or one of its descendants. */
  insideDisclosure?: boolean
}

/**
 * Whether an Escape keypress must close the dialog.
 *
 * @remarks
 *   Ariakit listens on the document, so the key works even when the dialog is not
 *   focused, and then filters the target: only `<body>`, the dialog subtree, or
 *   the disclosure subtree may close it — a keypress inside an unrelated widget
 *   must not (`dialog.tsx`, `isValidTarget`).
 * @example
 *   isDialogEscape({ key: 'Escape', enabled: true, topmost: true }) // false — no valid target
 *   isDialogEscape({
 *     key: 'Escape',
 *     enabled: true,
 *     topmost: true,
 *     bodyTarget: true,
 *   }) // true
 */
export const isDialogEscape = (context: DialogEscapeContext): boolean => {
  if (context.key !== 'Escape') return false
  if (context.defaultPrevented) return false
  if (!context.enabled) return false
  if (!context.topmost) return false

  if (context.bodyTarget) return true
  if (context.insideContent) return true
  // Without a known disclosure element every remaining target is accepted,
  // matching Ariakit's `if (!disclosureElement) return true`.
  if (!context.hasDisclosure) return true
  return !!context.insideDisclosure
}

/** Plain-data snapshot of an interaction that may have happened outside. */
export interface DialogOutsideContext {
  /**
   * The target is still connected to the document. An element unmounted right
   * after it received focus fires its focus event when it is already detached,
   * and Ariakit ignores that (`use-hide-on-interact-outside.ts`,
   * `isInDocument`).
   */
  inDocument?: boolean
  /** The target is the dialog element or one of its descendants. */
  insideContent?: boolean
  /**
   * The target belongs to a dialog nested in this one, or to its backdrop. A
   * nested dialog is part of this dialog's modal context even when it is
   * rendered elsewhere in the document, so focusing or clicking it must not
   * close the dialog it is nested in.
   *
   * Ariakit gets this for free from the tree snapshot it marks when the dialog
   * opens: a nested dialog is inside the branch that was kept, so its elements
   * are never marked as outside (`use-hide-on-interact-outside.ts`,
   * `isElementMarked`).
   */
  onNestedDialog?: boolean
  /**
   * The target is the disclosure element, one of its descendants, or the item
   * it points at with `aria-activedescendant`.
   */
  onDisclosure?: boolean
  /** The target carries `data-focus-trap`. */
  onFocusTrap?: boolean
  /**
   * The pointer coordinates fall inside the dialog's bounding box. A click on a
   * transparent overlay that visually sits on top of the dialog is not an
   * outside click (`isMouseEventOnDialog`).
   */
  onContentBox?: boolean
}

/**
 * Whether an event happened outside the dialog.
 *
 * @remarks
 *   Shared by the `click`, `focusin`, and `contextmenu` listeners, exactly like
 *   Ariakit's `useEventOutside`.
 *
 *   Ariakit adds one more guard that this port drops: it snapshots and marks the
 *   element tree that was outside the dialog when it opened, and ignores
 *   targets that are not marked, so nodes appended later (toasts, third-party
 *   dialogs) cannot close it. The snapshot is a document-wide side effect; the
 *   nested stack of {@link reatomDialog} covers the case it was mostly needed
 *   for.
 */
export const isDialogInteractionOutside = (
  context: DialogOutsideContext,
): boolean => {
  if (context.inDocument === false) return false
  if (context.insideContent) return false
  if (context.onNestedDialog) return false
  if (context.onDisclosure) return false
  if (context.onFocusTrap) return false
  if (context.onContentBox) return false
  return true
}

/** Plain-data snapshot of a click that may dismiss the dialog. */
export interface DialogOutsideClickContext extends DialogOutsideContext {
  /** A `mousedown` was seen since the dialog opened. */
  pressed?: boolean
  /** That `mousedown` happened outside the dialog. */
  pressedOutside?: boolean
}

/**
 * Whether an outside click must dismiss the dialog.
 *
 * @remarks
 *   The press origin decides, not the release:
 *
 *   - No press at all means the dialog was opened by the very `mousedown` whose
 *       `click` is being handled now, so the click is ignored (Ariakit: "the
 *       dialog opened with a mousedown event, and a subsequent click event was
 *       dispatched outside of the dialog").
 *   - A press that started inside is a drag out of the dialog — selecting text and
 *       releasing outside must not close it
 *       ([ariakit#1336](https://github.com/ariakit/ariakit/issues/1336),
 *       [ariakit#2330](https://github.com/ariakit/ariakit/issues/2330)).
 */
export const isDialogOutsideClick = (
  context: DialogOutsideClickContext,
): boolean => {
  if (!isDialogInteractionOutside(context)) return false
  if (!context.pressed) return false
  return !!context.pressedOutside
}

/** Which element a focus-trap sentinel must hand the focus to. */
export type DialogFocusTrapTarget = 'first' | 'last' | 'container'

/**
 * Where focus goes when a focus-trap sentinel receives it.
 *
 * @remarks
 *   Port of the `onFocus` handler of Ariakit's `FocusTrapRegion`
 *   (`focus-trap-region.tsx`): focus arriving from the first tabbable element
 *   means the user pressed Shift+Tab at the top of the dialog and must land on
 *   the last one; anything else wraps to the first. An empty dialog keeps focus
 *   on the dialog element itself.
 * @param tabbableCount - Tabbable elements inside the dialog.
 * @param fromFirstTabbable - The focus came from the first tabbable element.
 */
export const nextFocusTrapTarget = (
  tabbableCount: number,
  fromFirstTabbable: boolean,
): DialogFocusTrapTarget => {
  if (tabbableCount === 0) return 'container'
  return fromFirstTabbable ? 'last' : 'first'
}

/** Which element receives focus when the dialog opens. */
export type DialogInitialFocusTarget =
  | 'initialFocus'
  | 'autoFocus'
  | 'firstTabbable'
  | 'content'

/** Which of the initial-focus candidates the DOM layer actually found. */
export interface DialogInitialFocusCandidates {
  /** A focusable `initialFocus` element was provided. */
  initialFocus?: boolean
  /** The dialog contains `[data-autofocus=true]` or `[autofocus]`. */
  autoFocus?: boolean
  /** The dialog contains at least one tabbable element. */
  firstTabbable?: boolean
}

/**
 * Picks the initial focus target of an opening dialog.
 *
 * @remarks
 *   Ariakit's four-step fallback (`dialog.tsx`, "Auto focus on show"): the
 *   explicit `initialFocus`, then an element that asked for autofocus, then the
 *   first tabbable element, and finally the dialog element itself — which is
 *   focusable because the dialog carries `tabIndex={-1}`.
 *
 *   The first-tabbable step also exists for portaled dialogs with
 *   `preserveTabOrder`, whose elements only become tabbable once the dialog
 *   itself has focus.
 */
export const pickDialogInitialFocus = (
  candidates: DialogInitialFocusCandidates,
): DialogInitialFocusTarget => {
  if (candidates.initialFocus) return 'initialFocus'
  if (candidates.autoFocus) return 'autoFocus'
  if (candidates.firstTabbable) return 'firstTabbable'
  return 'content'
}

/** What the focus-restore flow should do with the element it resolved. */
export type DialogFinalFocusIntent = 'focus' | 'retry' | 'skip'

/** Plain-data snapshot of the state a closing dialog restores focus from. */
export interface DialogFinalFocusContext {
  /** The model's `autoFocusOnHide` flag. */
  enabled: boolean
  /**
   * The dialog was closed by clicking or right-clicking outside. Native
   * `<dialog>` and popovers do not move focus back to the trigger then, so the
   * restore is skipped (`dialog.tsx`, `interactedOutsideRef`).
   */
  interactedOutside?: boolean
  /**
   * Focus already moved to a focusable element outside the dialog — the user
   * clicked or tabbed somewhere while the dialog was hiding
   * (`isAlreadyFocusingAnotherElement`).
   */
  focusMovedElsewhere?: boolean
  /** A restore target (`finalFocus`, or the disclosure element) is known. */
  hasTarget?: boolean
  /** That target can receive focus right now. */
  targetFocusable?: boolean
  /**
   * Another attempt is still allowed. Ariakit retries once on the next frame,
   * because a nested dialog may still need a tick to drop the `inert` attribute
   * from the elements outside it.
   */
  canRetry?: boolean
}

/**
 * Whether a closing dialog restores focus, waits a frame, or gives up.
 *
 * Port of Ariakit's `focusOnHide` (`dialog.tsx`).
 */
export const nextDialogFinalFocus = (
  context: DialogFinalFocusContext,
): DialogFinalFocusIntent => {
  if (!context.enabled) return 'skip'
  if (context.interactedOutside) return 'skip'
  if (context.focusMovedElsewhere) return 'skip'
  if (!context.hasTarget || !context.targetFocusable) {
    return context.canRetry ? 'retry' : 'skip'
  }
  return 'focus'
}
