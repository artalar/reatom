import {
  action,
  atom,
  Atom,
  AtomCache,
  AtomProto,
  AtomState,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { addOnUpdate, isConnected, onConnect } from '@reatom/hooks'

export interface PersistRecord {
  data: unknown
  version: number
}

export interface PersistStorage {
  get(ctx: Ctx, proto: AtomProto): null | PersistRecord
  set(ctx: Ctx, proto: AtomProto, rec: PersistRecord): void
  clear?(ctx: Ctx, proto: AtomProto): void
  subscribe?(
    ctx: Ctx,
    proto: AtomProto,
    callback: Fn<[PersistRecord]>,
  ): Unsubscribe
}

const notInitiated: Fn = () =>
  throwReatomError(1, 'persistStorageAtom is not initiated with any storage')

export const reatomPersist = (storage: PersistStorage) => {
  const persistStorageAtom = atom(storage, 'persistStorage')

  const withPersist =
    <A extends Atom>({
      clearTimeout = -1,
      fromSnapshot = (ctx, data: any) => data,
      migration,
      subscribe = false,
      toSnapshot = (ctx, data: any) => data,
      version = 0,
    }: {
      clearTimeout?: number
      fromSnapshot?: Fn<[Ctx, unknown], AtomState<A>>
      migration?: Fn<[PersistRecord], PersistRecord>
      subscribe?: boolean
      toSnapshot?: Fn<[Ctx, AtomState<A>], unknown>
      version?: number
    } = {}) =>
    (anAtom: A): A => {
      const proto = anAtom.__reatom
      const { initState } = proto

      throwReatomError(!proto.name, 'atom name is required for persistence')

      const getData = (ctx: Ctx, rec: null | PersistRecord) =>
        rec?.version === version
          ? fromSnapshot(ctx, rec.data)
          : rec !== null && migration !== undefined
          ? migration(rec).data
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
