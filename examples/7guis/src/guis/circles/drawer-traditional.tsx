import { reatomComponent } from '@reatom/npm-react'
import { CircleDrawerPure } from './frame'
import {
  addCircleAction,
  mouseLeaveAction,
  mouseMoveAction,
  contextMenuAction,
  changeDiameterAction,
  stopChangeDiameterAction,
  adjustAction,
  getClosestAction,
  undoAtom,
} from './model'

export const CircleDrawerTraditional = reatomComponent(({ ctx }) => {
  return (
    <CircleDrawerPure
      onMouseMove={ctx.bind(mouseMoveAction)}
      onMouseLeave={ctx.bind(mouseLeaveAction)}
      onCanvasClick={ctx.bind(addCircleAction)}
      onCircleClick={ctx.bind(contextMenuAction)}
      onAdjustClick={ctx.bind(adjustAction)}
      getClosest={ctx.bind(getClosestAction)}
      onDiameterChange={ctx.bind(changeDiameterAction)}
      onDiameterRelease={ctx.bind(stopChangeDiameterAction)}
      onUndo={ctx.bind(undoAtom.undo)}
      onRedo={ctx.bind(undoAtom.redo)}
      canUndo={ctx.spy(undoAtom.isUndoAtom)}
      canRedo={ctx.spy(undoAtom.isRedoAtom)}
    />
  )
}, 'CircleDrawerTraditional')
