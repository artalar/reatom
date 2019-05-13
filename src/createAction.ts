import {
  ActionCreator,
  Action,
  Dependencies,
  Ctx,
  ID,
  NAME,
  DEPS,
  DEPTH,
  createId,
} from './model'

export function createAction<P>(
  name: string = 'actionCreator',
  mapper?: ((a?: any) => P) | null,
  type: string = createId(name, 'action'),
): ActionCreator<P> {
  const depth = 0
  const deps: Dependencies = {
    [type]: {
      [depth]: {
        [type]: {
          id: type,
          handler,
          sets: 1,
        },
        list: [type],
      },
    },
  }
  mapper = mapper || (_ => _)
  function handler(ctx: Ctx) {
    ctx.flatNew[type] = ctx.payload
  }

  // FIXME: optional argument must return optional payload
  function actionCreator(payload?: P): Action<P, typeof type> {
    return {
      type: type,
      payload: mapper(payload),
    }
  }

  actionCreator[ID] = type
  actionCreator[NAME] = name
  actionCreator[DEPS] = deps
  actionCreator[DEPTH] = depth

  return actionCreator
}

const a = createAction<string>()().payload
