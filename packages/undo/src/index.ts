import {
  Action,
  action,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  AtomProto,
  AtomState,
  Ctx,
  isAction,
  isAtom,
  Rec,
  throwReatomError,
  __count,
} from '@reatom/core'
import { onUpdate, withInit } from '@reatom/hooks'
import { isShallowEqual, Plain } from '@reatom/utils'

// TODO
// https://github.com/omnidan/redux-undo

export interface WithUndo<T = any> {
  clearHistory: Action<[], void>
  historyAtom: Atom<Array<T>>
  positionAtom: Atom<number>
  isRedoAtom: Atom<boolean>
  isUndoAtom: Atom<boolean>
  jump: Action<[by: number], T>
  redo: Action<[], T>
  undo: Action<[], T>
}

const isJump = (patch: AtomCache, jumpProto: AtomProto): boolean =>
  patch.cause
    ? patch.cause.proto === jumpProto || isJump(patch.cause, jumpProto)
    : false

export const withUndo =
  <T extends AtomMut & Partial<WithUndo<AtomState<T>>>>({
    length = 30,
    shouldUpdate = () => true,
  }: {
    length?: number
    shouldUpdate?: (ctx: Ctx, state: AtomState<T>) => boolean
  } = {}): (atom: T) =>( T & WithUndo<AtomState<T>>) =>
  (anAtom) => {
    throwReatomError(
      isAction(anAtom) || !isAtom(anAtom) || typeof anAtom !== 'function',
      'withHistory accepts only mutable atom',
    )
    if (!anAtom.undo) {
      const { name } = anAtom.__reatom

      const historyAtom = (anAtom.historyAtom = atom<Array<AtomState<T>>>(
        [],
        `${name}.historyAtom`,
      ).pipe(withInit((ctx) => [ctx.get(anAtom)])))

      const positionAtom = (anAtom.positionAtom = atom(0, `${name}.position`))

      anAtom.isUndoAtom = atom(
        (ctx) => ctx.spy(positionAtom) > 0,
        `${name}.isUndoAtom`,
      )

      anAtom.isRedoAtom = atom(
        (ctx) => ctx.spy(positionAtom) < ctx.spy(historyAtom).length - 1,
        `${name}.isRedoAtom`,
      )

      const jump = (anAtom.jump = action((ctx, by: number) => {
        const history = ctx.get(historyAtom)
        const position = ctx.get(positionAtom)
        const to = Math.max(0, Math.min(history.length - 1, position + by))

        return anAtom(ctx, history[positionAtom(ctx, to)])
      }, `${name}.jump`))

      anAtom.undo = action((ctx) => jump(ctx, -1), `${name}.undo`)

      anAtom.redo = action((ctx) => jump(ctx, 1), `${name}.redo`)

      anAtom.clearHistory = action((ctx) => {
        historyAtom(ctx, () => [ctx.get(anAtom)])
        positionAtom(ctx, 0)
      }, `${name}.clearHistory`)

      onUpdate(anAtom, (ctx, state, patch) => {
        {
          if (isJump(patch, jump.__reatom)) return

          historyAtom(ctx, (history) => {
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

type AtomsStates<T> = Plain<{
  [K in keyof T]: AtomState<T[K]>
}>

interface UndoAtom<T> extends Atom<T>, WithUndo<T> {}

export const reatomUndo = <T extends Array<AtomMut> | Rec<AtomMut>>(
  shape: T,
  name = __count('undoAtom'),
): UndoAtom<AtomsStates<T>> =>
  Object.assign(
    (ctx: Ctx, newShape: AtomsStates<T>) => {
      for (const [key, anAtom] of Object.entries(shape)) {
        if (!Object.is(ctx.get(anAtom), newShape[key as keyof T])) {
          anAtom(ctx, newShape[key as keyof T])
        }
      }
      return newShape
    },
    atom((ctx, state = (Array.isArray(shape) ? [] : {}) as AtomsStates<T>) => {
      const newState = Object.entries(shape).reduce(
        (acc, [key, anAtom]) => ((acc[key as keyof T] = ctx.spy(anAtom)), acc),
        (Array.isArray(shape) ? [] : {}) as AtomsStates<T>,
      )
      return isShallowEqual(state, newState) ? state : newState
    }, name),
  ).pipe(withUndo())
