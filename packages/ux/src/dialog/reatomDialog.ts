/**
 * Layer 1 for `dialog`: the model.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-components/src/dialog/dialog-store.ts` and the policy
 * Ariakit keeps in `packages/ariakit-react-components/src/dialog/*`.
 */

import type { Action, AssignerExt, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  ifChanged,
  named,
  peek,
  withComputed,
} from '@reatom/core'

import type {
  DisclosureExtOptions,
  DisclosureUnits,
} from '../disclosure/reatomDisclosure'
import { withDisclosure } from '../disclosure/reatomDisclosure'
import type { DialogDismissIntent } from './dialogIntent'
import type { DialogPropRecords, DialogPropsOptions } from './props'
import { withDialogProps } from './props'

/**
 * The ARIA role of the dialog element.
 *
 * `'alertdialog'` is for a dialog that interrupts the user with an urgent
 * message; it must contain a description and is expected to keep focus until
 * answered. Ariakit has no store flag for it — the role is passed as a prop —
 * but the model owns every attribute of the dialog element, so it lives here.
 */
export type DialogRole = 'dialog' | 'alertdialog'

/** Options accepted by both {@link reatomDialog} and {@link withDialog}. */
export interface DialogExtOptions extends DisclosureExtOptions {
  /**
   * The role of the dialog element.
   *
   * @default 'dialog'
   */
  role?: DialogRole
  /**
   * Whether the dialog is modal: the element tree outside it becomes inert,
   * focus is trapped inside, body scrolling is prevented, and a visually hidden
   * dismiss button is rendered for screen-reader users.
   *
   * @default true
   */
  modal?: boolean
  /**
   * Whether a backdrop element is rendered behind the dialog. Defaults to
   * `modal`, and keeps following it unless it is set explicitly.
   */
  backdrop?: boolean
  /**
   * Whether body scrolling is prevented while the dialog is mounted. Defaults
   * to `modal`, and keeps following it unless it is set explicitly.
   */
  preventBodyScroll?: boolean
  /**
   * Whether the Escape key closes the dialog.
   *
   * @default true
   */
  hideOnEscape?: boolean
  /**
   * Whether clicking, right-clicking, or focusing outside the dialog closes it.
   *
   * @default true
   */
  hideOnInteractOutside?: boolean
  /**
   * Whether an element inside the dialog receives focus when it opens.
   *
   * @default true
   */
  autoFocusOnShow?: boolean
  /**
   * Whether the disclosure element (or `finalFocus`) receives focus when the
   * dialog closes.
   *
   * @default true
   */
  autoFocusOnHide?: boolean
  /**
   * An accessible name rendered as `aria-label`. Takes precedence over
   * `headingId`, matching Ariakit's `props['aria-label'] != null ? undefined :
   * headingId`.
   */
  label?: string
  /**
   * The `id` of the element that labels the dialog. Usually assigned by the
   * `heading` prop record instead of being passed here.
   */
  headingId?: string
  /**
   * The `id` of the element that describes the dialog. Usually assigned by the
   * `description` prop record instead of being passed here.
   */
  descriptionId?: string
  /**
   * The dialog this one is nested in. The child registers itself in the parent
   * on creation, which is what makes `topmost` (Escape) and the inert walk (the
   * parent must not disable its child) work.
   */
  parent?: DialogModel
}

/** Options of the {@link reatomDialog} factory. */
export interface DialogOptions extends DialogExtOptions, DialogPropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead, extend it with
   * {@link withDialog}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withDialog}, on top of the disclosure ones. */
