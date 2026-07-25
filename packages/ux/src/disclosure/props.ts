import type { AssignerExt, Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import type { DisclosureModel } from './reatomDisclosure'

/**
 * The minimal shape of a click event the disclosure button needs.
 *
 * Structural on purpose: a DOM `MouseEvent`, a React synthetic event, and a
 * plain object from a unit test all satisfy it.
 */
export interface DisclosureClickEvent {
  /** When another handler already handled the click, Ariakit skips the toggle. */
  defaultPrevented?: boolean
  /** The clicked element, adopted as the model's `disclosureElement`. */
  currentTarget?: EventTarget | null
}

/**
 * Props to spread on the button that toggles the content.
 *
 * The record targets a native `<button>`, like Ariakit's `Disclosure` does by
 * default. A non-native trigger additionally needs `role="button"`, a tab
 * index, and Enter / Space activation — that belongs to the `command` and
 * `focusable` a11y layers, not to the disclosure model.
 */
export interface DisclosureButtonProps {
  /** Keeps a `<button>` inside a `<form>` from submitting it. */
  type: 'button'
  'aria-expanded': boolean
  /** Points at the content element, so `contentId` must be rendered on it. */
  'aria-controls': string
  onClick: (event?: DisclosureClickEvent) => void
  /** Assigns the model's `disclosureElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/** Props to spread on the content element. */
export interface DisclosureContentProps {
  id: string
  hidden: boolean
  /** `{ display: 'none' }` while hidden, so a `display` rule cannot win. */
  style: { display: 'none' } | undefined
  /** A styling hook for the open state, matching Ariakit's `data-open`. */
  'data-open': boolean | undefined
  /** Assigns the model's `contentElement`; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/** Reactive prop records of a disclosure model. */
export interface DisclosurePropRecords {
  button: Computed<DisclosureButtonProps>
  content: Computed<DisclosureContentProps>
}

/** Options of {@link disclosureProps} and {@link withDisclosureProps}. */
export interface DisclosurePropsOptions {
  /**
   * Keeps the content element visible even when it is not mounted, so a
   * third-party animation library can run its own exit transition.
   *
   * @default false
   */
  alwaysVisible?: boolean
  /**
   * Forces the `hidden` prop. `true` hides the content even while mounted,
   * `false` never hides it — mirroring Ariakit's `props.hidden` override.
   */
  hidden?: boolean
  /** Prefix of the prop record names. Defaults to the model name. */
  name?: string
}

/**
 * Whether the content element must be hidden.
 *
 * Ported verbatim from Ariakit's `isHidden`
 * (`ariakit-react-components/src/disclosure/disclosure-content.tsx:52-58`).
 */
export const isDisclosureContentHidden = (
  mounted: boolean,
  hidden?: boolean,
  alwaysVisible?: boolean,
): boolean => !alwaysVisible && hidden !== false && (!mounted || !!hidden)

/**
 * Builds the reactive prop records of a disclosure model.
 *
 * Each record is a `computed` returning a plain object, so it is memoized (an
 * unchanged record keeps its identity), lazy, traceable by name, and neutral
 * about the view library: React spreads it, `@reatom/jsx` `$spread`s it, Vue
 * `v-bind`s it.
 *
 * Handlers are `wrap`ped so the state change is attributed to the DOM event in
 * the logger, and call `notify()` so a host framework sees the update in the
 * same tick — the `bindField` precedent.
 *
 * @example
 *   const props = disclosureProps(model, { alwaysVisible: true })
 *   props.button() // { type: 'button', 'aria-expanded': false, ... }
 */
export const disclosureProps = (
  model: DisclosureModel,
  options: DisclosurePropsOptions = {},
): DisclosurePropRecords => {
  const { alwaysVisible, hidden: hiddenProp, name = model.name } = options

  return {
    button: computed(
      (): DisclosureButtonProps => ({
        type: 'button',
        // Ariakit only marks the element that last toggled the content
        // (`disclosureElement`) as expanded, because several buttons may
        // control one content element
        // (ariakit-react-components/src/disclosure/disclosure.tsx:54-65). A
        // prop record belongs to a single button, so build one model per
        // button when you need that.
        'aria-expanded': model(),
        'aria-controls': model.contentId(),
        onClick: wrap((event?: DisclosureClickEvent) => {
          if (event?.defaultPrevented) return
          const element = event?.currentTarget
          if (element) model.disclosureElement.set(element as HTMLElement)
          model.toggle()
          notify()
        }),
        // No `notify()` here, unlike in the handlers: a ref runs while the view
        // renders, which may already be inside a notification flush.
        ref: wrap((element: HTMLElement | null) => {
          model.disclosureElement.set(element)
        }),
      }),
      `${name}.props.button`,
    ),

    content: computed((): DisclosureContentProps => {
      const hidden = isDisclosureContentHidden(
        model.mounted(),
        hiddenProp,
        alwaysVisible,
      )

      return {
        id: model.contentId(),
        hidden,
        // Ariakit pairs `hidden` with `display: none` because the attribute
        // alone loses to any `display` rule
        // (ariakit-react-components/src/disclosure/disclosure-content.tsx:234-241).
        style: hidden ? { display: 'none' } : undefined,
        'data-open': model() || undefined,
        ref: wrap((element: HTMLElement | null) => {
          model.contentElement.set(element)
        }),
      }
    }, `${name}.props.content`),
  }
}

/**
 * Attaches {@link disclosureProps} to a disclosure model as `model.props`.
 *
 * {@link reatomDisclosure} applies it already; use it explicitly for models
 * built from an adopted atom with `withDisclosure`.
 *
 * @example
 *   const open = atom(false, 'sidebar.open')
 *   const sidebar = open
 *     .extend(withDisclosure())
 *     .extend(withDisclosureProps({ alwaysVisible: true }))
 */
export const withDisclosureProps = (
  options: DisclosurePropsOptions = {},
): AssignerExt<{ props: DisclosurePropRecords }, DisclosureModel> => {
  return (target) => ({ props: disclosureProps(target, options) })
}
