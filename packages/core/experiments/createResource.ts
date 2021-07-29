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

let resourcesCount = 0
export function createResource<State, Params = void>(
  reducer: ($: Track<{}>) => State,
  fetcher: (
    params: Params,
    state: State extends any ? State : never,
  ) => Promise<State extends any ? State : never>,
  id = `resource [${++resourcesCount}]`,
) {
  type ResourceContext = { version?: number; params?: Params }

  const atom = createAtom(
    {
      /** Action for data request. Memoized by fetcher params */
      fetch: (params: Params) => params,
      /** Action for forced data request */
      invalidate: (params: Params) => params,
      /** Action for fetcher response */
      done: (data: State) => data,
      /** Action for fetcher error */
      error: (error: Error) => error,
      /** Action for cancel pending request */
      cancel: () => null,
    },
    (
      $,
      state: ResourceState<State> = {
        data: undefined as any,
        error: null,
        isLoading: false,
      },
    ) => {
      const data = reducer(
        $,
        // @ts-expect-error
        state.data,
      )
      state = Object.is(data, state.data)
        ? state
        : { data, error: state.error, isLoading: state.isLoading }

      $({
        fetch(params) {
          $.effect((dispatch, ctx) => {
            const isParamsNew =
              'params' in ctx === false || !shallowEqual(ctx.params, params)
            if (isParamsNew) dispatch($.action('invalidate', params))
          })
        },

        invalidate(params) {
          state = state.isLoading
            ? state
            : { data: state.data, error: null, isLoading: true }

          $.effect((dispatch, ctx: ResourceContext) => {
            const version = (ctx.version ?? 0) + 1
            ctx.version = version
            ctx.params = params
            return fetcher(params, state!.data).then(
              (data) => {
                if (ctx.version === version) dispatch($.action('done', data))
              },
              (error) => {
                error = error instanceof Error ? error : new Error(error)
                if (ctx.version === version) dispatch($.action('error', error))
              },
            )
          })
        },

        done(data) {
          state = { data, error: null, isLoading: false }
        },

        error(error) {
          state = { data: state.data, error, isLoading: false }
        },

        cancel() {
          state = state.isLoading
            ? { data: state.data, error: null, isLoading: false }
            : state

          $.effect((store, ctx: ResourceContext) => ctx.version!++)
        },
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
function example() {
  type Product = {}

  const productsAtom = createResource(
    ($, state = new Array<Product>()) => state,
    (page: number = 0) =>
      fetch(`/api/products?page=${page}`).then((r) => r.json()),
    `products`,
  )

  const pageAtom = createAtom(
    {
      next: () => null,
      prev: () => null,
    },
    ($, state = 0) => {
      $({
        next: () => (state += 1),
        prev: () => (state = Math.max(0, state - 1)),
      })
      $.effect((dispatch) => dispatch(productsAtom.fetch(state)))

      return state
    },
    { id: `paging` },
  )

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
