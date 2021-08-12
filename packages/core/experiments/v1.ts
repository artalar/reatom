import {
  Atom,
  AtomState,
  Cache,
  createTemplateCache,
  Fn,
  pushUnique,
  scheduleAtomListeners,
} from '@reatom/core'

let mapsCount = 0
export function map<T, Dep>(
  depAtom: Atom<Dep>,
  cb: Fn<[depState: Dep], T>,
  id: string = `map ${depAtom.id} [${++mapsCount}]`,
): Atom<T> {
  const atom: Atom<T> = (
    { process, schedule },
    cache = createTemplateCache(atom),
  ) => {
    const depPatch = process(depAtom)
    const dep = cache.tracks?.length === 1 ? cache.tracks[0] : null

    if (!Object.is(dep?.state, depPatch.state)) {
      const state = cb(depPatch.state /* , cache.state */)

      scheduleAtomListeners(cache as Cache, state, schedule, depAtom.id)

      cache = {
        atom,
        ctx: cache.ctx,
        tracks: [depPatch],
        state,
        listeners: cache.listeners,
      }
    }

    return cache as Cache<T>
  }

  atom.id = id

  atom.types = depAtom.types

  return atom
}

let combineCount = 0
export function combine<Atoms extends Array<Atom>, Result>(
  atoms: Atoms,
  map: Fn<
    [{ [K in keyof Atoms]: K extends number ? AtomState<Atoms[K]> : never }],
    Result
  >,
  id: string = `combine [${++combineCount}]`,
): Atom<Result> {
  const atom: Atom<Result> = (
    { process, schedule },
    cache = createTemplateCache<Result>(atom),
  ) => {
    const tracks = atoms.map((a) => process(a))
    let { atom, ctx, state, listeners } = cache

    // TODO: improve
    const causes = cache.tracks
      ?.filter(({ state }, i) => !Object.is(state, tracks[i].state))
      .map(({ atom }) => atom.id) ?? ['init']

    if (causes.length > 0) {
      state = map(tracks.map(({ state }) => state) as any)

      scheduleAtomListeners(cache as Cache, state, schedule, causes.join(`, `))
    }

    return { atom, ctx, tracks, state: state!, listeners }
  }

  atom.id = id

  atom.types = []

  atoms.forEach(({ types }) =>
    types.forEach((type) => pushUnique(atom.types, type)),
  )

  return atom
}
