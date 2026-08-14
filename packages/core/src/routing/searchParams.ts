import type { Action, Atom, AtomState, Computed } from '../core'
import {
  _enqueue,
  _read,
  action,
  atom,
  computed,
  named,
  top,
  withActions,
} from '../core'
import { withChangeHook, withComputed, withInit } from '../extensions'
import { ifChanged, peek } from '../methods'
import { _getPrevFrame } from '../methods/context'
import { urlAtom } from '../web/url'

/** Interface for the search parameters atom. */
export interface SearchParamsAtom extends Computed<Record<string, string>> {
  /**
   * Set a search parameter.
   *
   * @param key Parameter name
   * @param value Parameter value
   * @param replace Whether to replace the current history entry
   */
  set: Action<[key: string, value: string, replace?: boolean], void>

  /**
   * Delete a search parameter.
   *
   * @param key Parameter name to delete
   * @param replace Whether to replace the current history entry
   */
  del: Action<[key: string, replace?: boolean], void>

  /**
   * Create an atom that synchronizes with a specific search parameter.
   *
   * @param key Parameter name
   * @param parse Function to parse parameter string value to desired type
   */
  lens<T = string>(key: string, parse?: (value?: string) => T): Atom<T>

  /**
   * Create an atom that synchronizes with a specific search parameter using
   * advanced options.
   *
   * @param key Parameter name
   * @param options Configuration options for the lens
   * @param options.parse Optional function to parse the parameter string value
   *   into the desired type
   * @param options.serialize Optional function to serialize the value back into
   *   a string
   * @param options.replace Optional boolean to specify if history entries
   *   should be replaced (default: false)
   * @param options.path Optional path to limit the scope of synchronization to
   *   specific URL paths
   * @param options.name Optional name of the created atom
   */
  lens<T = string>(
    key: string,
    options: {
      parse?: (value?: string) => T
      serialize?: (value: T) => undefined | string
      replace?: boolean
      path?: string
      name?: string
    },
  ): Atom<T>
}

const isSubpath = (currentPath: string, targetPath: string) =>
  !targetPath || targetPath[targetPath.length - 1] === '*'
    ? `${currentPath}/`.startsWith(targetPath.slice(0, -1))
    : `${currentPath}/` === targetPath

/** Create an atom that represents search parameters from the URL. */
const initSearchParamsAtom = () =>
  computed(() => Object.fromEntries(urlAtom().searchParams), 'searchParamsAtom')
    .extend((target) =>
      Object.assign(target, {
        set: action((key: string, value: string, replace = false) => {
          const url = urlAtom()
          const newUrl = new URL(url.href)
          newUrl.searchParams.set(key, value)
          urlAtom.set(newUrl, replace)
        }, 'searchParamsAtom.set'),
      }),
    )
    .extend(
      withActions(() => ({
        del: (key: string, replace = false) => {
          const url = urlAtom()
          const newUrl = new URL(url.href)
          newUrl.searchParams.delete(key)
          urlAtom.set(newUrl, replace)
        },
      })),
    )
    .extend(
      () =>
        ({
          lens(key, options) {
            let { parse = () => '', name = named('searchParamsAtom') } =
              typeof options === 'function'
                ? { parse: options }
                : (options ?? {})

            return atom(parse(), name).extend(
              // @ts-expect-error
              withSearchParams(key, options),
            )
          },
        }) satisfies Pick<SearchParamsAtom, 'lens'>,
    )

export const searchParamsAtom: SearchParamsAtom =
  /* @__PURE__ */ initSearchParamsAtom()

/**
 * Create an atom that synchronizes with a URL search parameter.
 *
 * @param key The parameter name to synchronize with
 * @param parse Function to parse string value to desired type
 */
export function withSearchParams<T = string>(
  key: string,
  parse?: (value?: string) => T,
): <Target extends Atom<T>>(target: Target) => Target

/**
 * Create an atom that synchronizes with a URL search parameter.
 *
 * @param key Parameter name
 * @param options Configuration options for the lens
 * @param options.parse Optional function to parse the parameter string value
 *   into the desired type
 * @param options.serialize Optional function to serialize the value back into a
 *   string
 * @param options.replace Optional boolean to specify if history entries should
 *   be replaced (default: false)
 * @param options.path Optional path to limit the scope of synchronization to
 *   specific URL paths
 * @param options.name Optional name of the created atom
 */
export function withSearchParams<T = string>(
  key: string,
  options: {
    parse?: (value?: string) => T
    serialize?: (value: T) => undefined | string
    replace?: boolean
    path?: string
  },
): <Target extends Atom<T>>(target: Target) => Target

export function withSearchParams<T = string>(
  key: string,
  options?:
    | ((value?: string) => T)
    | {
        parse?: (value?: string) => T
        serialize?: (value: T) => undefined | string
        replace?: boolean
        path?: string
      },
) {
  let {
    parse = (value = '') => value as unknown as T,
    serialize = (value: T) => String(value) as string,
    replace = false,
    path = '',
  } = typeof options === 'function' ? { parse: options } : (options ?? {})

  const pathEnd = path[path.length - 1]
  if (path && pathEnd !== '/' && pathEnd !== '*') {
    path += '/'
  }

  return <Target extends Atom<T>>(target: Target): Target => {
    let initKey = {}

    return target.extend(
      withInit((state) => {
        const currentPath = urlAtom().pathname
        const sp = searchParamsAtom()

        top().root.inits.set(initKey, state)

        return key in sp && isSubpath(currentPath, path)
          ? (parse(sp[key]) as AtomState<Target>)
          : state
      }),
      withComputed(
        (state) => {
          let frame = top()
          let currentPath = peek(urlAtom).pathname
          let pubs = _getPrevFrame(frame)?.pubs

          ifChanged(searchParamsAtom, (next, prev) => {
            if (!prev) return

            let prevSearchParamsFrame = pubs![1]!
            let prevUrlFrame = prevSearchParamsFrame.pubs[1]!
            const prevUrl = prevUrlFrame.state as URL

            if (!isSubpath(currentPath, path)) {
              if (key in prev && isSubpath(prevUrl.pathname, path)) {
                state = frame.root.inits.get(initKey)
              }
              return
            }

            if (key in next) {
              if (next[key] !== prev[key])
                state = parse(next[key]) as AtomState<Target>
            } else {
              if (path === '' && currentPath !== prevUrl.pathname) {
                state = frame.root.inits.get(initKey)
                return
              }

              if (key in prev && currentPath === prevUrl.pathname) {
                state = parse(undefined) as AtomState<Target>
                return
              }

              const prevState = serialize(state)
              if (prevState !== undefined) {
                _enqueue(() => {
                  searchParamsAtom.set(key, prevState, true)
                }, 'hook')
              }
            }
          })

          return state
        },
        { tail: false },
      ),
      withChangeHook((state) => {
        let frame = top()
        let prevFrame = _getPrevFrame(frame)
        if (
          frame === _read(target) &&
          frame.pubs[1]?.state === prevFrame?.pubs[1]?.state &&
          isSubpath(urlAtom().pathname, path)
        ) {
          const value = serialize(state)
          const sp = searchParamsAtom()
          if (value === undefined) {
            if (key in sp) searchParamsAtom.del(key, replace)
          } else if (sp[key] !== value) {
            searchParamsAtom.set(key, value, replace)
          }
        }
        target()
      }),
    )
  }
}
