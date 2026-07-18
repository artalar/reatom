import type { Action, Atom } from '../core'
import {
  _enqueue,
  action,
  atom,
  STACK,
  top,
  withActions,
  withMiddleware,
  withParams,
} from '../core'
import type { AbortExt } from '../extensions'
import { withAbort, withInitHook } from '../extensions'
import type { RouteAtom } from '../routing'
import type { Rec } from '../utils'
import { onEvent } from './onEvent'

/** URL atom interface that extends the base Atom type. */
export interface UrlAtom extends Atom<URL> {
  /**
   * Update the URL atom with a new URL.
   *
   * @param url New URL to set
   * @param replace Whether to replace the current history entry
   */
  set(url: URL, replace?: boolean): URL

  /**
   * Update the URL with a function that receives the current URL.
   *
   * @param update Function that takes current URL and returns new URL
   * @param replace Whether to replace the current history entry
   */
  set(update: (url: URL) => URL, replace?: boolean): URL

  /**
   * Navigate to a new path.
   *
   * @param path The path to navigate to
   * @param replace Whether to replace the current history entry
   */
  go: (path: string, replace?: boolean) => URL

  /**
   * Whether to intercept link clicks for SPA navigation.
   *
   * @default true
   */
  catchLinks: Atom<boolean>

  /**
   * This initialize DOM subscriptions and returns the current URL. To prevent
   * this action calling (in server on other environments without DOM), just
   * call `urlAtom` with your custom URL before it will be reded in other
   * places.
   */
  init: Action<[], URL> & AbortExt

  /**
   * Synchronization callback to push URL state updates to the `history`.
   * Replace with `noop` to disable syncing.
   */
  sync: Atom<(url: URL, replace?: boolean) => void>

  /**
   * For integrations use: put the new URL from the the source of truth to
   * `urlAtom`, without syncing it back (calling callback in `sync` Atom).
   *
   * @param url The URL from the source
   * @param replace Whether to replace the current history entry
   */
  syncFromSource: Action<[url: URL, replace?: boolean], URL>

  routes: Rec<RouteAtom>

  pattern: '/'
}

const nodeDefaultUrl = 'http://localhost/'

/** Create the URL atom with the new Reatom API. */
// @ts-ignore TODO weird  pattern issue
const initUrlAtom = (): UrlAtom =>
  atom(null as any as URL, 'urlAtom')
    .extend(
      withMiddleware(
        () =>
          (next, ...params) =>
            next(...params) ?? urlAtom.init(),
      ),

      withInitHook(() => {
        for (const [, routeAtom] of Object.entries(urlAtom.routes)) {
          routeAtom.loader()
        }
      }, 'effect'),

      withParams((update: URL | ((state: URL) => URL), replace = false) => {
        let frame = top()

        let url = frame.state as null | URL
        let newUrl =
          typeof update === 'function' ? update(url ?? urlAtom.init()) : update

        if (newUrl.href === url?.href) {
          return url
        }

        // TODO check `href`, instead of instance?
        if (url !== newUrl) {
          // invalidate
          _enqueue(() => {
            for (const [, routeAtom] of Object.entries(urlAtom.routes)) {
              routeAtom.loader()
            }
          }, 'compute')
          if (STACK[STACK.length - 2]?.atom !== urlAtom.syncFromSource) {
            urlAtom.sync()(newUrl, replace)
          }
        }

        return newUrl
      }),

      () => ({
        catchLinks: atom(true, 'urlAtom.catchLinks'),

        init: action((): URL => {
          if (typeof window === 'undefined') {
            console.warn(
              'window is undefined, you should setup urlAtom manually.',
            )
            return new URL(nodeDefaultUrl)
          }
          onEvent(window, 'popstate', () =>
            urlAtom.syncFromSource(new URL(window.location.href), true),
          )

          onEvent(window.document.body, 'click', (event) => {
            if (!urlAtom.catchLinks()) return

            let link: HTMLAnchorElement | null =
              event.target instanceof Element ? event.target.closest('a') : null

            if (
              link &&
              event.button === 0 && // Left mouse button
              link.target !== '_blank' && // Not for new tab
              link.origin === window.location.origin && // Not external link
              link.rel !== 'external' && // Not external link
              link.rel !== 'nofollow' && // Not for search engines only
              !link.download && // Not download link
              !event.altKey && // Not download link by user
              !event.metaKey && // Not open in new tab by user
              !event.ctrlKey && // Not open in new tab by user
              !event.shiftKey // Not open in new window by user
            ) {
              event.preventDefault()

              let previousHash = window.location.hash
              let { hash, href } = urlAtom.syncFromSource(new URL(link.href))
              history.pushState({}, '', href)

              if (previousHash !== hash) {
                _enqueue(() => {
                  window.dispatchEvent(new HashChangeEvent('hashchange'))
                }, 'effect')
              }
            }
          })

          return new URL(window.location.href)
        }, 'urlAtom.init').extend(withAbort()),

        sync: atom(
          () => (url: URL, replace?: boolean) => {
            // TODO why `setTimeout`?
            setTimeout(() => {
              if (replace) {
                history.replaceState({}, '', url.href)
              } else {
                history.pushState({}, '', url.href)
              }
            }, 0)
          },
          'urlAtom.sync',
        ),

        pattern: '/' as const,

        routes: {},
      }),
    )

    .extend(
      withActions((target) => ({
        go(path: string, replace?: boolean) {
          return target.set((url) => new URL(path, url), replace)
        },

        syncFromSource(url: URL, replace?: boolean) {
          return urlAtom.set(url, replace)
        },
      })),
    )

export let urlAtom: UrlAtom = /* @__PURE__ */ initUrlAtom()
