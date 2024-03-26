import {
  Atom,
  AtomCache,
  AtomProto,
  CtxSpy,
  atom,
  throwReatomError,
} from '@reatom/core'

const causeMapAtom = atom(null as any as WeakMap<AtomProto, Atom>)
causeMapAtom.__reatom.initState = () => new WeakMap()

const touched = new WeakSet<AtomCache>()

export const select = <T>(
  ctx: CtxSpy,
  cb: (ctx: CtxSpy) => T,
  equal: (oldState: T, newState: T) => boolean = () => false,
): T => {
  const { cause } = ctx
  const causeMap = ctx.get(causeMapAtom)
  let selectAtom = causeMap.get(cause.proto)
  let isInit = !selectAtom
  if (isInit) {
    causeMap.set(
      cause.proto,
      (selectAtom = atom((ctx, prevState?: any) => {
        const newState = cb(ctx)
        return isInit || !equal(prevState, newState) ? newState : prevState
      }, `${cause.proto.name}.select`)),
    )
  }

  throwReatomError(touched.has(cause), 'multiple select is not allowed')
  touched.add(cause)

  return ctx.spy(selectAtom!)
}
