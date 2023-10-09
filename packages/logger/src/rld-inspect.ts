import { match } from '@reatom/lens'
import * as model from './rld-inspect-model'
import { JSXElement } from '@reatom/jsx'
import { Atom, AtomCache, AtomMut, Ctx, action, atom } from '@reatom/core'
import styled from 'stylerun'
// @ts-expect-error
import { Inspector } from '@observablehq/inspector'
import { t } from './t'

export function RldInspect() {
  const height = atom(400, 'height')
  const graphWidth = atom(300, 'graphWidth')
  const stateWidth = atom(300, 'stateWidth')

  return t.div({
    ...inspectStyles({}),
    children: [
      InspectView({
        height,
        width: graphWidth,
        children: [InspectGraph()],
      }),
      match(
        model.logSelected,
        InspectView({
          height,
          width: stateWidth,
          children: [InspectState()],
        }),
        t.div([]),
      ),
    ],
  })
}

function InspectView({
  height,
  width,
  children,
}: {
  height: AtomMut<number>
  width: Atom<number>
  resizeLeft?: (ctx: Ctx, to: number) => void
  resizeRight?: (ctx: Ctx, to: number) => void
  children: JSXElement[]
}) {
  return atom((ctx) =>
    t.div({
      ...viewStyles({}),
      children: [
        t.div({
          ...viewHandleTopStyles({}),
          children: [
            t.div({
              ...viewHorStyles({}),
              children: [
                t.div({
                  ...viewContentStyles({}),
                  style: `width: ${ctx.spy(width)}px; height: ${ctx.spy(
                    height,
                  )}px;`,
                  children,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  )
}

function InspectGraph() {
  return atom((ctx) =>
    t.div({
      ...graphNodesStyles({}),
      children: ctx
        .spy(model.logGroups)
        .map((group) =>
          'hide' in group
            ? InspectGraphHidden({ hide: group.hide })
            : InspectGraphLog({ log: group }),
        ),
    }),
  )
}

function InspectGraphLog({ log }: { log: model.Log }) {
  return t.div({
    ...graphLogStyles({}),
    role: 'button',
    onclick: action((ctx) => model.logSelect(ctx, log)),
    children: [
      t.span({
        ...graphLogMarkerStyles({} /* { color: log.color! } */),
        style: `background-color: ${log.color!}`,
      }),
      t.span([log.cache.proto.name]),
    ],
  })
}

function InspectGraphHidden({ hide }: { hide: model.Log[] }) {
  const opened = atom(false, 'opened')
  return t.div({
    ...graphHiddenStyles({}),
    children: [
      t.div({
        ...graphHiddenLabelStyles({}),
        role: 'button',
        onclick: action((ctx) => opened(ctx, (prev) => !prev)),
        children: [`${hide.length} log${hide.length != 1 ? 's' : ''} hidden`],
      }),
      match(
        opened,
        atom((ctx) =>
          t.div({
            ...graphHiddenListStyles({}),
            children: hide.map((log) => InspectGraphLog({ log })),
          }),
        ),
      ),
    ],
  })
}

function InspectState() {
  const target = t.div()
  const inspector = new Inspector(target)
  inspector.pending()
  model.logSelected.onChange((ctx, log) => {
    if (!log) return
    return inspector.fulfilled(log.cache.state)
  })
  return t.div([target])
}

const inspectStyles = styled('')`
  display: flex;
  gap: 0.25rem;
`

const viewStyles = styled('')`
  background: #fefefe;
  font: var(--mono_fonts);
  color: #111;
  padding: 0.25rem;
  border-radius: 0.25rem;
  flex-grow: 1;
`

const viewHorStyles = styled('')`
  /*  */
`

const viewHandleTopStyles = styled('')``

const viewHandleSideStyles = styled('')``

const viewContentStyles = styled('')`
  overflow-y: scroll;
`

const graphNodesStyles = styled('')`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const graphLogStyles = styled('')`
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.3rem;
`

const graphLogMarkerStyles = styled('')`
  border: 1px solid black;
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
`

const graphHiddenStyles = styled('')`
  display: flex;
  flex-direction: column;
  margin: 0.1rem 0;
`

const graphHiddenLabelStyles = styled('')`
  cursor: pointer;
  user-select: none;
  opacity: 0.6;
  font-size: smaller;
`
const graphHiddenListStyles = styled('')`
  padding: 0.1rem 1rem;
  gap: 0.25rem;
  display: flex;
  flex-direction: column;
`
