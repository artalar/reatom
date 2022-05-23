const {
  action,
  atom,
  isAtom,
  isAction,
  createContext,
  isStale,
  subscribe,
  log,
  read,
  run,
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
  return [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]
}

const getIsAtom = (thing) => thing?.__reatom_atom === true
const getIsAction = (thing) => thing?.__reatom_action === true

const getState = (obj, atom) => obj[atom.__reatom.name]

const ctxToStore = (ctx) => {
  if ('v1store' in ctx) return ctx.v1store

  const allCaches = new Map()

  log(ctx, (patches) =>
    patches.forEach((cache, atom) => allCaches.set(atom, cache)),
  )

  const actionsListeners = new Set()
  const store = {
    dispatch(action) {
      run(ctx, () => {
        ctx.schedule(() =>
          actionsListeners.forEach((cb) => cb(action, /* TODO stateDiff */ {})),
        )
        action.v3action(ctx, action.payload)
      })
    },
    subscribe(thing, cb) {
      if (cb === undefined) {
        actionsListeners.add(thing)
        return () => actionsListeners.delete(thing)
      }

      let skipFirst = true
      return subscribe(ctx, thing, (v) => {
        if (skipFirst) {
          skipFirst = false
          return
        }
        cb(v)
      })
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

  store.v3ctx = ctx
  ctx.v1store = store

  return store
}

const createStore = (atomOrState, state) => {
  if (!getIsAtom(atomOrState)) state = atomOrState

  const store = ctxToStore(
    createContext(
      state && {
        createCache: (meta) => ({
          state: meta.name in state ? state[meta.name] : meta.initState,
          meta,
          cause: null,
          parents: [],
          children: new Set(),
          listeners: new Set(),
        }),
      },
    ),
    state,
  )

  if (getIsAtom(atomOrState)) store.subscribe(atomOrState, () => {})

  if (state) store.dispatch(init(state))

  return store
}

let i = 0
const declareAction = (name, ...reactions) => {
  let type
  if (typeof name === 'function') {
    reactions.unshift(name)
    name = undefined
  } else if (Array.isArray(name)) {
    type = name = name[0]
  }

  const v3action = action((ctx, payload) => {
    ctx.schedule(() => reactions.forEach((cb) => cb(payload, ctxToStore(ctx))))
    return payload
  }, name)

  if (type) v3action.__reatom.name = type
  else type = v3action.__reatom.name

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

  let id
  if (typeof name === 'symbol') {
    isInspectable = false
    name = name.description || name.toString().replace(/Symbol\((.*)\)/, '$1')
  } else if (Array.isArray(name)) {
    id = name = name[0]
  }

  const v3atom = Object.assign(
    (states = {}, action = initAction) => {
      const store = (createStore(states))
      const { v3ctx: ctx } = store
      log(
        ctx,
        (patches, error) =>
          !error &&
          patches.forEach(({ meta, state }) => (states[meta.name] = state)),
      )
      subscribe(ctx, v3atom, () => {})
      action.v3action(ctx, action.payload)

      return states
    },
    atom(
      (ctx, state = initState) => {
        const inits = ctx.spy(init)

        inits.forEach(
          ({ [v3atom.__reatom.name]: newState = state } = {}) =>
            (state = newState),
        )

        if (
          inits.length === 1 &&
          !isStale(read(ctx, v3atom.__reatom)) &&
          !inits[0]
        ) {
          return state
        }

        const prevCache = read(ctx, v3atom)
        let i = 0
        depMatcher((target, handler) => {
          const targetState = ctx.spy(target)
          if (getIsAction(target)) {
            targetState.forEach((payload) => (state = handler(state, payload)))
          } else if (getIsAtom(target)) {
            const targetPrevState = prevCache?.parents[i].state

            if (!Object.is(targetState, targetPrevState))
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

  if (id) v3atom.__reatom.name = id

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
        if (!Array.isArray(state) && isArray)
          console.log('TEST', { name, state, shape })
        const newState = isArray ? state.slice(0) : Object.assign({}, state)
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
