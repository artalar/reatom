/**
 * Layer 2 for `dialog`: the reactive prop records.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/dialog/dialog.tsx`,
 * `dialog-backdrop.tsx`, `dialog-disclosure.tsx`, `dialog-dismiss.tsx`,
 * `dialog-heading.tsx`, `dialog-description.tsx`, and
 * `packages/ariakit-react-components/src/focus-trap/focus-trap.tsx`.
 */

import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import type {
  DisclosureButtonProps,
  DisclosureClickEvent,
} from '../disclosure/props'
import { disclosureProps, isDisclosureContentHidden } from '../disclosure/props'
import { isSelfTarget } from '../interactions/element'
import { claimEscape, getTabbableIn } from './dialogDom'
import { isDialogEscape, nextFocusTrapTarget } from './dialogIntent'
import type { DialogModel, DialogRole } from './reatomDialog'

/** Turns a model name into a DOM-safe `id` fragment. */
const domSafe = (name: string): string => name.replace(/[^\w-]+/g, '-')

/** Default `id` of the element that labels a dialog. */
export const dialogHeadingId = (name: string): string =>
  `${domSafe(name)}-heading`

/** Default `id` of the element that describes a dialog. */
export const dialogDescriptionId = (name: string): string =>
  `${domSafe(name)}-description`

/** The minimal shape of a keyboard event the dialog needs. */
export interface DialogKeyboardEvent {
  key: string
  defaultPrevented?: boolean
  /** `true` when a descendant already stopped the key from propagating. */
  cancelBubble?: boolean
  /**
   * Keeps a key the dialog acted on from reaching anything above it. Optional
   * so a plain object still satisfies the shape.
   */
  stopPropagation?: () => void
}

/** The minimal shape of a click event the backdrop and dismiss button need. */
export interface DialogClickEvent extends DisclosureClickEvent {
  /** The clicked element; a backdrop only reacts to a click on itself. */
  target?: EventTarget | null
}

/** The minimal shape of a focus event a focus-trap sentinel needs. */
export interface DialogFocusEvent {
  /** The element focus is coming from. */
  relatedTarget?: EventTarget | null
}

/** Props to spread on the button that opens the dialog. */
export interface DialogDisclosureProps extends DisclosureButtonProps {
  /**
   * Announces that the button opens a dialog. `alertdialog` has no
   * `aria-haspopup` token of its own, so it is announced as a dialog too —
   * Ariakit derives the same value with `getPopupRole(contentElement,
   * 'dialog')`.
   */
  'aria-haspopup': 'dialog'
}

/** Props to spread on the dialog element. */
export interface DialogContentProps {
  /**
   * Marks the element as a dialog. Used to find the control of an enclosing
   * dialog when focus is restored, and as a styling hook.
   */
  'data-dialog': ''
  id: string
  role: DialogRole
  /**
   * `aria-modal` is set for a modal dialog.
   *
   * @remarks
   *   Ariakit deliberately omits it and relies on `inert` alone, because
   *   `aria-modal` support is uneven. This port sets it, because its `inert`
   *   walk is a simplification of Ariakit's and `aria-modal` is what the ARIA
   *   Authoring Practices require of a modal dialog. Drop the key from the
   *   spread if you implement the inert background yourself.
   */
  'aria-modal': true | undefined
  'aria-label': string | undefined
  /** Set once the `heading` record's element is mounted. */
  'aria-labelledby': string | undefined
  /** Set once the `description` record's element is mounted. */
  'aria-describedby': string | undefined
  /** The dialog element itself is focusable, as the last focus fallback. */
  tabIndex: -1
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  'data-open': true | undefined
  /** Assigns the model's `contentElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
  /**
   * Closes the dialog on Escape pressed inside it, and stops the key there —
   * the dialog element is the boundary of its own Escape, so an outer widget
   * does not act on the press that closed this dialog. A press a nested widget
   * consumed never reaches this handler, and then the dialog stays open.
   *
   * `withDialogDismiss` listens on the document as well, which is what covers
   * Escape pressed while focus is outside the dialog.
   */
  onKeyDown: (event: DialogKeyboardEvent) => void
}

/** Props to spread on the backdrop element. */
export interface DialogBackdropProps {
  /**
   * Links the backdrop to its dialog, and marks it as an element that must stay
   * interactive while the background is inert.
   */
  'data-backdrop': string
  role: 'presentation'
  hidden: boolean
  style: DialogBackdropStyle | undefined
  'data-open': true | undefined
  /** Assigns the model's `backdropElement`-equivalent local handle. */
  ref: (element: HTMLElement | null) => void
  /** Dismisses the dialog when the backdrop itself is clicked. */
  onClick: (event?: DialogClickEvent) => void
}

