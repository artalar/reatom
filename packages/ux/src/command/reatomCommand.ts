/**
 * Command model: the keyboard-activation state of a button-like element.
 *
 * Layer 1. Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-solid-components/src/command/command.tsx`.
 */

import type { Action, Atom } from '@reatom/core'
import { atom, named, withActions, withComputed } from '@reatom/core'

import type {
  CommandActivationEvent,
  CommandActivationIntent,
} from './mapActivationIntent'
import { mapActivationIntent } from './mapActivationIntent'

/** A key event without the `type` field, which the action itself supplies. */
export type CommandKeyEvent = Omit<CommandActivationEvent, 'type'>

/** Options for {@link reatomCommand}. */
export interface CommandOptions {
  /**
   * Whether `Enter` activates the element.
   *
   * @default true
   */
  clickOnEnter?: boolean
  /**
   * Whether pressing and releasing space activates the element.
   *
   * @default true
   */
  clickOnSpace?: boolean
  /**
   * Whether the command is disabled.
   *
   * @default false
   */
  disabled?: boolean
  /**
   * Whether the host browser is Firefox, which needs the `Enter` click deferred
   * to `keyup`. Layer 2 sets it from `isFirefox()`; Layer 1 stays free of
   * platform sniffing.
   *
   * @default false
   */
  firefox?: boolean
  /** Name prefix for every unit of the model. */
  name?: string
}

/**
 * Model returned by {@link reatomCommand}.
 *
 * Reading the model reads `active` — the `data-active` flag Ariakit renders
 * while space is held down on a non-native clickable element.
 */
export interface CommandModel extends Atom<boolean> {
  /**
   * A space `keydown` was handled by this model and its `keyup` is still
   * pending. This is Ariakit's `activeRef`, which unlike `active` is also set
   * for native controls so a `keyup` can tell whether it has a matching
   * `keydown`.
   */
  pressed: Atom<boolean>
  /** Whether `Enter` activates the element. */
  clickOnEnter: Atom<boolean>
  /** Whether space activates the element. */
  clickOnSpace: Atom<boolean>
  /** Whether the command is disabled. */
  disabled: Atom<boolean>
  /** Whether the `Enter` click must be deferred to `keyup` (Firefox). */
  firefox: Atom<boolean>
  /**
   * Applies a `keydown` and returns the intent the DOM layer must carry out
   * (`preventDefault`, dispatching the synthetic click).
   */
  keyDown: Action<[CommandKeyEvent], CommandActivationIntent>
  /** Applies a `keyup`; see {@link CommandModel.keyDown}. */
  keyUp: Action<[CommandKeyEvent], CommandActivationIntent>
  /**
   * Ends a space press that will get no `keyup`, and reports whether there was
   * one to end.
   *
   * @remarks
   *   When focus leaves the element while space is held, the `keyup` is delivered
   *   to whatever has focus now, so {@link CommandModel.keyUp} never runs and
   *   the element would stay `data-active` forever. Native buttons cancel the
   *   space activation on focus loss, and Ariakit mirrors that from an `onBlur`
   *   handler (react-components 0.3.1).
   */
  cancel: Action<[], boolean>
}

/**
 * Creates the keyboard-activation model of a command (button-like) element.
 *
 * Ariakit's `Command` has no store: `Enter`/space handling, the `data-active`
 * flag and the synthetic click all live in the component. This factory owns the
 * two pieces of state (`active`, `pressed`) and delegates every decision to the
 * pure {@link mapActivationIntent}; the returned intent tells the DOM layer what
 * to do with the event itself.
 *
 * @example
 *   const command = reatomCommand({ name: 'saveButton' })
 *
 *   // in a DOM handler, with `describeElement(event.currentTarget)`
 *   const intent = command.keyDown({ key: ' ', isTrusted: true })
 *   command() // true — the element is visually active while space is held
 *   intent.preventDefault // true — space must not scroll the page
 *
 * @param options - See {@link CommandOptions}.
 */
export const reatomCommand = (options: CommandOptions = {}): CommandModel => {
  const {
    clickOnEnter: initClickOnEnter = true,
    clickOnSpace: initClickOnSpace = true,
    disabled: initDisabled = false,
    firefox: initFirefox = false,
    name = named('command'),
  } = options

  const clickOnEnter = atom(initClickOnEnter, `${name}.clickOnEnter`)
  const clickOnSpace = atom(initClickOnSpace, `${name}.clickOnSpace`)
  const disabled = atom(initDisabled, `${name}.disabled`)
  const firefox = atom(initFirefox, `${name}.firefox`)

  // Ariakit's handlers bail out on `disabled` but never clear the flags, so a
  // command disabled while space is held stays `data-active` forever. Deriving
  // both flags instead makes disabling a complete reset.
  const pressed = atom(false, `${name}.pressed`).extend(
    withComputed((state) => (disabled() ? false : state)),
  )
  const active = atom(false, name).extend(
    withComputed((state) => (disabled() ? false : state)),
  )

  const applyIntent = (
    event: CommandKeyEvent,
    type: CommandActivationEvent['type'],
  ) => {
    const intent = mapActivationIntent(
      { ...event, type },
      {
        clickOnEnter: clickOnEnter(),
        clickOnSpace: clickOnSpace(),
        disabled: disabled(),
        pressed: pressed(),
        firefox: firefox(),
      },
    )
    if (intent.pressed !== null) pressed.set(intent.pressed)
    if (intent.active !== null) active.set(intent.active)
    return intent
  }

  return active
    .extend(() => ({ pressed, clickOnEnter, clickOnSpace, disabled, firefox }))
    .extend(
      withActions(() => ({
        keyDown: (event: CommandKeyEvent) => applyIntent(event, 'keydown'),
        keyUp: (event: CommandKeyEvent) => applyIntent(event, 'keyup'),
        cancel: () => {
          if (!pressed()) return false
          pressed.set(false)
          active.set(false)
          return true
        },
      })),
    )
}
