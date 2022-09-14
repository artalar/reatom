import {
  action,
  atom,
  Atom,
  AtomCache,
  AtomMeta,
  AtomState,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { addOnUpdate, onConnect } from '@reatom/hooks'

export interface PersistRecord {
  data: unknown
  version: number
}

export interface PersistStorage {
  get(ctx: Ctx, meta: AtomMeta): null | PersistRecord
  set(ctx: Ctx, meta: AtomMeta, rec: PersistRecord): void
  clear?(ctx: Ctx, meta: AtomMeta): void
  subscribe?(
    ctx: Ctx,
    meta: AtomMeta,
    callback: Fn<[PersistRecord]>,
  ): Unsubscribe
}

const notInitiated: Fn = () =>
  throwReatomError(1, 'persistStorageAtom is not initiated with any storage')

export const persistStorageAtom = atom<PersistStorage>(
  {
    get: notInitiated,
    set: notInitiated,
    clear: notInitiated,
    subscribe: notInitiated,
  },
  'persistStorage',
)

export const withPersist =
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
    const meta = anAtom.__reatom
    const { initState } = meta

    throwReatomError(!meta.name, 'atom name is required for persistence')

    const getData = (ctx: Ctx, rec: null | PersistRecord) =>
      rec?.version === version
        ? fromSnapshot(ctx, rec.data)
        : rec !== null && migration !== undefined
        ? migration(rec).data
        : initState(ctx)

    anAtom.__reatom.initState = (ctx) =>
      getData(ctx, ctx.get(persistStorageAtom).get(ctx, meta))

    addOnUpdate(anAtom, (ctx, { state }) =>
      ctx
        .get(persistStorageAtom)
        .set(ctx, meta, { data: toSnapshot(ctx, state), version }),
    )

    if (subscribe) {
      onConnect(anAtom, (ctx) =>
        ctx
          .get(persistStorageAtom)
          .subscribe?.(ctx, meta, (rec) =>
            ctx.get((read, actualize) =>
              actualize!(
                ctx,
                meta,
                (patchCtx: Ctx, patch: AtomCache) =>
                  (patch.state = fromSnapshot(ctx, rec.data)),
              ),
            ),
          ),
      )
    }

    if (clearTimeout !== -1) {
      ;(meta.onCleanup ??= new Set()).add((ctx) =>
        // FIXME: drop timeout when reconnect
        setTimeout(
          () =>
            ctx.get(
              (read) =>
                read(meta)!.isConnected ||
                ctx.get(persistStorageAtom).clear?.(ctx, meta),
            ),
          clearTimeout,
        ),
      )
    }

    return anAtom
  }

export const clearPersist = action((ctx, anAtom: Atom) =>
  ctx.get(persistStorageAtom).clear?.(ctx, anAtom.__reatom),
)
