import { declareAction, declareAtom } from '../'

let resourcesCount = 0
export function declareResource<State, Params = void>(
  initialState: State,
  fetcher: (params: Params) => Promise<State>,
  id = `resource [${++resourcesCount}]`,
) {
  const get = declareAction<Params>(`get of ${id}`)
  const req = declareAction<Params>(`req of ${id}`)
  const res = declareAction<State>(`res of ${id}`)
  const err = declareAction<Error>(`err of ${id}`)
  const rej = declareAction(`rej of ${id}`)

  const initTag = Symbol()
  const paramsAtom = declareAtom(($, state = initTag as unknown) => {
    $(req.handle(params => (state = params)))
    return state
  }, `params of ${id}`)
  const versionAtom = declareAtom(($, state = 0) => {
    $(req.handle(() => state++))
    $(rej.handle(() => state++))
    return state
  }, `version of ${id}`)

  const reqAtom = declareAtom(($, state = false) => {
    $(req.handle(() => (state = true)))
    $(res.handle(() => (state = false)))
    $(err.handle(() => (state = false)))
    $(rej.handle(() => (state = false)))
    return state
  }, `req of ${id}`)

  const errAtom = declareAtom(($, state = null as null | Error) => {
    $(err.handle(e => (state = e)))
    $(res.handle(() => (state = null)))
    return state
  }, `err of ${id}`)

  return Object.assign(
    declareAtom(($, state = initialState) => {
      // force initialization
      $(reqAtom)
      $(errAtom)

      const params = $(paramsAtom)
      const version = $(versionAtom)

      $(
        get.handleEffect(
          ({ payload }, { dispatch }) =>
            (params === initTag || payload !== params) &&
            dispatch(req(payload)),
        ),
      )

      $(
        req.handleEffect(({ payload }, { dispatch, getState }) =>
          fetcher(payload).then(
            data => getState(versionAtom) === version && dispatch(res(data)),
            error =>
              getState(versionAtom) === version &&
              dispatch(err(error instanceof Error ? error : new Error(error))),
          ),
        ),
      )

      $(res.handle(data => (state = data)))

      return state
    }, id),
    {
      /** Action for data request. Memoized by fetcher params */
      get,
      /** Action for forced data request */
      req,
      /** Action for fetcher response */
      res,
      /** Action for fetcher error */
      err,
      /** Action for cancel pending request */
      rej,
      /** Atom of loading status (boolean) */
      reqAtom,
      /** Atom of fetcher error (null | Error) */
      errAtom,
    },
  )
}
