/**
 * Layer 1 for `tooltip`: the registry of the one active tooltip.
 *
 * A page full of icon buttons must not make the user pause before every single
 * one: the first tooltip waits, the rest appear instantly while the user is
 * still "in tooltip mode". That mode is a property of the page, not of a
 * widget, so — exactly like `keyboardModality` and `pointerMoving` — there is
 * one process-wide instance and a factory for the cases where one is not enough
 * (an iframe, a test).
 *
 * Ported from [Ariakit](https://github.com/ariakit/ariakit) (MIT, ©
 * 2025–present Ariakit FZ-LLC):
 * `packages/ariakit-react-components/src/tooltip/tooltip-anchor.tsx`, where the
 * same state is a module-level `createStore({ activeStore: null })` plus a
 * `WeakSet` of stores being hidden, maintained from two `useEffect`s per
 * anchor.
 */

import type { AbortExt, Action, Atom, Computed } from '@reatom/core'
import {
  action,
  atom,
  computed,
  isAbort,
  named,
  sleep,
  withAbort,
  wrap,
} from '@reatom/core'

/**
 * What the registry needs of a tooltip: identity, and a way to close it.
 *
 * Structural on purpose. `TooltipModel` satisfies it, and stating the
 * requirement instead of importing the model keeps the dependency one-way — the
 * model knows its registry, the registry knows only this.
 */
export interface TooltipRegistryEntry extends Atom<boolean> {
  /** Closes the tooltip when another one takes over. */
  hide: Action<[], false>
}

/**
 * Releases the active tooltip after the skip window, unless superseded.
 *
 * `.abort(reason?)` _is_ the `clearTimeout` Ariakit returns from its `sync`
 * cleanup, and a cancelled wait simply never reaches its write.
 */
export interface TooltipRelease
  extends
    Action<[tooltip: TooltipRegistryEntry, timeout: number], Promise<void>>,
    AbortExt {}

/** Units attached to the registry's read-only state. */
export interface TooltipRegistryUnits {
  /**
   * Makes a tooltip the active one, closing whichever was active before.
   *
   * @remarks
   *   Also cancels a pending {@link TooltipRegistryUnits.release}, so a tooltip
   *   that opens again inside its own skip window is not released mid-life.
   *   Ariakit gets that from the `clearTimeout` in its `sync` cleanup.
   */
  activate: Action<[tooltip: TooltipRegistryEntry], void>
  /**
   * Starts the skip window: the tooltip stays active for `timeout` milliseconds
   * after closing, so its neighbours can still open instantly.
   *
   * @remarks
   *   A `timeout` of `0` releases the tooltip in the same tick, with no `await`
   *   at all. The tooltip is re-checked after the wait, so a newcomer that took
   *   over in the meantime is never dropped.
   *
   *   One pending release per registry is enough — only one tooltip can be active
   *   — so `withAbort()`'s last-in-win is exactly the right policy here.
   */
  release: TooltipRelease
  /**
   * Drops a tooltip from the registry immediately, ending the skip window.
   *
   * A no-op for a tooltip that is not the active one. Ariakit calls the same
   * thing `removeStore` and runs it when the anchor loses focus and when the
   * anchor unmounts — "useful, for example, to avoid showing tooltips
   * immediately on serial tests".
   */
  clear: Action<[tooltip: TooltipRegistryEntry], void>
}

/**
 * The registry model. Reading it gives the active tooltip, or `null` when no
 * tooltip has been shown recently.
 *
 * It is a `computed` rather than an atom on purpose: every Reatom model _is_ a
 * function, and `atom.set` treats a function argument as an updater, so a
 * writable registry would be a trap. Writes go through
 * {@link TooltipRegistryUnits.activate}, {@link TooltipRegistryUnits.release},
 * and {@link TooltipRegistryUnits.clear} instead.
 */
export interface TooltipRegistryModel
  extends Computed<TooltipRegistryEntry | null>, TooltipRegistryUnits {}

/** Options of {@link reatomTooltipRegistry}. */
export interface TooltipRegistryOptions {
  /** Name of the model. */
  name?: string
}

