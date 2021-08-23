import {
  Atom,
  AtomState,
  Cache,
  createTemplateCache,
  Fn,
  pushUnique,
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

      cache = {
        atom,
        cause: depAtom.id,
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
    let causes: Array<string> = []
    let { atom, cause, ctx, state, tracks, listeners } = cache

    if (tracks === undefined) {
      causes.push(`init`)
    }

    tracks = atoms.map((a, i) => {
      const patch = process(a)

      if (
        // @ts-expect-error
        tracks?.length > 0 &&
        !Object.is(patch.state, tracks![i].state)
      ) {
        causes.push(a.id)
      }

      return patch
    })

    if (causes.length > 0) {
      state = map(tracks.map(({ state }) => state) as any)

      cause = causes.join(`, `)
    }

    return { atom, cause, ctx, tracks, state: state!, listeners }
  }

  atom.id = id

  atom.types = []

  atoms.forEach(({ types }) =>
    types.forEach((type) => pushUnique(atom.types, type)),
  )

  return atom
}
