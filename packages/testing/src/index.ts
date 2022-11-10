import {
  Atom,
  AtomCache,
  AtomProto,
  createCtx,
  Ctx,
  CtxOptions,
  Fn,
  isAtom,
  Unsubscribe,
} from '@reatom/core'

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
  mock<T>(anAtom: Atom<T>, fallback: T): void

  subscribeTrack<T, F extends Fn<[T]>>(
    anAtom: Atom<T>,
    cb?: F,
  ): F & {
    unsubscribe: Unsubscribe
    calls: ReturnType<typeof mockFn<[T], any>>['calls']
    lastInput: ReturnType<typeof mockFn<[T], any>>['lastInput']
  }
}

export const createTestCtx = (options?: CtxOptions): TestCtx => {
  const ctx = createCtx(options)
  const { get } = ctx
  const mocks = new Map<AtomProto, any>()

  return Object.assign(ctx, {
    get(value: Atom | Fn) {
      if (isAtom(value)) {
        // @ts-expect-error
        return get.call(ctx, value)
      }
      return get.call(ctx, (read, actualize) =>
        value(read, (ctx: Ctx, proto: AtomProto, mutator: Fn) =>
          actualize!(
            ctx,
            proto,
            mocks.has(proto)
              ? (patchCtx: Ctx, patch: AtomCache) => {
                  const state = mocks.get(proto)
                  patch.state = proto.isAction ? state.slice() : state
                }
              : mutator,
          ),
        ),
      )
    },
    subscribeTrack(anAtom: Atom, cb: Fn = () => {}): any {
      const track = Object.assign(mockFn(cb), cb)
      const unsubscribe = ctx.subscribe(anAtom, track)

      return Object.assign(track, { unsubscribe })
    },
    mock<T>(anAtom: Atom<T>, fallback: T) {
      get((read, actualize) => {
        actualize!(ctx, anAtom.__reatom, (patchCtx: Ctx, patch: AtomCache) => {
          patch.state = fallback
          // disable computer
          patch.pubs.push(ctx.cause)
        })
        mocks.set(anAtom.__reatom, fallback)
      })
    },
  })
}
