import { Atom, defaultStore } from '@reatom/core'

const noop = () => {}

export function init(atoms: Array<Atom>, store = defaultStore) {
  const unsubscribers = atoms.map((atom) => store.subscribe(atom, noop))
  return () => unsubscribers.forEach((un) => un())
}
