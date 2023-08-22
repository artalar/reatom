import { Ctx, Fn, Unsubscribe } from '@reatom/core'
import { onCtxAbort } from '@reatom/effects'

export type EventOfTarget<
  Target extends EventTarget,
  Type extends string,
> = Target extends Record<`on${Type}`, infer Cb>
  ? // @ts-expect-error `Cb extends Fn` broke the inference for some reason
    Parameters<Cb>[0] // correct type
  : Target extends Record<'onEvent', (type: Type, cb: infer Cb) => any>
  ? // @ts-expect-error `Cb extends Fn` broke the inference for some reason
    Parameters<Cb>[0] // general type
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
  if (!listener) {
    return new Promise((r) => onEvent(ctx, target, type, r))
  }
  target.addEventListener(type, listener)
  const un = () => target.removeEventListener(type, listener)
  onCtxAbort(ctx, un)
  return un
}
