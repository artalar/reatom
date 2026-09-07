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

import type { DisclosurePropRecords, DisclosurePropsOptions } from './props'
import { withDisclosureProps } from './props'

/**
 * Turns a model name into a DOM-safe `id`.
 *
 * Reatom names are hierarchical (`menu#3.popover`), which makes poor CSS
 * selectors and HTML ids, so every non-word character collapses into a dash.
 */
export const disclosureContentId = (name: string): string =>
  `${name.replace(/[^\w-]+/g, '-')}-content`

/** Options accepted by both {@link reatomDisclosure} and {@link withDisclosure}. */
export interface DisclosureExtOptions {
  /**
   * Determines whether the content animates when shown or hidden.
   *
   * - `true` — `animating` becomes `true` on every `open` change and stays until
   *   something (usually {@link withDisclosureAnimation}) resets it.
   * - A number — the same, but the number is the animation duration in
   *   milliseconds, so no CSS measurement is needed.
   * - `false` — the content unmounts immediately on close.
   *
   * @default false
   */
  animated?: boolean | number
  /**
   * The DOM `id` of the content element, used for `aria-controls`. Defaults to
   * a DOM-safe derivation of the model name, which keeps SSR markup stable for
   * explicitly named models.
   */
  contentId?: string
}

/** Options of the {@link reatomDisclosure} factory. */
export interface DisclosureOptions
  extends DisclosureExtOptions, DisclosurePropsOptions {
  /**
   * Initial `open` state. To adopt a caller-owned atom instead (a form field, a
   * search param, a parent model's atom) extend it with {@link withDisclosure}.
   *
   * @default false
   */
  open?: boolean
}

/** Units attached by {@link withDisclosure}. */
export interface DisclosureUnits {
  /** Whether the content animates when shown or hidden. */
  animated: Atom<boolean | number>
  /**
   * Whether the content is currently animating. Derived from `open` and
   * `animated`, but writable: set it to `false` when the animation ends.
   */
  animating: Atom<boolean>
  /**
   * Whether the content should be rendered. Matches `open`, except while the
   * content animates out — then it stays `true` so the element is not removed
   * mid-animation.
   */
  mounted: Computed<boolean>
  /** The DOM `id` of the content element, referenced by `aria-controls`. */
  contentId: Atom<string>
  /** The content element that is being shown or hidden. */
  contentElement: Atom<HTMLElement | null>
  /** The button element that toggles the content. */
  disclosureElement: Atom<HTMLElement | null>
  /** Opens the content. */
  show: Action<[], true>
  /** Closes the content. */
  hide: Action<[], false>
  /** Inverts the `open` state. */
  toggle: Action<[], boolean>
}

/** A boolean atom extended with the disclosure behavior. */
export interface DisclosureModel extends Atom<boolean>, DisclosureUnits {}

/**
 * The model returned by {@link reatomDisclosure}: {@link DisclosureModel} plus
 * prop records.
 */
export interface Disclosure extends DisclosureModel {
  /** Reactive prop records to spread on the button and the content elements. */
  props: DisclosurePropRecords
}

/**
 * Adds the disclosure behavior to an existing boolean atom.
 *
 * This is what "controlled" means in Reatom: instead of Ariakit's `value` /
 * `defaultValue` / `store` triple plus `useStoreProps`, the caller owns the
 * atom and the model reads and writes it.
 *
 * @example
 *   // a form field that also drives a collapsible section
 *   const details = reatomField(false, 'details').extend(withDisclosure())
 *
 * @example
 *   // share one state between two widgets: extend the same atom twice
 *   const open = atom(false, 'sidebar.open')
 *   const sidebar = open.extend(withDisclosure({ animated: 200 }))
 *
 * @see {@link reatomDisclosure} for the batteries-included factory.
 */
export const withDisclosure = (
  options: DisclosureExtOptions = {},
): AssignerExt<DisclosureUnits, Atom<boolean>> => {
  const { animated: initAnimated = false, contentId: initContentId } = options

  return (target) => {
    const { name } = target

    const animated = atom<boolean | number>(initAnimated, `${name}.animated`)

    // Ariakit maintains `animating` with two listeners: one resets it whenever
    // animations are disabled, the other starts an animation on every `open`
    // change (ariakit-components/src/disclosure/disclosure-store.ts:49-62).
    // Together they are a derivation of `open` and `animated` that must stay
    // writable, because the animation end clears it — exactly `withComputed`.
    const animating = atom(
      !!initAnimated && peek(target),
      `${name}.animating`,
    ).extend(
      withComputed((state) => {
        if (!animated()) return false

        let started = false
        // `isFirst` means there is no previous frame to diff against — the
        // initial computation, or a reconnect. Neither is a transition.
        ifChanged(target, (_open, _prevOpen, isFirst) => {
          started = !isFirst
        })

        return started || state
      }),
    )

    // Ariakit computes `animating` eagerly, as part of `initialState`. Anchor
    // the first frame here for the same reason: an atom pulled for the first
    // time has nothing to diff `open` against, so an `open` change that happens
    // before anything reads the model would not count as a transition.
    peek(animating)

    return {
      animated,
      animating,
      mounted: computed(() => {
        // Both reads are unconditional: `open || animating` would short-circuit
        // and leave `animating` disconnected while the content is open.
        const isOpen = target()
        const isAnimating = animating()
        return isOpen || isAnimating
      }, `${name}.mounted`),
      contentId: atom(
        initContentId ?? disclosureContentId(name),
        `${name}.contentId`,
      ),
      contentElement: atom<HTMLElement | null>(null, `${name}.contentElement`),
      disclosureElement: atom<HTMLElement | null>(
        null,
        `${name}.disclosureElement`,
      ),
      show: action(() => target.set(true) as true, `${name}.show`),
      hide: action(() => target.set(false) as false, `${name}.hide`),
      toggle: action(() => target.set((state) => !state), `${name}.toggle`),
    }
  }
}

/**
 * Creates a disclosure model: a boolean `open` atom that knows how to stay
 * mounted while its content animates out.
 *
 * Ported from Ariakit's framework-agnostic `createDisclosureStore`
 * (`ariakit-components/src/disclosure/disclosure-store.ts`). The `mounted`
 * write-back becomes a `computed`, and the `setOpen` / `setContentElement`
 * identity setters are gone — write the atoms directly.
 *
 * The model is the whole widget contract: `disclosure()` reads `open`,
 * `disclosure.props.*` are the reactive prop records for the view, and
 * `disclosure.animating` is the animation handshake. Attach
 * {@link withDisclosureAnimation} to have the animation end detected for you.
 *
 * @example
 *   const faq = reatomDisclosure({ name: 'faq' })
 *
 *   faq.toggle()
 *   faq() // true
 *   faq.mounted() // true
 *
 * @example
 *   // @reatom/jsx
 *   ;<>
 *   <button $spread={faq.props.button}>Details</button>
 *   <div $spread={faq.props.content}>...</div>
 *   </>
 *
 * @see https://ariakit.com/components/disclosure
 */
export const reatomDisclosure = (
  options: DisclosureOptions = {},
): Disclosure => {
  const {
    open: initOpen = false,
    name = named('disclosure'),
    alwaysVisible,
    hidden,
    ...ext
  } = options

  return atom(initOpen, name).extend(
    withDisclosure(ext),
    withDisclosureProps({ alwaysVisible, hidden }),
  )
}
