import {
  ActionCreatorBinded,
  AtomBinded,
  AtomState,
  createAtom,
  isObject,
  Track,
} from '@reatom/core'

function shallowEqual(a: any, b: any) {
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k])
  } else {
    return a === b
  }
}

export type ResourceState<State> = {
  data: State
  error: null | Error
  isLoading: boolean
}
export type ResourceDeps<State, Params> = {
  /** Action for data request. Memoized by fetcher params */
  refetch: (params: Params) => Params
  /** Action for forced data request */
  fetch: (params: Params) => Params
  /** Action for fetcher response */
  done: (data: State) => State
  /** Action for fetcher error */
  error: (error: Error) => Error
  /** Action for cancel pending request */
  cancel: () => null
}

let resourcesCount = 0
export function createResource<State, Params = void>(
  reducer: ($: Track<{}>) => State,
  fetcher: (
    params: Params,
    state: State extends any ? State : never,
  ) => Promise<State extends any ? State : never>,
  // TODO
  // `options: { id?: string, paramsTTL?: number, paramsSize?: number, ... }`
  id = `resource${++resourcesCount}`,
) {
  type ResourceCtx = { version?: number; params?: Params }

  const atom = createAtom<ResourceState<State>, ResourceDeps<State, Params>>(
    {
      refetch: (params: Params) => params,
      fetch: (params: Params) => params,
      done: (data: State) => data,
      error: (error: Error) => error,
      cancel: () => null,
    },
    (
      track,
      state: ResourceState<State> = {
        data: undefined as any,
        error: null,
        isLoading: false,
      },
    ) => {
      const data = reducer(
        track,
        // @ts-expect-error
        state.data,
      )
      state = Object.is(data, state.data)
        ? state
        : { data, error: state.error, isLoading: state.isLoading }

      track.onAction(`refetch`, (params) => {
        track.schedule((dispatch, ctx) => {
          const isParamsNew =
            'params' in ctx === false || !shallowEqual(ctx.params, params)
          if (isParamsNew) dispatch(track.create('fetch', params))
        })
      })

      track.onAction(`fetch`, (params) => {
        state = state.isLoading
          ? state
          : { data: state.data, error: null, isLoading: true }

        track.schedule((dispatch, ctx: ResourceCtx) => {
          const version = (ctx.version ?? 0) + 1
          ctx.version = version
          ctx.params = params
          return fetcher(params, state!.data).then(
            (data) => {
              if (ctx.version === version) dispatch(track.create('done', data))
            },
            (error) => {
              error = error instanceof Error ? error : new Error(error)
              if (ctx.version === version)
                dispatch(track.create('error', error))
            },
          )
        })
      })

      track.onAction(`done`, (data) => {
        state = { data, error: null, isLoading: false }
      })

      track.onAction(`error`, (error) => {
        state = { data: state.data, error, isLoading: false }
      })

      track.onAction(`cancel`, () => {
        state = state.isLoading
          ? { data: state.data, error: null, isLoading: false }
          : state

        track.schedule((store, ctx: ResourceCtx) => ctx.version!++)
      })

      return state
    },
    {
      id,
    },
  )

  return atom
}

// This will be trowed by terser
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function example() {
  type Product = {}

  const productsAtom = createResource(
    (track, state = new Array<Product>()) => state,
    (page: number = 0) =>
      fetch(`/api/products?page=${page}`).then((r) => r.json()),
    `products`,
  )

  const pageAtom = createAtom(
    {
      next: () => null,
      prev: () => null,
    },
    ({ onAction, schedule }, state = 0) => {
      onAction(`next`, () => (state += 1))
      onAction(`prev`, () => (state = Math.max(0, state - 1)))

      schedule((dispatch) => dispatch(productsAtom.refetch(state)))

      return state
    },
    { id: `paging` },
  )

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function Products() {
    const [{ data, isLoading }] = useAtom(productsAtom)
    const [page, { next, prev }] = useAtom(pageAtom)

    return html`
      <ul>
        ${data.map(
          (el) => html`
            <li>
              <${Product} data=${el} />
            </li>
          `,
        )}
      </ul>
      <button onClick=${next}>next</button>
      <span>${page}${isLoading && ` (Loading)`}</span>
      <button onClick=${prev}>prev</button>
    `
  }

  // ...
  // ...
  // ...

  function Product(props: { data: Product }): string {
    return null as any
  }

  function useAtom<T extends AtomBinded<any>>(
    atom: T,
  ): [
    AtomState<T>,
    {
      [K in keyof T]: T[K] extends ActionCreatorBinded
        ? T[K]['dispatch']
        : never
    },
  ] {
    return null as any
  }

  function html(...a: any[]): string {
    return null as any
  }
}