/** The fixed full-viewport style Ariakit gives its backdrop. */
export interface DialogBackdropStyle {
  position: 'fixed'
  top: 0
  right: 0
  bottom: 0
  left: 0
  display?: 'none'
}

/** Props to spread on a button that closes the dialog. */
export interface DialogDismissProps {
  /**
   * Tells the modal layer that the dialog already has a dismiss button, so no
   * hidden one is prepended.
   */
  'data-dialog-dismiss': ''
  type: 'button'
  onClick: (event?: DialogClickEvent) => void
}

/** Props to spread on the dialog's heading or description element. */
export interface DialogLabelProps {
  id: string
  /**
   * Registers the element, which is what sets `aria-labelledby` /
   * `-describedby`.
   */
  ref: (element: HTMLElement | null) => void
}

/** Props to spread on the two focus-trap sentinels around a modal dialog. */
export interface DialogFocusTrapProps {
  /** Excludes the sentinel from the inert walk, like Ariakit's `FocusTrap`. */
  'data-focus-trap': string
  tabIndex: 0
  'aria-hidden': true
  /** Hidden — and therefore not tabbable — while focus is not trapped. */
  hidden: boolean
  style: DialogFocusTrapStyle
  onFocus: (event?: DialogFocusEvent) => void
}

/**
 * A visually hidden but tabbable sentinel. `position: fixed` prevents the
 * unintended scroll jump Ariakit documents in `focus-trap.tsx`.
 */
export interface DialogFocusTrapStyle {
  position: 'fixed'
  top: 0
  left: 0
}

/** Reactive prop records of a dialog model. */
export interface DialogPropRecords {
  /** The button that opens the dialog. */
  disclosure: Computed<DialogDisclosureProps>
  /** The dialog element. */
  content: Computed<DialogContentProps>
  /** The backdrop behind the dialog. */
  backdrop: Computed<DialogBackdropProps>
  /** A button that closes the dialog. */
  dismiss: Computed<DialogDismissProps>
  /** The element that labels the dialog. */
  heading: Computed<DialogLabelProps>
  /** The element that describes the dialog. */
  description: Computed<DialogLabelProps>
  /**
   * One record for both sentinels: render it before and after the dialog
   * element. Which way focus wraps is decided from the event, exactly like
   * Ariakit's `FocusTrapRegion`, so the two sentinels share one handler.
   */
  focusTrap: Computed<DialogFocusTrapProps>
}

