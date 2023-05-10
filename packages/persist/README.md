Base primitive to create your own persist adapters. Check https://www.reatom.dev/packages/persist-web-storage for product usage or inspiration.

One of the features is that each adapter has `storageAtom` which you could change for testing purposes.[testing package](https://www.reatom.dev/packages/testing#createmockstorage) has `createMockStorage` util. Check out [tests of this package](https://github.com/artalar/reatom/blob/v3/packages/persist/src/index.test.ts)

Main types.

```ts
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
```
