import { Action, Fn } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { onEvent, type EventOfTarget } from './onEvent'

export { onEvent }

export const reatomEvent: {
  <
    Type extends Target extends Record<`on${infer Type}`, Fn> ? Type : string,
    Target extends EventTarget = Window,
  >(
    type: Type,
    target?: Target,
    filter?: (event: EventOfTarget<Target, Type>) => boolean,
  ): Action<[EventOfTarget<Target, Type>], EventOfTarget<Target, Type>>
} = (type, target, filter = () => true) => {
  const event = reatomEvent(type)
  onConnect(event, (ctx) =>
    onEvent(ctx, target ?? window, type, (e) => {
      if (filter(e)) event(ctx, e)
    }),
  )
  return event
}
