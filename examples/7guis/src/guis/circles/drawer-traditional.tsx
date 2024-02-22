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
  circlesAtom,
  inContextModeAtom,
} from './model'

export const CircleDrawerTraditional = reatomComponent(({ ctx }) => {
  return (
    <CircleDrawerPure
      inContextMode={inContextModeAtom}
      onMouseMove={ctx.bind(mouseMoveAction)}
      onMouseLeave={ctx.bind(mouseLeaveAction)}
      onCanvasClick={ctx.bind(addCircleAction)}
      onCircleClick={ctx.bind(contextMenuAction)}
      onAdjustClick={ctx.bind(adjustAction)}
      getClosest={ctx.bind(getClosestAction)}
      onDiameterChange={ctx.bind(changeDiameterAction)}
      onDiameterRelease={ctx.bind(stopChangeDiameterAction)}
      onUndo={ctx.bind(circlesAtom.undo)}
      onRedo={ctx.bind(circlesAtom.redo)}
      canUndo={ctx.spy(circlesAtom.isUndoAtom)}
      canRedo={ctx.spy(circlesAtom.isRedoAtom)}
    />
  )
}, 'CircleDrawerTraditional')
