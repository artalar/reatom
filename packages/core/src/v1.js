const {
  action,
  atom,
  isAtom,
  isAction,
  createContext,
  isStale,
} = require('./atom')

const TREE = Symbol('@@Reatom/TREE')
const DEPS = Symbol('@@Reatom/DEPS')
const DEPS_SHAPE = Symbol('@@Reatom/DEPS_SHAPE')

function getTree(thing) {
  return thing && thing[TREE]
}

function getName(treeId) {
  return treeId
}

function getOwnKeys(obj) {
  const keys = Object.keys(obj)
  keys.push(...Object.getOwnPropertySymbols(obj))

  return keys
}

const getIsAtom = (thing) => thing?.__reatom_atom === true
const getIsAction = (thing) => thing?.__reatom_action === true

const getState = (obj, atom) => obj[atom.__reatom.name]

const ctxToStore = (ctx) => {
  if ('v1store' in ctx) return ctx.v1store

  const allCaches = new Map()

  ctx.log((patches) =>
    patches.forEach((cache, atom) => allCaches.set(atom, cache)),
  )

  const store = {
    dispatch(action) {
      ctx.run(() => action.v3action(ctx, action.payload))
    },
    subscribe(thing, cb) {
      return ctx.subscribe(thing, cb)
    },
    getState: (atom) => {
      if (atom) return ctx.get(atom)

      const result = {}

      allCaches.forEach((cache, atom) => {
        if (isStale(cache)) allCaches.delete(atom)
        else result[cache.meta.name] = cache.state
      })

      return result
    },
    bind: (action) => Object.assign(action.bind(null, ctx), action),
  }

  return (ctx.v1store = store)
}

const createStore = (atomOrState, state) => {
  const store = ctxToStore(createContext())

  if (!getIsAtom(atomOrState)) state = atomOrState
  else {
    store.subscribe(atomOrState, () => {})
    if (state) store.dispatch(init(state))
  }
  return store
}
3
let i = 0
const declareAction = (name, ...reactions) => {
  if (typeof name === 'function') {
    reactions.unshift(name)
    name = undefined
  } else if (Array.isArray(name)) {
    name = name[0]
  } else if (typeof name === 'string') {
    name = `${name}[${++i}]`
  }

  const v3action = action((ctx, payload) => {
    ctx.schedule(() => reactions.forEach((cb) => cb(payload, ctxToStore(ctx))))
    return payload
  }, name)
  const type = v3action.__reatom.name

  return Object.assign((payload) => ({ payload, type, v3action }), v3action, {
    __reatom_action: true,
    getType: () => type,
    v3action,
  })
}

const init = declareAction(['@@Reatom/init'])
const initAction = init()

const declareAtom = (...a) => {
  if (a.length === 2) {
    var [initState, depMatcher] = a
  } else if (a.length === 3) {
    var [name, initState, depMatcher] = a
  } else {
    throw new TypeError('Wrong declareAtom arguments')
  }

  let isInspectable = true

  if (typeof name === 'string') {
    name = `${name}[${++i}]`
  } else if (typeof name === 'symbol') {
    isInspectable = false
    name = name.description || name.toString().replace(/Symbol\((.*)\)/, '$1')
  } else if (Array.isArray(name)) {
    name = name[0]
  }

  const v3atom = Object.assign(
    (state, action = initAction) => {
      const states = {}
      const ctx = createContext()
      ctx.log(
        (patches, error) =>
          !error &&
          patches.forEach(({ meta, state }) => (states[meta.name] = state)),
      )
      ctx.run(() => {
        v3atom.change(ctx, state)
        action.v3action(ctx, action.payload)
      })

      return states
    },
    atom(
      (ctx, state = initState) => {
        const inits = ctx.spy(init)

        inits.forEach(
          ({ [v3atom.__reatom.name]: newState = initState } = {}) =>
            (state = newState),
        )

        if (inits.length === 1 && !isStale(state) && !inits[0]) return state

        const prevCache = ctx.read(v3atom)
        let i = 0
        depMatcher((target, handler) => {
          const targetState = ctx.spy(target)
          if (isAction(target)) {
            targetState.forEach((payload) => (state = handler(state, payload)))
          } else if (isAtom(target)) {
            const targetPrevStat = prevCache?.parents[i].state

            if (!Object.is(targetState, targetPrevStat))
              state = handler(state, targetState)
          }

          i++
        })

        return state
      },
      { isInspectable, name },
    ),
    { __reatom_atom: true },
  )

  v3atom[TREE] = { id: v3atom.__reatom.name }

  return v3atom
}

function map(name, source, mapper) {
  if (!mapper) {
    mapper = source
    source = name
    name = Symbol(`${getName(getTree(source).id)} [map]`)
  }

  return declareAtom(name, null, (on) =>
    on(source, (state, payload) => mapper(payload)),
  )
}

function combine(name, shape) {
  if (arguments.length === 1) shape = name
  const isArray = Array.isArray(shape)
  const keys = getOwnKeys(shape)
  if (arguments.length === 1)
    name = isArray
      ? Symbol(`[${keys.map((k) => getName(getTree(shape[k]).id)).join()}]`)
      : Symbol(`{${keys.map(getName).join()}}`)
  const atom = declareAtom(name, isArray ? [] : {}, (on) =>
    keys.forEach((key) =>
      on(shape[key], (state, payload) => {
        const newState = isArray ? state.slice(0) : assign({}, state)
        newState[key] = payload
        return newState
      }),
    ),
  )
  atom[DEPS_SHAPE] = shape
  return atom
}

function getDepsShape(thing) {
  return thing[DEPS_SHAPE]
}

module.exports = {
  combine,
  createStore,
  declareAction,
  declareAtom,
  DEPS_SHAPE,
  DEPS,
  getDepsShape,
  getIsAction,
  getIsAtom,
  getName,
  getOwnKeys,
  getState,
  getTree,
  init,
  initAction,
  map,
  TREE,
}