export interface DialogUnits extends DisclosureUnits {
  /** The ARIA role of the dialog element. */
  role: Atom<DialogRole>
  /** Whether the dialog is modal. */
  modal: Atom<boolean>
  /** Whether a backdrop element is rendered. Follows `modal` by default. */
  backdrop: Atom<boolean>
  /**
   * The backdrop element, assigned from the `backdrop` prop record's `ref`. It
   * must stay interactive while the background is inert, otherwise a click on
   * it could not dismiss the dialog.
   */
  backdropElement: Atom<HTMLElement | null>
  /** Whether body scrolling is prevented. Follows `modal` by default. */
  preventBodyScroll: Atom<boolean>
  /** Whether the Escape key closes the dialog. */
  hideOnEscape: Atom<boolean>
  /** Whether an interaction outside the dialog closes it. */
  hideOnInteractOutside: Atom<boolean>
  /** Whether the dialog moves focus into itself when it opens. */
  autoFocusOnShow: Atom<boolean>
  /** Whether the dialog restores focus when it closes. */
  autoFocusOnHide: Atom<boolean>
  /**
   * The element to focus when the dialog opens. `null` runs the fallback chain
   * of `pickDialogInitialFocus`.
   */
  initialFocus: Atom<HTMLElement | null>
  /**
   * The element to focus when the dialog closes. `null` falls back to
   * `disclosureElement`.
   */
  finalFocus: Atom<HTMLElement | null>
  /** The `aria-label` of the dialog element. */
  label: Atom<string | null>
  /** The `id` of the labelling element, assigned by the `heading` record. */
  headingId: Atom<string | null>
  /** The `id` of the describing element, assigned by the `description` record. */
  descriptionId: Atom<string | null>
  /** The dialog this one is nested in, or `null` for a root dialog. */
  parent: DialogModel | null
  /**
   * The dialogs nested directly in this one, open or not — the structure of the
   * stack. Filled by {@link DialogUnits.register}.
   */
  children: Atom<ReadonlyArray<DialogModel>>
  /**
   * Every _open_ dialog below this one, depth first. Ariakit keeps the same
   * list in React state and maintains it with a chain of `context.add` calls
   * from a layout effect (`utils/use-nested-dialogs.tsx`); here it is a
   * derivation of the stack structure and the `open` atoms, so it needs no
   * lifecycle and is correct before anything is subscribed.
   */
  nestedDialogs: Computed<ReadonlyArray<DialogModel>>
  /**
   * `true` while no nested dialog is open, so this one is the innermost of its
   * tree. Only the topmost dialog reacts to Escape.
   */
  topmost: Computed<boolean>
  /**
   * `true` while focus must not leave the dialog: it is modal and open. Also
   * the condition for making the element tree outside it inert.
   */
  focusTrapped: Computed<boolean>
  /** `true` while body scrolling must be prevented. */
  scrollLocked: Computed<boolean>
  /** Why the dialog was closed last. Resets to `null` whenever it opens. */
  dismissIntent: Atom<DialogDismissIntent | null>
  /**
   * `true` when the last close came from an interaction outside the dialog, in
   * which case focus is not restored to the disclosure element.
   */
  interactedOutside: Computed<boolean>
  /**
   * Adopts a dialog as a direct child of this one and returns the function that
   * detaches it again. Passing `parent` to {@link withDialog} calls it for you.
   */
  register: Action<[dialog: DialogModel], () => void>
  /**
   * Detaches the dialog from its `parent`. A no-op for a root dialog, and for a
   * child that was already detached. Call it when a dynamically created nested
   * dialog is thrown away, so its parent does not keep it alive.
   */
  unregister: Action<[], void>
  /**
   * Closes the dialog, recording why. The intent is what tells the focus layer
   * whether to restore focus, so prefer it over `hide()` for user-driven
   * closes.
   */
  dismiss: Action<[intent?: DialogDismissIntent], false>
}

/** A boolean atom extended with the dialog behavior. */
export interface DialogModel extends Atom<boolean>, DialogUnits {}

/**
 * The model returned by {@link reatomDialog}: {@link DialogModel} plus prop
 * records.
 */
export interface Dialog extends DialogModel {
  /** Reactive prop records for the dialog's elements. */
  props: DialogPropRecords
}

/**
 * Derives a flag from `modal` while keeping it writable, which is how Ariakit's
 * `portal = modal` / `backdrop = modal` / `preventBodyScroll = modal` prop
 * defaults behave: they follow `modal` until the caller passes a value.
 */
