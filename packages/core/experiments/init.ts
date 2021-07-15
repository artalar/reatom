import { Store, Atom } from '@reatom/core'

const noop = () => {}

export function init(store: Store, ...atoms: Array<Atom>) {
  const unsubscribers = atoms.map((atom) => store.subscribe(atom, noop))
  return () => unsubscribers.forEach((un) => un())
}
