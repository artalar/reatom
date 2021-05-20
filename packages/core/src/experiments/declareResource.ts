import {
  AC,
  ActionCreator,
  Atom,
  AtomState,
  declareAtom,
  isObject,
  Track,
} from '../internal'

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
  computer: ($: Track<any, {}>) => State,
  fetcher: (params: Params) => Promise<State extends any ? State : never>,
  id = `resource [${++resourcesCount}]`,
) {
  const atom = declareAtom(
    ($, state?: { data: State; err: null | Error; req: boolean }) => {
      if (state === undefined) {
        state = { data: computer($), err: null as null | Error, req: false }
      } else {
        const data = computer(
          $,
          // @ts-expect-error
          state.data,
        )

        Object.is(data, state.data)
      }

      $(atom.get, (params) => ({ dispatch }, ctx) => {
        const isParamsNew =
          'params' in ctx === false || !shallowEqual(ctx.params, params)
        if (isParamsNew) dispatch(atom.req(params))
      })

      $(atom.req, (params) => ({ dispatch }, ctx) => {
        const version = ++ctx.version
        ctx.params = params
        return fetcher(params).then(
          (data) => {
            if (ctx.version === version) dispatch(atom.res(data))
          },
          (error) => {
            error = error instanceof Error ? error : new Error(error)
            if (ctx.version === version) dispatch(atom.err(error))
          },
        )
      })

      $(atom.rej, () => (store, ctx) => ctx.version++)

      return state
    },
    {
      id,
      createCtx: (): { params?: Params; version: number } => ({ version: 0 }),
    },
    {
      get: (params: Params, state) => state,

      req: (params: Params, state) =>
        state.req
          ? state
          : {
              data: state.data,
              err: null,
              req: true,
            },

      res: (data: State) => ({ data, err: null, req: false }),

      err: (err: Error, state) => ({ data: state.data, err, req: false }),

      rej: (payload: void, state) => ({ ...state, req: false }),
    },
  )

  return atom
}

/* --- EXAMPLE --- */

type Product = {}

const productsAtom = declareResource(
  ($, state = new Array<Product>()) => state,
  (page: number = 0) =>
    fetch(`/api/products?page=${page}`).then((r) => r.json()),
)

const pageAtom = declareAtom(
  ($, state = 0) => state,
  {
    onChange: (oldState, state, { dispatch }) =>
      dispatch(productsAtom.get(state)),
  },
  {
    next: (payload: void, state) => state + 1,
    prev: (payload: void, state) => Math.max(0, state - 1),
  },
)

export function Products() {
  const [{ data, req }] = useAtom(productsAtom)
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
    <span>${req ? `Loading` : page}</span>
    <button onClick=${prev}>prev</button>
  `
}

declare function Product(props: { data: Product }): string

declare function useAtom<T extends Atom<any, any>>(
  atom: T,
): [
  AtomState<T>,
  {
    [K in keyof T]: T[K] extends AC ? T[K]['dispatch'] : never
  },
]

declare function html(...a: any[]): string