const modalDefaulted = (
  init: boolean | undefined,
  modal: Atom<boolean>,
  name: string,
): Atom<boolean> => {
  const flag = atom(init ?? peek(modal), name)
  return init === undefined ? flag.extend(withComputed(() => modal())) : flag
}

/**
 * Adds the dialog behavior to an existing boolean atom.
 *
 * @remarks
 *   The extension applies {@link withDisclosure} itself — Ariakit's
 *   `createDialogStore` is literally `createDisclosureStore`, so a dialog _is_
 *   a disclosure — and adds what the dialog needs on top: the modal flags, the
 *   focus handles, the dismissal policy flags, and the nested-dialog stack. Do
 *   not extend the same atom with `withDisclosure` first; `extend` refuses to
 *   overwrite existing members.
 *
 *   A `parent` is joined on creation and left on `unregister()` — the stack is
 *   structure, not lifecycle, so `topmost` is right before anything subscribes.
 *   A dialog created per list item therefore outlives its item unless it
 *   `unregister()`s.
 * @example
 *   // a route search param that drives a modal
 *   const open = atom(false, 'checkout.open')
 *   const checkout = open.extend(withDialog({ role: 'alertdialog' }))
 *
 * @see {@link reatomDialog} for the batteries-included factory.
 */
export const withDialog = (
  options: DialogExtOptions = {},
): AssignerExt<DialogUnits, Atom<boolean>> => {
  const {
    role: initRole = 'dialog',
    modal: initModal = true,
    backdrop: initBackdrop,
    preventBodyScroll: initPreventBodyScroll,
    hideOnEscape: initHideOnEscape = true,
    hideOnInteractOutside: initHideOnInteractOutside = true,
    autoFocusOnShow: initAutoFocusOnShow = true,
    autoFocusOnHide: initAutoFocusOnHide = true,
    label: initLabel,
    headingId: initHeadingId,
    descriptionId: initDescriptionId,
    parent = null,
    ...disclosureOptions
  } = options

  return (target) => {
    const { name } = target
    const disclosure = withDisclosure(disclosureOptions)(target)

    const modal = atom(initModal, `${name}.modal`)
    const preventBodyScroll = modalDefaulted(
      initPreventBodyScroll,
      modal,
      `${name}.preventBodyScroll`,
    )
    const children = atom<ReadonlyArray<DialogModel>>([], `${name}.children`)

    // Ariakit resets the flag from a `sync(store, ['open'])` listener so a
    // prevented close, an animated close, or a disabled `autoFocusOnHide` can
    // not leave a stale value behind (`dialog.tsx`, `interactedOutsideRef`).
    // Here the reset is part of the derivation instead of a listener.
    const dismissIntent = atom<DialogDismissIntent | null>(
      null,
      `${name}.dismissIntent`,
    ).extend(
      withComputed((state) => {
        let opened = false
        ifChanged(target, (isOpen, _prev, isFirst) => {
          opened = !isFirst && isOpen
        })
        return opened ? null : state
      }),
    )
    // Anchor the first frame, like `withDisclosure` does for `animating`: an
    // atom pulled for the first time has no previous `open` to diff against.
    peek(dismissIntent)

    const register = action((dialog: DialogModel) => {
      children.set((dialogs) => [...dialogs, dialog])
      return () =>
        children.set((dialogs) => dialogs.filter((entry) => entry !== dialog))
    }, `${name}.register`)

    const nestedDialogs = computed(() => {
      const open: Array<DialogModel> = []

      for (const child of children()) {
        if (child()) open.push(child)
        // Ariakit chains `context.add` up the tree, so a grandchild is known to
        // the grandparent even when the dialog in between is closed. Recursing
        // through the child's own derivation is the same reach without the
        // bookkeeping.
        open.push(...child.nestedDialogs())
      }

      return open
    }, `${name}.nestedDialogs`)

    // `register` only stores the reference, so calling it before `extend` has
    // assigned these units is safe: the parent derivation reads the child's
    // atoms lazily, long after the model is complete.
    const detach = parent?.register(target as unknown as DialogModel)

    return {
      ...disclosure,
      role: atom(initRole, `${name}.role`),
      modal,
      backdrop: modalDefaulted(initBackdrop, modal, `${name}.backdrop`),
      backdropElement: atom<HTMLElement | null>(
        null,
        `${name}.backdropElement`,
      ),
      preventBodyScroll,
      hideOnEscape: atom(initHideOnEscape, `${name}.hideOnEscape`),
      hideOnInteractOutside: atom(
        initHideOnInteractOutside,
        `${name}.hideOnInteractOutside`,
      ),
      autoFocusOnShow: atom(initAutoFocusOnShow, `${name}.autoFocusOnShow`),
      autoFocusOnHide: atom(initAutoFocusOnHide, `${name}.autoFocusOnHide`),
      initialFocus: atom<HTMLElement | null>(null, `${name}.initialFocus`),
      finalFocus: atom<HTMLElement | null>(null, `${name}.finalFocus`),
      label: atom(initLabel ?? null, `${name}.label`),
      headingId: atom(initHeadingId ?? null, `${name}.headingId`),
      descriptionId: atom(initDescriptionId ?? null, `${name}.descriptionId`),
      parent,
      children,
      nestedDialogs,
      topmost: computed(() => nestedDialogs().length === 0, `${name}.topmost`),
      focusTrapped: computed(() => {
        // Both reads are unconditional so neither dependency can be dropped.
        const isModal = modal()
        const isOpen = target()
        return isModal && isOpen
      }, `${name}.focusTrapped`),
      scrollLocked: computed(() => {
        const prevent = preventBodyScroll()
        const isMounted = disclosure.mounted()
        return prevent && isMounted
      }, `${name}.scrollLocked`),
      dismissIntent,
      interactedOutside: computed(
        () => dismissIntent() === 'outside',
        `${name}.interactedOutside`,
      ),
      register,
      unregister: action(() => void detach?.(), `${name}.unregister`),
      dismiss: action((intent: DialogDismissIntent = 'programmatic') => {
        dismissIntent.set(intent)
        return target.set(false) as false
      }, `${name}.dismiss`),
    }
  }
}

