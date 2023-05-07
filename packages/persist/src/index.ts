import {
  action,
  atom,
  Atom,
  AtomCache,
  AtomProto,
  AtomState,
  Ctx,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { addOnUpdate, isConnected, onConnect } from '@reatom/hooks'

export interface PersistRecord<T = unknown> {
  data: T
  version: number
}

export interface PersistStorage {
  get(ctx: Ctx, proto: AtomProto): null | PersistRecord
  set(ctx: Ctx, proto: AtomProto, rec: PersistRecord): void
  clear?(ctx: Ctx, proto: AtomProto): void
  subscribe?(
    ctx: Ctx,
    proto: AtomProto,
    callback: (rec: PersistRecord) => any,
  ): Unsubscribe
}

export interface WithPersistOptions<T extends Atom> {
  clearTimeout?: number
  fromSnapshot?: (ctx: Ctx, arg: unknown) => AtomState<T>
  key?: string
  migration?: (ctx: Ctx, rec: PersistRecord) => PersistRecord<AtomState<T>>
  subscribe?: boolean
  toSnapshot?: (ctx: Ctx, state: AtomState<T>) => unknown
  version?: number
}

export interface WithPersist {
  <T extends Atom>(options?: WithPersistOptions<T>): (anAtom: T) => T
}

export const reatomPersist = (storage: PersistStorage) => {
  const persistStorageAtom = atom(storage, 'persistStorage')

  const withPersist: WithPersist =
    <T extends Atom>({
      clearTimeout = -1,
      fromSnapshot = (ctx, data: any) => data,
      migration,
      subscribe = false,
      toSnapshot = (ctx, data: any) => data,
      version = 0,
    }: WithPersistOptions<T> = {}) =>
    (anAtom: T): T => {
      const proto = anAtom.__reatom
      const { initState } = proto

      throwReatomError(!proto.name, 'atom name is required for persistance')

      const getData = (ctx: Ctx, rec: null | PersistRecord) =>
        rec?.version === version
          ? fromSnapshot(ctx, rec.data)
          : rec !== null && migration !== undefined
          ? migration(ctx, rec).data
          : initState(ctx)

      anAtom.__reatom.initState = (ctx) =>
        getData(ctx, ctx.get(persistStorageAtom).get(ctx, proto))

      addOnUpdate(anAtom, (ctx, { state }) =>
        ctx
          .get(persistStorageAtom)
          .set(ctx, proto, { data: toSnapshot(ctx, state), version }),
      )

      if (subscribe) {
        onConnect(anAtom, (ctx) =>
          ctx
            .get(persistStorageAtom)
            .subscribe?.(ctx, proto, (rec) =>
              ctx.get((read, actualize) =>
                actualize!(
                  ctx,
                  proto,
                  (patchCtx: Ctx, patch: AtomCache) =>
                    (patch.state = fromSnapshot(ctx, rec.data)),
                ),
              ),
            ),
        )
      }

      if (clearTimeout !== -1) {
        ;(proto.disconnectHooks ??= new Set()).add((ctx) =>
          // FIXME: drop timeout when reconnect
          setTimeout(
            () =>
              ctx.get(
                (read) =>
                  isConnected(ctx, anAtom) ||
                  ctx.get(persistStorageAtom).clear?.(ctx, proto),
              ),
            clearTimeout,
          ),
        )
      }

      return anAtom
    }

  const clearPersist = action((ctx, anAtom: Atom) =>
    ctx.get(persistStorageAtom).clear?.(ctx, anAtom.__reatom),
  )

  return { withPersist, persistStorageAtom, clearPersist }
}
