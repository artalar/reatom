import { match } from '@reatom/lens'
import * as model from './devtools-inspect-model'
import { action, atom } from '@reatom/core'
import styled from 'stylerun'
// @ts-expect-error
import { Inspector } from '@observablehq/inspector'
import { t } from './t'
import { DevtoolsInspectPane } from './devtools-inspect-pane'

export const DevtoolsInspect = () => {
  return t.div({
    ...inspectStyles({}),
    children: [
      DevtoolsInspectPane({
        resizeRight: () => {},
        children: [InspectGraph()],
      }),
      match(model.logSelected).truthy(() =>
        DevtoolsInspectPane({
          resizeLeft: () => {},
          children: [InspectState()],
        }),
      ),
    ],
  })
}

const InspectGraph = () => {
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

const InspectGraphLog = ({ log }: { log: model.InspectLog }) => {
  return t.div({
    ...graphLogStyles({}),
    role: 'button',
    onclick: action((ctx) => model.logSelect(ctx, log)),
    children: [
      t.span({
        ...graphLogMarkerStyles({ color: log.color! }),
      }),
      t.span([log.cache.proto.name]),
    ],
  })
}

const InspectGraphHidden = ({ hide }: { hide: model.InspectLog[] }) => {
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
      match(opened).truthy(() =>
        t.div({
          ...graphHiddenListStyles({}),
          children: hide.map((log) => InspectGraphLog({ log })),
        }),
      ),
    ],
  })
}

const InspectState = () => {
  return [
    InspectStateStyles(),
    atom((ctx) => {
      const inspectorRoot = t.div({ style: { height: '100%' } })
      const inspector = new Inspector(inspectorRoot)
      inspector.fulfilled(ctx.spy(model.logSelected)?.cache.state)
      return inspectorRoot
    }),
  ]
}

function InspectStateStyles() {
  const selectorBase = `#reatom-logger-devtools .observablehq`
  const styles = `
    ${selectorBase}--expanded,
    ${selectorBase}--collapsed,
    ${selectorBase}--function,
    ${selectorBase}--import,
    ${selectorBase}--string:before,
    ${selectorBase}--string:after,
    ${selectorBase}--gray {
      color: var(--syntax_normal);
    }

    ${selectorBase}--collapsed,
    ${selectorBase}--inspect a {
      cursor: pointer;
    }

    ${selectorBase}--field {
      text-indent: -1em;
      margin-left: 1em;
    }

    ${selectorBase}--empty {
      color: var(--syntax_comment);
    }

    ${selectorBase}--keyword,
    ${selectorBase}--blue {
      color: #3182bd;
    }

    ${selectorBase}--forbidden,
    ${selectorBase}--pink {
      color: #e377c2;
    }

    ${selectorBase}--orange {
      color: #e6550d;
    }

    ${selectorBase}--null,
    ${selectorBase}--undefined,
    ${selectorBase}--boolean {
      color: var(--syntax_atom);
    }

    ${selectorBase}--number,
    ${selectorBase}--bigint,
    ${selectorBase}--date,
    ${selectorBase}--regexp,
    ${selectorBase}--symbol,
    ${selectorBase}--green {
      color: var(--syntax_number);
    }

    ${selectorBase}--index,
    ${selectorBase}--key {
      color: var(--syntax_key);
    }

    ${selectorBase}--prototype-key {
      color: #aaa;
    }

    ${selectorBase}--empty {
      font-style: oblique;
    }

    ${selectorBase}--string,
    ${selectorBase}--purple {
      color: var(--syntax_string);
    }

    ${selectorBase}--error,
    ${selectorBase}--red {
      color: #e7040f;
    }

    ${selectorBase}--inspect {
      font: var(--mono_fonts);
      overflow-x: auto;
      height: 100%;
      display: block;
      white-space: pre;
    }

    ${selectorBase}--error .observablehq--inspect {
      word-break: break-all;
      white-space: pre-wrap;
    }
  `

  return t.style([styles])
}

const inspectStyles = styled('')`
  height: 100%;
  display: flex;
  gap: 0.25rem;
  align-items: stretch;
`

const graphNodesStyles = styled('')`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const graphLogStyles = styled('')`
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  font-size: smaller;
  gap: 0.3rem;
`.styled(':hover')`
  color: #777;
`

const graphLogMarkerStyles = styled('')`
  border: 1px solid black;
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: ${({ color }: { color: string }) => color};
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
