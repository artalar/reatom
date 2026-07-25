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
  /**
   * The properties that transition, which is what says **how many** transitions
   * there are: CSS cycles the duration and delay lists to match this one.
   * `none` means nothing transitions, whatever the other lists say.
   *
   * Optional in the {@link getAnimationTimeout} input, where it defaults to one
   * unnamed item — a caller that has durations and no property list means "one
   * transition".
   */
  transitionProperty: string
  /** The same for animations: the item count, and `none` for "no animation". */
  animationName: string
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
 * Parses one CSS time value into milliseconds.
 *
 * Port of Ariakit's `parseCSSTime`. A non-numeric value — `animation-duration:
 * auto` — parses to `NaN`, which would poison every sum and comparison it
 * reaches, so it counts as `0`.
 */
const parseOneCssTime = (time: string | undefined): number => {
  const value = time?.trim() || '0s'
  const multiplier = value.endsWith('ms') ? 1 : 1000
  const parsed = Number.parseFloat(value) * multiplier
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Parses CSS time values and returns the longest one in milliseconds.
 *
 * A property may carry several comma-separated times (`transition-duration:
 * 0.1s, 0.3s`); this reports the longest of them, and of every argument.
 *
 * @remarks
 *   Note that the longest duration is _not_ how {@link getAnimationTimeout}
 *   answers: an end time pairs each item's own delay with its own duration.
 *   This stays exported for a caller that only needs to read a CSS time.
 * @example
 *   parseCssTime('0.15s') // 150
 *   parseCssTime('0.1s, 0.3s') // 300
 *   parseCssTime('0.1s', '250ms') // 250
 */
export const parseCssTime = (...times: Array<string | undefined>): number =>
  times
    .filter((time): time is string => time != null)
    .join(', ')
    .split(',')
    .reduce((longest, time) => {
      const current = parseOneCssTime(time)
      return current > longest ? current : longest
    }, 0)

/**
 * The time one set of transitions or animations ends: the longest per-item
 * `delay + duration`.
 *
 * @remarks
 *   Port of Ariakit's `getEndTime`. `names` is the `transition-property` or
 *   `animation-name` list, whose length is the number of items; CSS cycles the
 *   (possibly shorter) delay and duration lists to match it, so each is indexed
 *   modulo its own length, and a duration with no item to belong to is
 *   ignored.
 *
 *   An empty `names` counts as one unnamed item, so a caller that passes only
 *   durations and delays still gets an end time — see
 *   {@link CssTimingStyle.transitionProperty}.
 */
const getEndTime = (
  names: string | undefined,
  delays: string | undefined,
  durations: string | undefined,
): number => {
  const nameList = (names ?? '').split(',')
  const delayList = (delays ?? '').split(',')
  const durationList = (durations ?? '').split(',')

  let endTime = 0
  for (const [index, name] of nameList.entries()) {
    // `transition-property: none` and `animation-name: none` mean nothing runs
    // for that item, so a duration still set on it does not count.
    if (name.trim() === 'none') continue
    const delay = parseOneCssTime(delayList[index % delayList.length])
    const duration = parseOneCssTime(durationList[index % durationList.length])
    endTime = Math.max(endTime, delay + duration)
  }
  return endTime
}

/**
 * Computes how long an animation takes, from already-resolved CSS styles.
 *
 * Ariakit reads the computed style instead of listening to `transitionend`,
 * because those events are not guaranteed to fire — the element may be removed
 * before the animation ends, or the animation may never start
 * (`disclosure-content.tsx:166-202`).
 *
 * @remarks
 *   The answer is the longest per-item `delay + duration`, per element and per
 *   kind (transitions, animations), and the longest of those — Ariakit's
 *   `getElementEndTime`. Adding the longest delay to the longest duration, as
 *   this port did before Ariakit's own fix, overestimates whenever the two
 *   belong to different items: a transition with a long delay next to an
 *   animation with a long duration kept `mounted` true well past the real end.
 * @example
 *   // `transition: opacity 100ms linear 400ms; animation: fade 300ms linear;`
 *   getAnimationTimeout({
 *     transitionProperty: 'opacity',
 *     transitionDelay: '400ms',
 *     transitionDuration: '100ms',
 *     animationName: 'fade',
 *     animationDelay: '0s',
 *     animationDuration: '300ms',
 *   }) // 500 — the transition's own end, not 400 + 300
 *
 * @param style The content element's computed style.
 * @param otherStyle An optional second element that animates together with the
 *   content, e.g. a dialog animating behind its backdrop.
 */
export const getAnimationTimeout = (
  style?: Partial<CssTimingStyle> | null,
  otherStyle?: Partial<CssTimingStyle> | null,
): number =>
  Math.max(
    getEndTime(
      style?.transitionProperty,
      style?.transitionDelay,
      style?.transitionDuration,
    ),
    getEndTime(
      style?.animationName,
      style?.animationDelay,
      style?.animationDuration,
    ),
    getEndTime(
      otherStyle?.transitionProperty,
      otherStyle?.transitionDelay,
      otherStyle?.transitionDuration,
    ),
    getEndTime(
      otherStyle?.animationName,
      otherStyle?.animationDelay,
      otherStyle?.animationDuration,
    ),
  )

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
