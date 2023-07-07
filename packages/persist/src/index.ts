import {
  __root,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  AtomState,
  Ctx,
  Fn,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { MAX_SAFE_TIMEOUT, random } from '@reatom/utils'

export interface PersistRecord {
  data: unknown
  /** @deprecated not need anymore */
  fromState: boolean
  id: number
  timestamp: number
  version: number
  to: number
}

export interface PersistStorage {
  name: string
  get(ctx: Ctx, key: string): null | PersistRecord
  set(ctx: Ctx, key: string, rec: PersistRecord): void
  clear?(ctx: Ctx, key: string): void
  subscribe?(ctx: Ctx, key: string, callback: Fn<[]>): Unsubscribe
}

export interface WithPersistOptions<T> {
  /** parse data on init or subscription update @optional */
  fromSnapshot?: Fn<[ctx: Ctx, snapshot: unknown, state?: T], T>
  /** the key! */
  key: string
  /** migration callback which will be called if the version changed  @optional */
  migration?: Fn<[ctx: Ctx, persistRecord: PersistRecord], T>
  /** turn on/off subscription  @default true */
  subscribe?: boolean
  /** time to live in milliseconds @default 10 ** 10 */
  time?: number
  /** transform data before persisting  @optional */
  toSnapshot?: Fn<[ctx: Ctx, state: T], unknown>
  /** version of the data which change used to trigger the migration @default 0 */
  version?: number
}

export interface WithPersist {
  <T extends Atom>(
    options:
      | WithPersistOptions<AtomState<T>>['key']
      | WithPersistOptions<AtomState<T>>,
  ): (anAtom: T) => T
}

export const reatomPersist = (
  storage: PersistStorage,
): WithPersist & {
  storageAtom: AtomMut<PersistStorage>
} => {
  const storageAtom = atom(storage, `storageAtom#${storage.name}`)

  const withPersist: WithPersist =
    <T extends Atom>(
      options:
        | WithPersistOptions<AtomState<T>>['key']
        | WithPersistOptions<AtomState<T>>,
    ) =>
    (anAtom: T): T => {
      const {
        key,
        fromSnapshot = (ctx, data: any) => data,
        migration,
        subscribe = true,
        time = MAX_SAFE_TIMEOUT,
        toSnapshot = (ctx, data: any) => data,
        version = 0,
      }: WithPersistOptions<AtomState<T>> = typeof options === 'string'
        ? { key: options }
        : options
      const proto = anAtom.__reatom
      const { initState } = proto

      const getPersistRecord = (
        ctx: Ctx,
        state: PersistRecord | null = null,
      ) => {
        const rec = ctx.get(storageAtom).get(ctx, key)

        return rec?.id === state?.id ? state : rec ?? state
      }

      const fromPersistRecord = (
        ctx: Ctx,
        rec: null | PersistRecord = getPersistRecord(ctx),
        state?: AtomState<T>,
      ) =>
        rec === null || (rec.version !== version && migration === undefined)
          ? initState(ctx)
          : fromSnapshot(
              ctx,
              rec.version !== version ? migration!(ctx, rec) : rec.data,
              state,
            )

      const toPersistRecord = (
        ctx: Ctx,
        state: AtomState<T>,
      ): PersistRecord => ({
        data: toSnapshot(ctx, state),
        fromState: true,
        id: random(),
        timestamp: Date.now(),
        to: Date.now() + time,
        version,
      })

      throwReatomError(!key, 'missed key')

      const persistRecordAtom = atom<PersistRecord | null>(
        null,
        `${anAtom.__reatom.name}._${storage.name}Atom`,
      )
      // @ts-expect-error TODO
      persistRecordAtom.__reatom.computer = getPersistRecord

      if (subscribe) {
        const { computer } = anAtom.__reatom
        // @ts-expect-error hard to type optional `state`
        anAtom.__reatom.computer = (ctx, state?: AtomState<T>) => {
          ctx.spy(persistRecordAtom, (rec) => {
            state = fromPersistRecord(ctx, rec, state)
          })

          return computer ? computer(ctx, state) : state
        }

        onConnect(anAtom, (ctx) =>
          ctx.get(storageAtom).subscribe?.(ctx, key, () => {
            // this will rerun the computed
            persistRecordAtom(ctx, (state) => state)
          }),
        )
      } else {
        anAtom.__reatom.initState = fromPersistRecord
      }

      anAtom.onChange((ctx, state) => {
        const { cause: patch } = ctx
        const rootCause = ctx.get((read) => read(__root))!
        // put a patch to the proto
        ctx.get(persistRecordAtom)
        let recPatch: AtomCache = ctx.get((read, actualize) =>
          actualize!(ctx, persistRecordAtom.__reatom),
        )

        if (patch.cause === recPatch && recPatch.cause === patch) {
          recPatch.cause = rootCause
        }

        if (anAtom.__reatom.patch === patch && patch.cause !== recPatch) {
          const { subs } = recPatch
          // @ts-expect-error hack to prevent cycles
          recPatch.subs = new Set()
          const rec = persistRecordAtom(ctx, toPersistRecord(ctx, state))!
          // @ts-expect-error hack to prevent cycles
          ;(recPatch = recPatch.proto.patch).subs = recPatch.subs = subs

          recPatch.cause = rootCause

          const idx = patch.pubs.findIndex(
            ({ proto }) => proto === recPatch.proto,
          )
          patch.pubs[idx] = recPatch

          ctx.get(storageAtom).set(ctx, key, rec)
        }
      })

      return anAtom
    }

  return Object.assign(withPersist, { storageAtom })
}
