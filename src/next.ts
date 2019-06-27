type StateTree = { [key in string]?: StateTree }
type AtomReducer = any

export class Path extends Array {
  _id: string
  constructor(...a) {
    super(...a)
    this._id = this.join('.')
  }
}

export class Ctx {
  state: StateTree
  stateNew: StateTree
  type: string
  payload: any
  visited: { [key in string]: 0 }
  constructor(state, type, payload) {
    this.state = state
    this.stateNew = {}
    this.type = type
    this.payload = payload
    this.visited = {}
  }
  write(path: Path, value: any) {
    let { state, stateNew } = this
    const lastItemIndex = path.length - 1
    for (let i = 0; i < lastItemIndex; i++) {
      const key = path[i]
      const stateNewNext = stateNew[key]

      // @ts-ignore
      state = (state || {})[key]

      stateNew =
        stateNewNext === undefined
          ? (stateNew[key] =
              state === undefined ? {} : Object.assign({}, state))
          : stateNewNext
    }
    stateNew[path[lastItemIndex]] = value
  }
}

let id = 0
function generateId() {
  return ++id
}
function generatePath(path: Path | string): Path {
  if (path instanceof Path) return path
  if (Array.isArray(path)) return new Path(...path)
  if (typeof path === 'string' && path.length !== 0)
    return new Path(`${path} [${generateId()}]`)
  return new Path(`[${generateId()}]`)
}

export function readStateByPath(state: StateTree, path: Path) {
  const lastItemIndex = path.length - 1
  for (let i = 0; i < lastItemIndex; i++) state = state[path[i]] || {}
  return state[path[lastItemIndex]]
}
export function readState(state: StateTree, reducer) {
  return readStateByPath(state, reducer._path)
}

export function createAction<T>(
  type: string | Path = 'action',
  mapper = payload => payload,
) {
  const path = generatePath(type)
  const id = path._id
  const deps = {
    [id]: 0,
  }

  if (id.length === 0) throw new TypeError('Invalid type')
  if (typeof mapper !== 'function') throw new TypeError('Invalid mapper')

  function actionCreator(payload?: T) {
    return {
      type: id,
      payload: mapper(payload),
    }
  }

  actionCreator.getType = () => id
  actionCreator.reduce = function reduce(
    reducer: <State>(state: State, payload: T) => State,
  ): AtomReducer {
    if (typeof reducer !== 'function') throw new TypeError('Invalid reducer')

    function createAtomReducer(parentPath: Path) {
      return function atomReducer(ctx: Ctx) {
        const { state, stateNew, type, payload } = ctx
        if (type !== id) return

        let atomState = readStateByPath(stateNew, parentPath)
        if (atomState === undefined)
          atomState = readStateByPath(state, parentPath)
        atomState = reducer(atomState, payload)
        if (atomState === undefined)
          throw new TypeError("State can't be undefined")

        ctx.write(parentPath, atomState)
      }
    }

    return {
      createAtomReducer,
      deps,
    }
  }

  return actionCreator
}

export const actionDefault = createAction()

export function createAtom(name, initialState, handlers) {
  if (arguments.length === 2) {
    handlers = initialState
    initialState = name
    name = generatePath('reducer')
  }
  if (name.length === 0) throw new TypeError('Invalid name')
  if (initialState === undefined) throw new TypeError('Invalid initialState')
  if (!Array.isArray(handlers)) throw new TypeError('Invalid handlers')

  handlers.unshift(actionDefault.reduce((state = initialState) => state))

  const atomPath = generatePath(name)
  const atomId = atomPath._id
  const atomDeps: { [key in string]: 0 } = {}
  const atomHandlers = (handlers as Function[]).map(
    ({ createAtomReducer, deps }) => {
      Object.assign(atomDeps, deps)
      return createAtomReducer(atomPath)
    },
  ) as ((ctx: Ctx) => void)[]

  function atom(
    state: StateTree,
    action: { type: string; payload: any },
    merger = (ctx: Ctx) => Object.assign({}, ctx.state, ctx.stateNew),
  ) {
    const { type, payload } = action

    if (atomDeps[type] === undefined) return state

    const ctx = new Ctx(state, type, payload)

    atomHandlers.forEach(atomHandler => atomHandler(ctx))

    return merger(ctx)
  }

  function invalidateDeps(ctx: Ctx) {
    const { type, visited } = ctx
    if (atomDeps[type] === undefined) return false

    if (visited[atomId] === undefined) {
      atomHandlers.forEach(atomHandler => atomHandler(ctx))
      visited[atomId] = 0
    }

    return true
  }

  atom._path = atomPath
  atom._invalidateDeps = invalidateDeps
  atom.reduce = function reduce(reducer): AtomReducer {
    if (typeof reducer !== 'function') throw new TypeError('Invalid reducer')

    function createAtomReducer(parentPath: Path) {
      return function atomReducer(ctx: Ctx) {
        if (invalidateDeps(ctx)) {
          const { state, stateNew } = ctx

          let atomState = readStateByPath(stateNew, atomPath)
          if (atomState === undefined)
            atomState = readStateByPath(state, atomPath)

          let parentAtomState = readStateByPath(stateNew, parentPath)
          if (parentAtomState === undefined)
            parentAtomState = readStateByPath(state, parentPath)
          parentAtomState = reducer(parentAtomState, atomState)
          if (parentAtomState === undefined)
            throw new TypeError("State can't be undefined")

          ctx.write(parentPath, parentAtomState)
        }
      }
    }

    return {
      createAtomReducer,
      deps: atomDeps,
    }
  }

  return atom
}

export function map(name, target, reducer) {
  if (arguments.length === 2) {
    reducer = target
    target = name
    name = generatePath('map')
  } else {
    name = generatePath(name)
  }

  return createAtom(
    name,
    // FIXME: initialState for `map` :thinking:
    null,
    [target.reduce((state, payload) => reducer(payload))],
  )
}

export function combine(name, shape) {
  if (arguments.length === 1) {
    shape = name
    name = generatePath('combine')
  } else {
    name = generatePath(name)
  }

  const keys = Object.keys(shape)

  return createAtom(
    name,
    {},
    keys.map(key =>
      shape[key].reduce((state, payload) =>
        Object.assign({}, state, {
          [key]: payload,
        }),
      ),
    ),
  )
}
