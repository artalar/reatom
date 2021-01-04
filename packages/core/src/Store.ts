import {
  IAction,
  addToSetsMap,
  IAtom,
  IAtomCache,
  IAtomPatch,
  callSafety,
  createMemo,
  delFromSetsMap,
  F,
  init,
} from './internal'

export class Store {
  private activeAtoms = new Map<string, Set<IAtom>>()
  private listeners = new Map<string, Set<F<[IAction, Map<IAtom, IAtomCache>]>>>()
  private cache = new WeakMap<IAtom, IAtomCache>()

  protected set<T>(atom: IAtom<T>, cache: IAtomCache<T>) {
    this.cache.set(atom, cache)
  }
  protected get<T>(atom: IAtom<T>): IAtomCache<T> | undefined {
    return this.cache.get(atom)
  }

  dispatch(action: IAction) {
    const activeAtoms = this.activeAtoms.get(action.type)

    if (!activeAtoms) return

    const patch = new Map<IAtom, IAtomPatch>()

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

  subscribe<T>(atom: IAtom<T>, cb: F<[T]>): F<[], void> {
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

  getState<T>(atom: IAtom<T>): T | undefined {
    return this.cache.get(atom)?.state
  }
}