/** Options of {@link dialogProps} and {@link withDialogProps}. */
export interface DialogPropsOptions {
  /**
   * Keeps the dialog element visible even when it is not mounted, so a
   * third-party animation library can run its own exit transition.
   *
   * @default false
   */
  alwaysVisible?: boolean
  /**
   * Forces the `hidden` prop. `true` hides the dialog even while mounted,
   * `false` never hides it.
   */
  hidden?: boolean
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/**
 * Builds the reactive prop records of a dialog model.
 *
 * @remarks
 *   Each record is a `computed` returning a plain object: memoized, lazy,
 *   traceable by name, and neutral about the view library. Handlers are
 *   `wrap`ped so the state change is attributed to the DOM event in the logger,
 *   and call `notify()` so a host framework sees the update in the same tick.
 *
 *   The records are enough for a working non-modal dialog on their own. A modal
 *   one additionally needs the document-level behaviors of
 *   `reatomDialogDom.ts`: Escape from anywhere, outside clicks, the inert
 *   background, the scroll lock, and focus restoration.
 * @example
 *   const dialog = reatomDialog({ name: 'confirm' })
 *
 *   dialog.props.content() // { role: 'dialog', hidden: true, ... }
 *   dialog.props.disclosure().onClick()
 *   dialog.props.content().hidden // false
 */
export const dialogProps = (
  model: DialogModel,
  options: DialogPropsOptions = {},
): DialogPropRecords => {
  const { alwaysVisible, hidden: hiddenProp, name = model.name } = options
  // The disclosure button contract is identical, so it is reused rather than
  // reimplemented: `aria-expanded`, `aria-controls`, the toggle, and the
  // `disclosureElement` bookkeeping all come from there.
  const disclosure = disclosureProps(model, { name })

  const headingId = dialogHeadingId(name)
  const descriptionId = dialogDescriptionId(name)

  const isHidden = () =>
    isDisclosureContentHidden(model.mounted(), hiddenProp, alwaysVisible)

  return {
    disclosure: computed(
      (): DialogDisclosureProps => ({
        ...disclosure.button(),
        'aria-haspopup': 'dialog',
      }),
      `${name}.props.disclosure`,
    ),

    content: computed((): DialogContentProps => {
      const label = model.label()
      // Read unconditionally: a conditional read would drop the dependency and
      // leave `aria-labelledby` stale after the label is removed.
      const labelledBy = model.headingId()
      const hidden = isHidden()

      return {
        'data-dialog': '',
        id: model.contentId(),
        role: model.role(),
        'aria-modal': model.modal() || undefined,
        'aria-label': label ?? undefined,
        // Ariakit drops `aria-labelledby` when an explicit label is given, so
        // the two never compete (`dialog.tsx`).
        'aria-labelledby': (label == null ? labelledBy : null) ?? undefined,
        'aria-describedby': model.descriptionId() ?? undefined,
        tabIndex: -1,
        hidden,
        style: hidden ? { display: 'none' } : undefined,
        'data-open': model() || undefined,
        ref: wrap((element: HTMLElement | null) => {
          model.contentElement.set(element)
        }),
        onKeyDown: wrap((event: DialogKeyboardEvent) => {
          if (
            !isDialogEscape({
              key: event.key,
              defaultPrevented: event.defaultPrevented,
              // The event reached the dialog element, so nothing below it
              // consumed the key — unless a capture handler above did.
              propagationStopped: event.cancelBubble,
              enabled: model.hideOnEscape(),
              topmost: model.topmost(),
              insideContent: true,
            })
          ) {
            return
          }
          // The same key press bubbles through every dialog it is nested in.
          if (!claimEscape(event)) return
          // The dialog element is the boundary of its own Escape, so an outer
          // widget does not act on the press that closed this dialog
          // (`dialog.tsx`: `onKeyDown` calls `event.stopPropagation()` once
          // `hideOnEscapeEvent` accepted the key).
          event.stopPropagation?.()
          model.dismiss('escape')
          notify()
        }),
      }
    }, `${name}.props.content`),

    backdrop: computed((): DialogBackdropProps => {
      const hidden = isHidden()

      return {
        'data-backdrop': model.contentId(),
        role: 'presentation',
        hidden,
        style: hidden
          ? {
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              display: 'none',
            }
          : { position: 'fixed', top: 0, right: 0, bottom: 0, left: 0 },
        'data-open': model() || undefined,
        ref: wrap((element: HTMLElement | null) => {
          model.backdropElement.set(element)
        }),
        onClick: wrap((event?: DialogClickEvent) => {
          if (event?.defaultPrevented) return
          if (!model.hideOnInteractOutside()) return
          // A click bubbling up from the dialog itself is not an outside click.
          if (
            event &&
            !isSelfTarget({
              target: event.target,
              currentTarget: event.currentTarget,
            })
          ) {
            return
          }
          model.dismiss('outside')
          notify()
        }),
      }
    }, `${name}.props.backdrop`),

    dismiss: computed(
      (): DialogDismissProps => ({
        'data-dialog-dismiss': '',
        type: 'button',
        onClick: wrap((event?: DialogClickEvent) => {
          if (event?.defaultPrevented) return
          model.dismiss('button')
          notify()
        }),
      }),
      `${name}.props.dismiss`,
    ),

    heading: computed(
      (): DialogLabelProps => ({
        id: model.headingId() ?? headingId,
        ref: wrap((element: HTMLElement | null) => {
          model.headingId.set(element ? element.id || headingId : null)
        }),
      }),
      `${name}.props.heading`,
    ),

    description: computed(
      (): DialogLabelProps => ({
        id: model.descriptionId() ?? descriptionId,
        ref: wrap((element: HTMLElement | null) => {
          model.descriptionId.set(element ? element.id || descriptionId : null)
        }),
      }),
      `${name}.props.description`,
    ),

    focusTrap: computed(
      (): DialogFocusTrapProps => ({
        'data-focus-trap': model.contentId(),
        tabIndex: 0,
        'aria-hidden': true,
        hidden: !model.focusTrapped(),
        style: { position: 'fixed', top: 0, left: 0 },
        onFocus: wrap((event?: DialogFocusEvent) => {
          const content = model.contentElement()
          if (!content) return

          const tabbables = getTabbableIn(content)
          const target = nextFocusTrapTarget(
            tabbables.length,
            !!event && event.relatedTarget === tabbables[0],
          )
          const element =
            target === 'container'
              ? content
              : target === 'first'
                ? tabbables[0]
                : tabbables.at(-1)

          element?.focus()
          notify()
        }),
      }),
      `${name}.props.focusTrap`,
    ),
  }
}

/**
 * Attaches {@link dialogProps} to a dialog model as `model.props`.
 *
 * {@link reatomDialog} applies it already; use it explicitly for models built
 * from an adopted atom with `withDialog`.
 *
 * @example
 *   const open = atom(false, 'checkout.open')
 *   const checkout = open
 *     .extend(withDialog())
 *     .extend(withDialogProps({ alwaysVisible: true }))
 */
export const withDialogProps = (
  options: DialogPropsOptions = {},
): AssignerExt<{ props: DialogPropRecords }, DialogModel> => {
  return (target) => ({ props: dialogProps(target, options) })
}
