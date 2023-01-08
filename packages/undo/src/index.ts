import {
  action,
  Action,
  atom,
  Atom,
  AtomMut,
  AtomState,
  Fn,
  isAction,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { onUpdate, withInit } from '@reatom/hooks'

// TODO
// https://github.com/omnidan/redux-undo

export interface WithUndo<T> {
  historyAtom: Atom<Array<T>>
  isUndoAtom: Atom<boolean>
  isRedoAtom: Atom<boolean>
  undo: Action<[], T>
  redo: Action<[], T>
}

export const withUndo =
  <T extends AtomMut & Partial<WithUndo<T>>>({
    length = 30,
  }: { length?: number } = {}): Fn<[T], T & WithUndo<T>> =>
  (anAtom) => {
    throwReatomError(
      isAction(anAtom) || !isAtom(anAtom) || typeof anAtom !== 'function',
      'withHistory accepts only mutable atom',
    )
    if (!anAtom.historyAtom) {
      const name = `${anAtom.__reatom.name}.historyAtom`
      const historyAtom = (anAtom.historyAtom = atom<Array<AtomState<T>>>(
        [],
        name,
      ).pipe(withInit((ctx) => [ctx.get(anAtom)])))
      const positionAtom = atom(0, `${name}.position`)
      anAtom.isUndoAtom = atom(
        (ctx) => ctx.spy(positionAtom) > 0,
        `${name}.isUndoAtom`,
      )
      anAtom.isRedoAtom = atom(
        (ctx) => ctx.spy(positionAtom) < ctx.spy(historyAtom).length - 1,
        `${name}.isRedoAtom`,
      )

      anAtom.undo = action(
        (ctx) =>
          anAtom(
            ctx,
            ctx.get(historyAtom)[positionAtom(ctx, (s) => Math.max(0, s - 1))],
          ),
        `${name}.undo`,
      )
      anAtom.redo = action((ctx) => {
        const history = ctx.get(historyAtom)
        return anAtom(
          ctx,
          history[
            positionAtom(ctx, (s) => Math.min(history.length - 1, s + 1))
          ],
        )
      }, `${name}.redo`)

      const actionsProto = [anAtom.undo.__reatom, anAtom.redo.__reatom]

      onUpdate(anAtom, (ctx, state, patch) => {
        {
          if (actionsProto.includes(patch.cause?.proto as any)) return

          historyAtom!(ctx, (history) => {
            if (history[history.length - 1] !== state) {
              history = history.slice(-length + 1)
              if (history.length !== ctx.get(positionAtom) - 1) {
                history.length = ctx.get(positionAtom) + 1
              }
              history.push(state)
            }
            positionAtom(ctx, history.length - 1)
            return history
          })
        }
      })
    }

    return anAtom as any
  }