/**
 * Creates a dialog model: a disclosure that also knows whether it is modal,
 * which element to focus, when to dismiss itself, and where it sits in a stack
 * of nested dialogs.
 *
 * @remarks
 *   Ariakit's `createDialogStore` adds nothing to `createDisclosureStore`
 *   (`ariakit-components/src/dialog/dialog-store.ts` is 26 lines, all types),
 *   so everything valuable about a dialog lives in its DOM behavior. This port
 *   keeps that behavior's _policy_ in the model — as flags, element handles,
 *   and the nested stack — and leaves only the DOM plumbing to
 *   `reatomDialogDom.ts`, which makes the whole dialog contract testable
 *   without a browser.
 * @example
 *   const confirm = reatomDialog({ name: 'confirm' })
 *
 *   confirm.show()
 *   confirm.topmost() // true
 *   confirm.dismiss('escape')
 *   confirm() // false
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <button $spread={confirm.props.disclosure}>Delete</button>
 *   <div $spread={confirm.props.backdrop} />
 *   <div $spread={confirm.props.content}>
 *   <h1 $spread={confirm.props.heading}>Are you sure?</h1>
 *   <button $spread={confirm.props.dismiss}>Cancel</button>
 *   </div>
 *   </>
 *
 * @example
 *   // a nested dialog, plus the DOM behaviors a modal one needs
 *   const settings = reatomDialog({ name: 'settings' }).extend(
 *     withDialogDom(),
 *   )
 *   const reset = reatomDialog({
 *     parent: settings,
 *     role: 'alertdialog',
 *     name: 'settings.reset',
 *   }).extend(withDialogDom())
 *
 *   settings.show()
 *   reset.show()
 *   settings.topmost() // false — Escape closes `reset` first
 *
 * @see https://ariakit.com/components/dialog
 */
export const reatomDialog = (options: DialogOptions = {}): Dialog => {
  const {
    open: initOpen = false,
    name = named('dialog'),
    alwaysVisible,
    hidden,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withDialog(ext),
    withDialogProps({ alwaysVisible, hidden }),
  )
}
