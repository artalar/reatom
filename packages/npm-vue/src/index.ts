import {
  Atom,
  AtomMut,
  Ctx,
  CtxSpy,
  Unsubscribe,
  atom,
  isAtom,
  throwReatomError,
} from '@reatom/core'
// import { parseAtoms, type ParseAtoms } from '@reatom/lens'
// import { ReadonlyDeep } from '@reatom/utils'
import {
  ref,
  Ref,
  onScopeDispose,
  inject,
  InjectionKey,
} from '@vue/composition-api'

export const reatomCtxKey = Symbol('reatomCtxKey') as InjectionKey<Ctx>

export const reatomRef = ((target: any, ctx = inject(reatomCtxKey)!) => {
  throwReatomError(
    !ctx,
    '"ctx" is not passed explicitly nor provided with "vue:provide"',
  )

  if (typeof target === 'function' && !isAtom(target)) target = atom(target)

  const state = ref()
  /**
   * Whether target is a readonly (computed) atom
   */
  const ro = typeof target !== 'function'

  let unsub: Unsubscribe
  onScopeDispose(() => unsub?.())

  return {
    get value() {
      unsub ??= ctx.subscribe(target, (atomState) => (state.value = atomState))
      return state.value
    },
    set value(next) {
      throwReatomError(ro, 'Can not write to a readonly atom')
      ;(target as AtomMut)(ctx, next)
    },
  }
}) as {
  <T>(atom: AtomMut<T>, ctx?: Ctx): Ref<T>
  <T>(atom: Atom<T> | ((ctx: CtxSpy) => T), ctx?: Ctx): Readonly<Ref<T>>
}

// TODO
// export const reatomReactive = ((ctx, target: any) => {
//   if (typeof target === 'function' && !isAtom(target)) target = atom(target)
//   return reatomRef(ctx, (ctx) => parseAtoms(ctx, target))
// }) as {
//   <T>(ctx: Ctx, state: (ctx: CtxSpy) => T): ReadonlyDeep<Ref<ParseAtoms<T>>>
//   <T>(ctx: Ctx, state: T): ReadonlyDeep<Ref<ParseAtoms<T>>>
// }
