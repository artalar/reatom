import { AtomMut, Atom, Ctx, atom, action } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { JSXElement, ctx } from '@reatom/jsx'
import { onEvent } from '@reatom/web'
import { t } from './t'
import styled from 'stylerun'
import { noop } from '@reatom/utils'

export const DevtoolsInspectPane = ({
  resizeLeft,
  resizeRight,
  children,
}: {
  resizeLeft?: (ctx: Ctx, to: number) => void
  resizeRight?: (ctx: Ctx, to: number) => void
  children: JSXElement[]
}) => {
  const pane = t.div({
    ...paneStyles({}),
    children: [
      resizeLeft ? PaneHandle({ resize: resizeLeft }) : [],

      t.div({

        $attrs: [
          atom((ctx) => {
            return paneContentStyles({
              width: '100%',
            })
          }),
        ],
        children,
      }),

      resizeRight ? PaneHandle({ resize: resizeRight }) : [],
    ].flat(),
  })

  return pane
}

const PaneHandle = ({ resize }: { resize: (ctx: Ctx, to: number) => void }) => {
  return t.div({ ...paneHandleStyles({}) })
}

const paneStyles = styled('')`
  position: relative;
  display: flex;
  background: #fefefe;
  font: var(--mono_fonts);
  color: #111;
  padding: 8px;
  border-radius: 4px;
  flex-grow: 1;
  overflow: auto;
  height: 100%;
`

const paneHandleStyles = styled('')`
  width: 8px;
  margin: -8px;
  position: relative;
  height: 100%;
  background-color: #ccc;
`.styled(':hover')`
  z-index: 1;
  background-color: #199dfc;
  cursor: col-resize;
`

const paneContentStyles = styled('')`
  height: 100%;
  position: relative;
  overflow-y: scroll;
  width: ${({ width }: { width: string }) => width};
`
