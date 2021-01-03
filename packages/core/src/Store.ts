import {
  Action,
  addToSetsMap,
  Atom,
  AtomCache,
  AtomPatch,
  callSafety,
  createMemo,
  delFromSetsMap,
  F,
  init,
} from './internal'

export class Store {
  private activeAtoms = new Map<string, Set<Atom>>()
  private listeners = new Map<string, Set<F<[Action, Map<Atom, AtomCache>]>>>()
  private cache = new WeakMap<Atom, AtomCache>()

  protected set<T>(atom: Atom<T>, cache: AtomCache<T>) {
    this.cache.set(atom, cache)
  }
  protected get<T>(atom: Atom<T>): AtomCache<T> | undefined {
    return this.cache.get(atom)
  }

  dispatch(action: Action) {
    const activeAtoms = this.activeAtoms.get(action.type)

    if (!activeAtoms) return

    const patch = new Map<Atom, AtomPatch>()

    const memo = createMemo({ action, cache: this.cache, patch })

    activeAtoms.forEach(memo)

    patch.forEach((cache, atom) => {
      const {
        deps,
        listeners,
        state,
        types,
        isDepsChange,
        isStateChange,
        isTypesChange,
      } = cache
      if (isDepsChange || isStateChange || isTypesChange) {
        this.set(atom, {
          deps,
          listeners,
          state,
          types,
        })
      }

      if (isTypesChange) {
        types.forEach(t => delFromSetsMap(this.activeAtoms, t, atom))
        types.forEach(t => addToSetsMap(this.activeAtoms, t, atom))
      }
    })
    patch.forEach(
      cache =>
        cache.isStateChange &&
        cache.listeners.forEach(cb => callSafety(cb, cache.state)),
    )
    this.listeners
      .get(action.type)
      ?.forEach(cb => callSafety(cb, action, patch))
  }

  subscribe<T>(atom: Atom<T>, cb: F<[T]>): F<[], void> {
    let cache = this.cache.get(atom)
    if (!cache) {
      this.cache.set(
        atom,
        (cache = createMemo({
          action: init(),
          cache: this.cache,
          patch: new Map(),
        })(atom)),
      )!
      cache.types.forEach(t => addToSetsMap(this.activeAtoms, t, atom))
    }

    cache.listeners.add(cb)

    return () => {
      cache!.listeners.delete(cb)
      if (cache!.listeners.size === 0) {
        cache!.types.forEach(t => delFromSetsMap(this.activeAtoms, t, atom))
      }
    }
  }

  getState<T>(atom: Atom<T>): T | undefined {
    return this.cache.get(atom)?.state
  }
}
