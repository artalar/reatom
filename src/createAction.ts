import { ActionCreator, Action, Ctx, ID, DEPS, DEPTH, HANDLER } from './model'
import { createId } from './shared';

export function createAction<T>(
  name: string = 'actionCreator',
  mapper: (a?: any) => T = _ => _,
): ActionCreator<T> {
  const id = createId(name, 'action')
  const depth = 0
  const deps = { [id]: { [depth]: new Set([handler]) } }
  function handler(ctx: Ctx) {
    ctx.flatNew[id] = ctx.payload
  }

  function actionCreator(payload?: T): Action<T, typeof name> {
    return {
      type: id,
      payload: mapper(payload),
    }
  }

  actionCreator[ID] = id
  actionCreator[DEPS] = deps
  actionCreator[DEPTH] = depth
  actionCreator[HANDLER] = handler

  return actionCreator
}
