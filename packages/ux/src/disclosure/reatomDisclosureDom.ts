import type { Action, AssignerExt, Atom } from '@reatom/core'
import {
  action,
  effect,
  sleep,
  withAbort,
  withConnectHook,
  wrap,
} from '@reatom/core'

import type { DisclosureModel } from './reatomDisclosure'

/** The CSS timing properties an animation end is derived from. */
export interface CssTimingStyle {
  transitionDuration: string
  animationDuration: string
  transitionDelay: string
  animationDelay: string
}

/**
 * `setTimeout` may fire a few milliseconds late, so Ariakit subtracts one frame
 * from the measured timeout to stop the animation right after it ends instead
 * of flickering (`disclosure-content.tsx:216-221`).
 */
const FRAME_MS = 1000 / 60

/**
 * Parses CSS time values and returns the longest one in milliseconds.
 *
 * A property may carry several comma-separated times (`transition-duration:
 * 0.1s, 0.3s`); the longest wins, because the animation ends when the slowest
 * part ends. Ported from Ariakit's `parseCSSTime`
 * (`ariakit-react-components/src/disclosure/disclosure-content.tsx:37-50`).
 */
export const parseCssTime = (...times: Array<string | undefined>): number =>
  times
    .filter((time): time is string => time != null)
    .join(', ')
    .split(', ')
    .reduce((longest, time) => {
      const multiplier = time.endsWith('ms') ? 1 : 1000
      const current = Number.parseFloat(time || '0s') * multiplier
      return current > longest ? current : longest
    }, 0)

/**
 * Computes how long an animation takes, from already-resolved CSS styles.
 *
 * Ariakit reads the computed style instead of listening to `transitionend`,
 * because those events are not guaranteed to fire — the element may be removed
 * before the animation ends, or the animation may never start
 * (`disclosure-content.tsx:166-202`).
 *
 * @param style The content element's computed style.
 * @param otherStyle An optional second element that animates together with the
 *   content, e.g. a dialog animating behind its backdrop.
 */
export const getAnimationTimeout = (
  style?: Partial<CssTimingStyle> | null,
  otherStyle?: Partial<CssTimingStyle> | null,
): number => {
  const delay = parseCssTime(
    style?.transitionDelay,
    style?.animationDelay,
    otherStyle?.transitionDelay,
    otherStyle?.animationDelay,
  )
  const duration = parseCssTime(
    style?.transitionDuration,
    style?.animationDuration,
    otherStyle?.transitionDuration,
    otherStyle?.animationDuration,
  )

  return delay + duration
}

/**
 * Resolves after the browser painted the current state.
 *
 * The double `requestAnimationFrame` is Ariakit's workaround for measuring an
 * element whose enter styles were just applied but not yet rendered
 * (`disclosure-content.tsx:30-35, 140-145`).
 */
const afterPaint = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') return resolve()
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

/** Options of {@link withDisclosureAnimation}. */
export interface DisclosureAnimationOptions {
  /**
   * A second element that animates together with the content, e.g. a dialog
   * animating behind a non-animated backdrop. Its timings are taken into
   * account when the content itself has none.
   */
  otherElement?: Atom<HTMLElement | null>
}

/** Units attached by {@link withDisclosureAnimation}. */
export interface DisclosureAnimationUnits {
  /**
   * Waits for the running animation to finish, then clears `animating`. Called
   * automatically while the model is connected; call it manually to drive the
   * handshake yourself.
   */
  endAnimation: Action<[], Promise<void>>
}

/**
 * Detects the end of the content animation and clears `animating`, which lets
 * `mounted` become `false` and the content unmount.
 *
 * The timeout comes from `animated` when it is a number, otherwise from the
 * content element's computed transition and animation timings. There is no
 * timer bookkeeping: the delay lives in the flow as `await wrap(sleep(ms))` and
 * `withAbort()` cancels a stale wait when the state changes again.
 *
 * Lazy by design — the flow starts on the first subscriber of the model and
 * stops on disconnect, so an unmounted widget holds no pending timers.
 *
 * @example
 *   const dialog = reatomDisclosure({
 *     animated: true,
 *     name: 'dialog',
 *   }).extend(withDisclosureAnimation())
 *
 *   dialog.show() // animating: true, mounted: true
 *   dialog.hide() // animating: true, mounted: true until the CSS transition ends
 */
export const withDisclosureAnimation = (
  options: DisclosureAnimationOptions = {},
): AssignerExt<DisclosureAnimationUnits, DisclosureModel> => {
  const { otherElement } = options

  return (target) => {
    const { name } = target

    const endAnimation = action(async () => {
      const animated = target.animated()
      if (!animated) return

      let timeout: number

      if (typeof animated === 'number') {
        timeout = animated
      } else {
        await wrap(afterPaint())
        const element = target.contentElement()
        const other = otherElement?.() ?? null
        timeout =
          element && typeof getComputedStyle === 'function'
            ? getAnimationTimeout(
                getComputedStyle(element),
                other && getComputedStyle(other),
              )
            : 0
      }

      if (timeout > 0) await wrap(sleep(Math.max(timeout - FRAME_MS, 0)))

      target.animating.set(false)
    }, `${name}.endAnimation`).extend(withAbort())

    target.extend(
      withConnectHook(() => {
        effect(() => {
          // Reading `open` restarts the wait on every transition, so a close
          // during the enter animation gets the full leave duration. Returning
          // the call lets the effect swallow the abort of the restarted wait.
          target()
          return target.animating() ? endAnimation() : undefined
        }, `${name}.animation`)
      }),
    )

    return { endAnimation }
  }
}
