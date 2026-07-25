/**
 * Layer 2 for `command`: carries out the DOM side of an activation intent and
 * exposes it as a reactive prop record.
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/command/command.tsx`.
 */

import type { Computed } from '@reatom/core'
import { computed, notify, wrap } from '@reatom/core'

import { describeElement } from '../interactions/describeElement'
import { isSelfTarget } from '../interactions/element'
import { queueBeforeEvent } from '../interactions/queueBeforeEvent'
import type { CommandActivationIntent } from './mapActivationIntent'
import { getActivationClickInit } from './mapActivationIntent'
import type { CommandKeyEvent, CommandModel } from './reatomCommand'

/** Reduces a real keyboard event to the plain data the model consumes. */
export const describeKeyEvent = (event: KeyboardEvent): CommandKeyEvent => {
  const element = event.currentTarget as Element | null
  return {
    key: event.key,
    defaultPrevented: event.defaultPrevented,
    isTrusted: event.isTrusted,
    metaKey: event.metaKey,
    selfTarget: isSelfTarget(event),
    element: element ? describeElement(element) : undefined,
  }
}

/**
 * Performs the DOM half of an activation intent: blocks the browser default and
 * dispatches the synthetic click.
 *
 * A `click` event is dispatched rather than calling `element.click()` so the
 * modifier state of the key event is carried over (see
 * {@link getActivationClickInit}) — otherwise `Cmd+Enter` on a link would lose
 * its "open in a new tab" meaning.
 *
 * @param event - The key event being handled.
 * @param intent - Result of `command.keyDown(...)` / `command.keyUp(...)`.
 * @returns A cancel function when the click was deferred to `keyup`, otherwise
 *   `undefined`.
 */
export const applyActivationIntent = (
  event: KeyboardEvent,
  intent: CommandActivationIntent,
): (() => void) | undefined => {
  if (intent.preventDefault) event.preventDefault()
  if (intent.click === 'none') return

  // `currentTarget` is nulled out once dispatch finishes, so capture it now for
  // the deferred callback.
  const element = event.currentTarget as Element | null
  if (!element) return

  const init = getActivationClickInit(event)
  const click = () => {
    element.dispatchEvent(new MouseEvent('click', init))
  }

  if (intent.click === 'before-keyup') {
    return queueBeforeEvent(element, 'keyup', click)
  }
  queueMicrotask(wrap(click))
  return
}

/** Prop record produced by {@link commandProps}. */
export interface CommandProps {
  /** Props for the command element itself. */
  element: Computed<{
    'data-active': true | undefined
    onKeyDown: (event: KeyboardEvent) => void
    onKeyUp: (event: KeyboardEvent) => void
  }>
}

/**
 * Reactive prop record for a command element.
 *
 * The handlers are `wrap`ped so the state change is attributed to the DOM event
 * in the logger, and `notify()` flushes the update so a host framework's
 * subscription sees it in the same tick.
 *
 * Ariakit also renders `type="button"` for native buttons; that is a static
 * concern of the element being rendered, not of this model, so it is left to
 * the view.
 *
 * @example
 *   const command = reatomCommand({ name: 'menuButton' })
 *   const props = commandProps(command)
 *   // @reatom/jsx: <div role="button" $spread={props.element} />
 */
export const commandProps = (
  model: CommandModel,
  name: string = model.name,
): CommandProps => ({
  element: computed(
    () => ({
      'data-active': model() || undefined,
      onKeyDown: wrap((event: KeyboardEvent) => {
        applyActivationIntent(event, model.keyDown(describeKeyEvent(event)))
        notify()
      }),
      onKeyUp: wrap((event: KeyboardEvent) => {
        applyActivationIntent(event, model.keyUp(describeKeyEvent(event)))
        notify()
      }),
    }),
    `${name}.props.element`,
  ),
})
