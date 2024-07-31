import {
  Action,
  Atom,
  Ctx,
  Fn,
  Unsubscribe,
  __count,
  action,
  atom,
} from '@reatom/core'
import { onCtxAbort, take } from '@reatom/effects'
import { onConnect, onDisconnect } from '@reatom/hooks'
import { noop, toAbortError } from '@reatom/utils'

export type CurrentTarget<T, Target extends EventTarget> = T extends Event
  ? T & { currentTarget: Target }
  : T

export type EventOfTarget<
  Target extends EventTarget,
  Type extends string,
> = Target extends Record<`on${Type}`, infer Cb>
  ? // @ts-expect-error `Cb extends Fn` broke the inference for some reason
    CurrentTarget<Parameters<Cb>[0], Target> // correct type
  : Target extends Record<'onEvent', (type: Type, cb: infer Cb) => any>
  ? // @ts-expect-error `Cb extends Fn` broke the inference for some reason
    CurrentTarget<Parameters<Cb>[0], Target> // general type
  : never

// @ts-ignore
export const onEvent: {
  <
    Target extends EventTarget,
    Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
  >(
    ctx: Ctx,
    target: Target,
    type: Type,
  ): Promise<EventOfTarget<Target, Type>>
  <Event>(ctx: Ctx, target: EventTarget, type: string): Promise<Event>
  <
    Target extends EventTarget,
    Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
  >(
    ctx: Ctx,
    target: Target,
    type: Type,
    cb: (value: EventOfTarget<Target, Type>) => any,
  ): Unsubscribe
  <Event>(
    ctx: Ctx,
    target: EventTarget,
    type: string,
    cb: (value: Event) => any,
  ): Unsubscribe
} = (ctx: Ctx, target: EventTarget, type: string, listener: Fn) => {
  let un
  if (!listener) {
    return new Promise((r) => (un = onEvent(ctx, target, type, r))).finally(un)
  }
  target.addEventListener(type, listener)
  un = () => target.removeEventListener(type, listener)
  onCtxAbort(ctx, un)
  return un
}

// export const withEvent: {
//   <
//     A extends AtomMut,
//     Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
//     Target extends EventTarget,
//   >(
//     type: Type,
//     target: Target,
//     map: (
//       ctx: Ctx,
//       event: EventOfTarget<Target, Type>,
//       state: AtomState<A>,
//     ) => AtomState<A>,
//   ): (anAtom: A) => A
// } = (type, target, map) => (anAtom) => {
//   onConnect(anAtom, (ctx) =>
//     onEvent(ctx, target, type, (event) => {
//       // @ts-expect-error
//       anAtom(ctx, (state) => map(ctx, event, state))
//     }),
//   )
//   return anAtom
// }

export interface EventAction<Event = any> extends Action<[Event], Event> {
  // promiseAtom: Atom<Promise<Event>>
}

export const reatomEvent = <
  Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
  Target extends EventTarget = Window,
>(
  target: Target,
  type: Type,
): EventAction<EventOfTarget<Target, Type>> => {
  const event = action<EventOfTarget<Target, Type>>(__count(`event.${type}`))
  const promiseAtom = atom((ctx) => {
    const [call] = ctx.spy(event)

    const controller = new AbortController()
    onCtxAbort(ctx, (error) => controller.abort(error))
    Object.assign(ctx.cause, { controller })
    onDisconnect(event, () => controller.abort(toAbortError))
    const promise = call ? Promise.resolve(call.payload) : take(ctx, event)

    promise.catch(noop)

    return promise
  })
  onConnect(event, (ctx) => {
    onEvent(ctx, target, type, (e) => {
      event(ctx, e as EventOfTarget<Target, Type>)
    })
    onCtxAbort(ctx, (error) => controller.abort(error))
  })
  return Object.assign(event, { promiseAtom })
}
