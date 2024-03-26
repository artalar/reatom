import { AtomMut } from '@reatom/core'
import { PersistRecord, PersistStorage, WithPersist } from '@reatom/persist'

export interface WithPersistWebStorage extends WithPersist {
  storageAtom: AtomMut<PersistStorage>
}

export type BroadcastMessage =
  | {
      _type: 'push'
      key: string
      rec: PersistRecord | null
    }
  | {
      _type: 'pull'
      key: string
    }
