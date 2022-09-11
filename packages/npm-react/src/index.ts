import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  useCallback,
} from 'react'
import {
  Action,
  Atom,
  AtomState,
  Ctx,
  Fn,
  isAtom,
  throwReatomError,
} from '@reatom/core'
let batch = (cb: () => void) => cb()
export const setupBatch = (newBatch: typeof batch) => {
  batch = newBatch
}
export const reatomContext = createContext<null | Ctx>(null)
export const useReatomContext = (): Ctx => {
  const ctx = useContext(reatomContext)
  throwReatomError(
    !ctx,
    'ctx is not set, you probably forgot to specify the ctx provider',
  )
  return ctx!
}
export const useAtom = <T extends Atom>(
  anAtom: T | (() => T),
  deps: Array<any> = [],
): [
  AtomState<T>,
  T extends Fn<[Ctx, ...infer Args], infer Res> ? Fn<Args, Res> : undefined,
] => {
  const theAtom = useMemo(() => (isAtom(anAtom) ? anAtom : anAtom()), deps)
  const ctx = useReatomContext()
  const state = useSyncExternalStore(
    (cb) => ctx.subscribe(theAtom, cb),
    () => ctx.get(theAtom),
  )
  const update: any =
    typeof theAtom === 'function'
      ? // @ts-expect-error
        useCallback((...a) => batch(() => theAtom(ctx, ...a)), [theAtom, ctx])
      : undefined
  return [state, update]
}
export const useAction = <T extends Action>(
  anAction: T | (() => T),
  deps?: Array<any>,
) => useAtom<T>(anAction, deps)[1]
