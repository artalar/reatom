import { action, atom, isAtom, isAction, createContext } from './atom'

export const getIsAtom = (thing) => thing?.__reatom_atom === true
export const getIsAction = (thing) => thing?.__reatom_action === true

export const getState = (obj, atom) => obj[atom.__reatom.name]

const ctxToStore = (ctx) => {
  if ('v1store' in ctx) return ctx.v1store

  const allCaches = new Map()

  ctx.onPatch(({ patch }) =>
    patch.forEach((cache, atom) => allCaches.set(atom, cache)),
  )

  const store = {
    dispatch(action) {
      ctx.run(() => action.v3action(ctx, action.payload))
    },
    subscribe(thing, cb) {
      return ctx.subscribe(thing.v3atom ?? thing.v3action, cb)
    },
    getState: (atom) => {
      if (atom) return ctx.get(atom)

      cleanOutdated()

      const result = {}

      allCaches.forEach((cache, atom) => {
        if (isStale(cache)) allCaches.delete(atom)
        else result[cache.meta.id] = cache.state
      })

      return result
    },
    bind: (action) => Object.assign(action.bind(null, ctx), action),
  }

  return (ctx.v1store = store)
}

export const createStore = () => ctxToStore(createContext())

let i = 0
export const declareAction = (name, ...reactions) => {
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
  })
  const type = v3action.__reatom.name

  return Object.assign((payload) => ({ payload, type, v3action }), v3action, {
    getType: () => type,
    v3action,
    __reatom_action: true,
  })
}

export const initAction = declareAction()

export const declareAtom = (...a) => {
  if (a.length === 2) {
    var [initState, depMatcher] = a
  } else if (a.length === 3) {
    var [name, initState, depMatcher] = a
  } else {
    throw new TypeError('Wrong declareAtom arguments')
  }

  if (typeof name === 'string') {
    name = `${name}[${++i}]`
  } else if (typeof name === 'symbol') {
    name = name.description
  } else if (Array.isArray(name)) {
    name = name[0]
  }

  const v3atom = Object.assign(
    (state, action) => {
      const states = {}
      const ctx = createContext()
      ctx.log(
        (patches, error) =>
          !error &&
          patches.forEach(({ meta, state }) => (states[meta.name] = state)),
      )
      ctx.run(() => {
        action.v3action(ctx, action.payload)
        v3atom.change(ctx, state)
      })

      return states
    },
    atom(
      (ctx, state = initState) => {
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
      { name },
    ),
    { __reatom_atom: true },
  )

  return v3atom
}

const _name = '_atomName_'
const _initialState = {}
const _atom = declareAtom(_name, _initialState, () => {})
const _state = _atom({}, initAction)
