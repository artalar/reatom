// import { AC, Atom, AtomState, declareAtom, isObject, Track } from '@reatom/core'
import { AC, BindedAtom, AtomState, declareAtom, isObject, Track } from '../'

function shallowEqual(a: any, b: any) {
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k])
  } else {
    return a === b
  }
}

let resourcesCount = 0
export function declareResource<State, Params = void>(
  reducer: ($: Track<any, {}>) => State,
  fetcher: (
    params: Params,
    state: State extends any ? State : never,
  ) => Promise<State extends any ? State : never>,
  id = `resource [${++resourcesCount}]`,
) {
  const atom = declareAtom(
    ($, state?: { data: State; error: null | Error; isLoading: boolean }) => {
      if (state === undefined) {
        state = {
          data: reducer($),
          error: null,
          isLoading: false,
        }
      } else {
        const data = reducer(
          $,
          // @ts-expect-error
          state.data,
        )

        state = Object.is(data, state.data)
          ? state
          : {
              data,
              error: state.error,
              isLoading: state.isLoading,
            }
      }

      $(atom.request, (params) => ({ dispatch }, ctx) => {
        const isParamsNew =
          'params' in ctx === false || !shallowEqual(ctx.params, params)
        if (isParamsNew) dispatch(atom.fetch(params))
      })

      $(atom.fetch, (params) => ({ dispatch }, ctx) => {
        const version = ++ctx.version
        ctx.params = params
        return fetcher(params, state!.data).then(
          (data) => {
            if (ctx.version === version) dispatch(atom.response(data))
          },
          (error) => {
            error = error instanceof Error ? error : new Error(error)
            if (ctx.version === version) dispatch(atom.error(error))
          },
        )
      })

      $(atom.cancel, () => (store, ctx) => ctx.version++)

      return state
    },
    {
      /** Action for data request. Memoized by fetcher params */
      request: (params: Params, state) => state,

      /** Action for forced data request */
      fetch: (params: Params, state) =>
        state.isLoading
          ? state
          : {
              data: state.data,
              error: null,
              isLoading: true,
            },

      /** Action for fetcher response */
      response: (data: State) => ({ data, error: null, isLoading: false }),

      /** Action for fetcher error */
      error: (error: Error, state) => ({
        data: state.data,
        error,
        isLoading: false,
      }),

      /** Action for cancel pending request */
      cancel: (payload: void, state) => ({ ...state, isLoading: false }),
    },
    {
      id,
      createCtx: (): { version: number; params?: Params } => ({ version: 0 }),
    },
  )

  return atom
}

// This will throw by terser
function example() {
  type Product = {}

  const productsAtom = declareResource(
    ($, state = new Array<Product>()) => state,
    (page: number = 0) =>
      fetch(`/api/products?page=${page}`).then((r) => r.json()),
    `products`,
  )

  const pageAtom = declareAtom(
    0,
    {
      next: (payload: void, state) => state + 1,
      prev: (payload: void, state) => Math.max(0, state - 1),
    },
    {
      onChange: (oldState, state, { dispatch }) =>
        dispatch(productsAtom.request(state)),
      id: `paging`,
    },
  )

  function Products() {
    const [{ data, isLoading }, { fetch: req }] = useAtom(productsAtom)
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

  function Product(props: { data: Product }): string {
    return null as any
  }

  function useAtom<T extends BindedAtom<any>>(
    atom: T,
  ): [
    AtomState<T>,
    {
      [K in keyof T]: T[K] extends AC ? T[K]['dispatch'] : never
    },
  ] {
    return null as any
  }

  function html(...a: any[]): string {
    return null as any
  }
}
