import {
  Atom,
  AtomMut,
  Ctx,
  CtxSpy,
  atom,
  createCtx,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { App, ref, Ref, onScopeDispose, inject } from 'vue'

const ReatomCtxKey = 'ReatomCtxKey'

export const createReatomVue =
  (ctx = createCtx()) =>
  (app: App) => {
    app.provide(ReatomCtxKey, ctx)
  }

export const reatomRef = ((target: any, ctx = inject(ReatomCtxKey)!) => {
  throwReatomError(
    !ctx,
    'ctx is not passed explicitly nor provided with "createReatomVue"',
  )

  if (!isAtom(target) && typeof target === 'function') target = atom(target)

  const vueState = ref()
  const readonly = typeof target !== 'function'

  onScopeDispose(ctx.subscribe(target, (state) => (vueState.value = state)))

  return {
    __v_isRef: true,
    get value() {
      return vueState.value
    },
    set value(next) {
      throwReatomError(readonly, 'Cannot write to a readonly atom')
      ;(target as AtomMut)(ctx, next)
    },
  } as any
}) as {
  <T>(atom: AtomMut<T>, ctx?: Ctx): Ref<T>
  <T>(atom: Atom<T> | ((ctx: CtxSpy) => T), ctx?: Ctx): Readonly<Ref<T>>
}