/**
 * Starts a release and ignores the rejection an abort produces.
 *
 * A tooltip closing is not an `await` site: it starts the skip window and
 * returns, so the promise `withAbort()` rejects on cancellation would otherwise
 * surface as an unhandled rejection — and being superseded by the next tooltip
 * is the _normal_ outcome. Awaiting {@link TooltipRelease} directly still
 * observes it.
 *
 * @example
 *   // in a view's own close handler, next to the prop record
 *   scheduleTooltipRelease(tooltipRegistry, save, save.skipTimeout())
 */
export const scheduleTooltipRelease = (
  registry: TooltipRegistryModel,
  tooltip: TooltipRegistryEntry,
  timeout: number,
): void =>
  void registry.release(tooltip, timeout).catch((error: unknown) => {
    if (!isAbort(error)) throw error
  })

/**
 * Creates a tooltip registry: the "which tooltip is active right now" state
 * every tooltip on a page shares.
 *
 * @remarks
 *   Ariakit's `hidingStores` WeakSet and its `queueMicrotask` cleanup are not
 *   ported. They exist because React can force a controlled tooltip open again
 *   inside the same batch that just hid it, and the guard has to survive until
 *   that batch settles. Here the takeover is a single action that closes the
 *   previous tooltip through its own `hide`, and hooks run in a FIFO queue
 *   rather than re-entrantly, so the `active !== tooltip` check is the whole
 *   story. Two tooltips whose `open` atoms are _derived_ to `true` will still
 *   take the registry from each other forever — but that is a modelling error,
 *   not a race.
 * @example
 *   const registry = reatomTooltipRegistry({ name: 'app.tooltips' })
 *   const save = reatomTooltip({ registry, name: 'save.tip' })
 *   const undo = reatomTooltip({ registry, name: 'undo.tip' })
 *
 *   save.show()
 *   notify()
 *   registry() // save
 *   undo.skipDelay() // true — the next tooltip opens without waiting
 *
 * @see {@link tooltipRegistry} for the shared instance every tooltip uses by
 *   default.
 */
export const reatomTooltipRegistry = (
  options: TooltipRegistryOptions = {},
): TooltipRegistryModel => {
  const { name = named('tooltipRegistry') } = options

  const entry = atom<TooltipRegistryEntry | null>(null, `${name}.entry`)
  // A model is a function, so a plain `entry.set(tooltip)` would be read as an
  // updater. The updater form states the intent instead of fighting it.
  const latch = (tooltip: TooltipRegistryEntry) => entry.set(() => tooltip)

  const release: TooltipRelease = action(
    async (tooltip: TooltipRegistryEntry, timeout: number) => {
      // Ariakit skips no `setTimeout` here, but a zero skip window with an
      // `await` in it would leave the tooltip active for a microtask, which is
      // long enough for the next `mousemove` to see the wrong answer.
      if (timeout > 0) await wrap(sleep(timeout))
      if (entry() !== tooltip) return
      entry.set(null)
    },
    `${name}.release`,
  ).extend(withAbort())

  const activate = action((tooltip: TooltipRegistryEntry) => {
    release.abort('activate')

    const active = entry()
    if (active === tooltip) return
    // "If the current tooltip is open, we should immediately hide the active
    // one and set the current one as the active tooltip."
    if (active) active.hide()
    latch(tooltip)
  }, `${name}.activate`)

  const clear = action((tooltip: TooltipRegistryEntry) => {
    if (entry() !== tooltip) return
    release.abort('clear')
    entry.set(null)
  }, `${name}.clear`)

  return computed(() => entry(), name).extend(() => ({
    activate,
    release,
    clear,
  }))
}

/**
 * The process-wide registry every {@link reatomTooltip} uses by default.
 *
 * Pass a dedicated registry through `reatomTooltip({ registry })` in tests, or
 * to scope the skip window to one document (an iframe, an embedded editor).
 */
export const tooltipRegistry: TooltipRegistryModel = reatomTooltipRegistry({
  name: 'tooltipRegistry',
})
