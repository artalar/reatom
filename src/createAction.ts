import { VERTEX, createId, ActionCreator, Action, Ctx } from './shared'

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

  function actionCreator(payload?: T): Action<T> {
    return {
      type: id,
      payload: mapper(payload),
    }
  }

  actionCreator[VERTEX] = { id, deps, depth, handler }

  return actionCreator
}
