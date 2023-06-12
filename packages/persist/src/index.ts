import {
  atom,
  Atom,
  AtomMut,
  AtomState,
  Ctx,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { onConnect, onUpdate } from '@reatom/hooks'
import { random } from '@reatom/utils'

export interface PersistRecord {
  data: unknown
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
  subscribe?(ctx: Ctx, key: string, callback: () => any): Unsubscribe
}

export interface WithPersistOptions<T> {
  /** parse data on init or subscription update @optional */
  fromSnapshot?:  (ctx: Ctx, snapshot: unknown, state?: T) => T
  /** the key! */
  key: string
  /** migration callback which will be called if the version changed  @optional */
  migration?: (ctx: Ctx, persistRecord: PersistRecord) => T
  /** turn on/off subscription  @default true */
  subscribe?: boolean
  /** time to live in milliseconds @default 10 ** 10 */
  time?: number
  /** transform data before persisting  @optional */
  toSnapshot?: (ctx: Ctx, state: T) => unknown
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
        time = 10 ** 10,
        toSnapshot = (ctx, data: any) => data,
        version = 0,
      }: WithPersistOptions<AtomState<T>> = typeof options === 'string'
        ? { key: options }
        : options
      const proto = anAtom.__reatom
      const { initState } = proto

      const getPersistRecord = (ctx: Ctx, state?: any) => {
        const rec = ctx.get(storageAtom).get(ctx, key)

        return rec?.fromState ? state : rec
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

      const persistRecordAtom = atom(
        getPersistRecord,
        `${anAtom.__reatom.name}._${storage.name}Atom`,
      )

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
            ctx.get((read, actualize) =>
              actualize!(ctx, persistRecordAtom.__reatom, () => {
                /* this will rerun the computed */
              }),
            )
          }),
        )
      } else {
        anAtom.__reatom.initState = fromPersistRecord
      }

      onUpdate(anAtom, (ctx, state) => {
        ctx.get(storageAtom).set(ctx, key, toPersistRecord(ctx, state))
      })

      return anAtom
    }

  return Object.assign(withPersist, { storageAtom })
}
