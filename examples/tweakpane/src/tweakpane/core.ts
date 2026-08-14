import {
  type AtomLike,
  effect,
  type Ext,
  named,
  peek,
  withChangeHook,
  withConnectHook,
} from '@reatom/core'
import type {
  BaseParams,
  Controller,
  FolderApi,
  RackApi,
  TabPageApi,
} from '@tweakpane/core'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import { type FolderParams, Pane, type TabParams } from 'tweakpane'

import { reatomInstance } from '../reatomInstance'

// types that may work as containers for other blades
export type BladeRackApi = FolderApi | RackApi | TabPageApi

export type Disposable = { dispose: () => void; controller: Controller }

/**
 * Attach a lifecycle-bound side effect to an atom-like resource.
 *
 * The effect starts with the target connection and is disposed with it. Use
 * `peek(target)` inside `effectFn` when you need the current imperative
 * instance without subscribing the effect to the target itself.
 */
export const withEffect =
  <T extends AtomLike>(effectFn: (target: T) => void): Ext<T> =>
  (target) =>
    target.extend(
      withConnectHook(() => {
        const { unsubscribe } = effect(() => effectFn(target))
        return unsubscribe
      }),
      withChangeHook(() => void peek(() => effectFn(target))),
    )

/**
 * Create a lazy reactive disposable resource.
 *
 * This helper wraps creation of external resources (Tweakpane instances,
 * folders, tabs, blades, etc.) in a computed atom so the resource is created
 * only when the atom is subscribed to and disposed automatically when the atom
 * is disconnected or when the global `abortVar` fires.
 *
 * The returned computed atom is extended with lifecycle helpers that:
 *
 * - Attach an abort controller via `withAbort()`
 * - Dispose and reset the resource when the atom is disconnected
 *
 * @template T Resource type which must provide a `dispose()` method and a
 *   `controller`.
 * @param create Factory that creates and returns the disposable resource.
 * @param name Optional debugging name passed to the underlying computed atom.
 * @returns A computed atom that yields the created resource and manages its
 *   lifecycle.
 */
export const reatomDisposable = <T extends Disposable>(
  create: () => T,
  name: string = named('disposable'),
) =>
  reatomInstance(
    () => create(),
    (disposable) => disposable.dispose(),
    name,
  )

export type PaneConfig = ConstructorParameters<typeof Pane>[0]

/**
 * Creates a reactive Tweakpane instance.
 *
 * This atom manages the lifecycle of the Pane: creating it on connection and
 * disposing it when the atom is no longer subscribed to.
 *
 * @param params - Configuration options for the Pane
 * @param params.name - Unique debugging name for the atom
 */
export const reatomPane = (params: PaneConfig & { name: string }) =>
  reatomDisposable(() => {
    const pane = new Pane(params)
    pane.registerPlugin(EssentialsPlugin)
    return pane
  }, `tweakpane.pane.${params.name}`)

/** Global default Tweakpane instance */
export const rootPane = reatomPane({ name: 'rootPane' })

/**
 * Creates a reactive folder associated with a parent blade rack.
 *
 * @param params - Folder configuration (title, expanded, etc.)
 * @param parent - The parent atom (defaults to rootPane)
 */
export const reatomPaneFolder = (
  params: FolderParams,
  parent: AtomLike<BladeRackApi> = rootPane,
) =>
  reatomDisposable(
    () => parent().addFolder(params),
    `${parent.name}.${params.title}`,
  )
/**
 * Creates a tab interface with multiple pages.
 *
 * @example
 *   const tabs = reatomPaneTab(['General', 'Advanced'])
 *   // Access pages via the .pages extension
 *   const generalPage = tabs.pages[0]
 *
 * @param params - Tab configuration or simple array of page titles
 * @param parent - The parent atom (defaults to rootPane)
 */
export const reatomPaneTab = (
  params:
    | string[]
    | (Omit<TabParams, 'pages'> & { pages: string[] | TabParams['pages'] }),
  parent: AtomLike<BladeRackApi> = rootPane,
) => {
  const normalizedParams: TabParams = Array.isArray(params)
    ? { pages: params.map((title) => ({ title })) }
    : {
        ...params,
        pages: params.pages.map((p) =>
          typeof p === 'string' ? { title: p } : p,
        ),
      }
  return reatomDisposable(
    () => parent().addTab(normalizedParams),
    `${parent.name}.tabs`,
  ).extend((target) => ({
    pages: normalizedParams.pages.map((_, i) =>
      reatomDisposable(() => target().pages[i], `${target.name}.page.${i}`),
    ),
  }))
}

/**
 * Adds a visual separator to organize controls.
 *
 * @param params - Separator configuration
 * @param parent - The parent atom (defaults to rootPane)
 */
export const reatomPaneSeparator = (
  params: BaseParams,
  parent: AtomLike<BladeRackApi> = rootPane,
) =>
  reatomDisposable(
    () => parent().addBlade({ view: 'separator', ...params }),
    `${parent.name}.separator`,
  )
