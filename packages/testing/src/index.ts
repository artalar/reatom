import {
  Action,
  Atom,
  AtomCache,
  AtomProto,
  createCtx,
  Ctx,
  CtxOptions,
  isAtom,
  Rec,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { PersistRecord, PersistStorage } from '@reatom/persist'

export function mockFn<I extends any[], O>(
  fn: (...input: I) => O = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function (...i: I) {
      try {
        // @ts-ignore
        var o = fn.apply(this, i)
      } catch (error) {
        // @ts-ignore
        _fn.calls.push({ i, o: error })

        throw error
      }

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: new Array<{ i: I; o: O }>(),
      inputs(): Array<I[number]> {
        return _fn.calls.map(({ i }) => i[0])
      },
      lastInput(index = 0): I[number] {
        const { length } = _fn.calls
        if (length === 0) throw new TypeError(`Array is empty`)
        return _fn.calls[length - 1]!.i[index]
      },
    },
  )

  return _fn
}

export const getDuration = async (cb: () => void) => {
  const start = Date.now()
  await cb()
  return Date.now() - start
}

export interface TestCtx extends Ctx {
  mock<T>(anAtom: Atom<T>, fallback: T): Unsubscribe

  mockAction<I extends any[], O>(
    anAction: Action<I, O>,
    cb: (ctx: Ctx, ...rest: I) => O,
  ): Unsubscribe

  subscribeTrack<T, F extends (arg: T) => any>(
    anAtom: Atom<T>,
    cb?: F,
  ): F & {
    unsubscribe: Unsubscribe
    calls: ReturnType<typeof mockFn<[T], any>>['calls']
    inputs(): ReturnType<typeof mockFn<[T], any>>['inputs']
    lastInput: ReturnType<typeof mockFn<[T], any>>['lastInput']
  }
}

const callSafelySilent = (fn: (...args: any[]) => any, ...a: any[]) => {
  try {
    return fn(...a)
  } catch {}
}

export const createTestCtx = (options?: CtxOptions): TestCtx => {
  const ctx = createCtx({
    callLateEffect: callSafelySilent,
    callNearEffect: callSafelySilent,
    ...options,
  })
  const { get } = ctx
  const mocks = new Map<AtomProto, any>()
  const actionMocks = new Map<AtomProto, (ctx: Ctx, ...rest: any[]) => any>()

  return Object.assign(ctx, {
    get(value: Atom | ((...args: any[]) => any)) {
      if (isAtom(value)) {
        // @ts-expect-error
        return get.call(ctx, value)
      }
      return get.call(ctx, (read, actualize) =>
        value(
          read,
          (ctx: Ctx, proto: AtomProto, mutator: (...args: any[]) => any) => {
            if (mocks.has(proto)) {
              mutator = (patchCtx: Ctx, patch: AtomCache) => {
                const state = mocks.get(proto)
                patch.state = proto.isAction ? state.slice() : state
              }
            }
            if (!actionMocks.has(proto)) return actualize!(ctx, proto, mutator)

            // @ts-expect-error
            const fn: (...args: any[]) => any = proto.unstable_fn
            try {
              // @ts-expect-error
              proto.unstable_fn = (...a: any[]) => actionMocks.get(proto)!(...a)
              return actualize!(ctx, proto, mutator)
            } finally {
              // @ts-expect-error
              proto.unstable_fn = fn
            }
          },
        ),
      )
    },
    subscribeTrack(anAtom: Atom, cb: (...args: any[]) => any = () => {}): any {
      const track = Object.assign(mockFn(cb), cb)
      const unsubscribe = ctx.subscribe(anAtom, track)

      return Object.assign(track, { unsubscribe })
    },
    mock<T>(anAtom: Atom<T>, fallback: T) {
      const proto = anAtom.__reatom
      let read: (...args: any[]) => any

      get((_read, actualize) => {
        read = _read
        actualize!(ctx, proto, (patchCtx: Ctx, patch: AtomCache) => {
          patch.state = fallback
          // disable computer
          patch.pubs = [ctx.cause]
        })
        mocks.set(proto, fallback)
      })

      return () => {
        read(proto).pubs = []
        mocks.delete(proto)
      }
    },
    mockAction<I extends any[], O>(
      anAction: Action<I, O>,
      cb: (ctx: Ctx, ...rest: I) => O,
    ) {
      const proto = anAction.__reatom

      throwReatomError(!proto.isAction, 'action expected')

      actionMocks.set(proto, cb as (ctx: Ctx, ...rest: any[]) => any)

      return () => actionMocks.delete(proto)
    },
  })
}

export const createMockStorage = (
  snapshot: Rec<any> = {},
): PersistStorage & { snapshot: Rec<PersistRecord> } => {
  snapshot = Object.entries(snapshot).reduce(
    (acc, [key, data]) => (
      (acc[key] = {
        data,
        fromState: false,
        id: 0,
        timestamp: Date.now(),
        to: 10 ** 10,
        version: 0,
      }),
      acc
    ),
    {} as Rec<PersistRecord>,
  )
  const listeners = new Map<string, Set<Fn<[PersistRecord]>>>()

  return {
    name: 'mock',
    get: (ctx, key) => snapshot[key] ?? null,
    set: (ctx, key, rec) => {
      rec = { ...rec, fromState: false }
      const prev = snapshot[key]
      snapshot[key] = rec
      ctx.schedule(() => (snapshot[key] = prev!), -1)
      ctx.schedule(() => listeners.get(key)?.forEach((cb) => cb(rec)))
    },
    subscribe: (ctx, key, callback) => {
      listeners.set(key, (listeners.get(key) ?? new Set()).add(callback))
      return () => {
        const keyListeners = listeners.get(key)
        if (keyListeners) {
          keyListeners.delete(callback)
          if (keyListeners.size === 0) listeners.delete(key)
        }
      }
    },
    snapshot,
  }
}
