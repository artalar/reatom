import { Ctx, action, atom } from '@reatom/core'
import { noop } from '@reatom/utils'
import { ctx, h, hf, mount } from '@reatom/jsx'
import * as model from './devtools-model'
import { onConnect } from '@reatom/hooks'
import { match } from '@reatom/lens'
import { DevtoolsFilters } from './devtools-filters'
import { DevtoolsInspect } from './devtools-inspect'
import { t } from './t'
import styled from 'stylerun'
import { buttonStyles } from './devtools-button'
import { DevtoolsPreferences } from './devtools-preferences'

export function devtoolsCreate(app: Ctx) {
  if (typeof window === 'undefined') {
    return noop
  }

  const root = document.createElement('div')
  root.id = 'reatom-logger-devtools'
  document.body.appendChild(root)

  mount(root, h(Devtools, { app }))

  return () => {
    mount(root, h(hf, {}))
    root.remove()
  }
}

type Tab = (typeof Tabs)[number]
const Tabs = ['inspect', 'filters', 'preferences'] as const

const opened = atom(true, 'opened')
const currentTab = atom<Tab>('inspect', 'currentTab')

const widgetWidth = atom(400, 'widgetWidth')
const widgetHeight = atom(600, 'widgetHeight')

export const Devtools = ({ app }: { app: Ctx }) => {
  const jsx = atom((ctx) =>
    t.div({
      $attrs: [
        atom((ctx) =>
          devtoolsStyles({
            width: ctx.spy(widgetWidth) + 'px',
            height: ctx.spy(widgetHeight) + 'px',
          }),
        ),
      ],
      children: [
        match(opened)
          .truthy(
            t.div({
              ...devtoolsContentStyles({}),
              children: [
                DevtoolsTabs(),
                t.div({
                  style: { height: '100%' },
                  children: [
                    match(currentTab)
                      .is('inspect', DevtoolsInspect)
                      .is('filters', DevtoolsFilters)
                      .is('preferences', DevtoolsPreferences)
                      .default('Unknown tab'),
                  ],
                }),
                t.button({
                  ...buttonStyles({}),
                  children: ['Close Devtools'],
                  onclick: action((ctx) => opened(ctx, false)),
                }),
              ],
            }),
          )
          .falsy(
            t.button({
              ...buttonStyles({}),
              children: ['Reatom Devtools'],
              onclick: action((ctx) => opened(ctx, true)),
            }),
          ),
        t.div({
          ...devtoolsResizerStyles({}),
        }),
      ],
    }),
  )

  onConnect(jsx, (ctx) => {
    const unsub = app.subscribe((logs) =>
      // execute in the microtask to prevent 'cause collision' error
      queueMicrotask(() => model.logsAdd(ctx, logs)),
    )
    return unsub
  })

  return jsx
}

const DevtoolsTabs = () => {
  return t.div({
    ...tabsStyles({}),
    children: Tabs.map((tab) =>
      atom((ctx) =>
        t.button({
          ...tabStyles({}, {}, tab === ctx.spy(currentTab) ? 'active' : ''),
          children: [tab],
          onclick: action((ctx) => currentTab(ctx, tab)),
        }),
      ),
    ),
  })
}

const devtoolsResizerStyles = styled('')`
  display: none;
  position: absolute;
  right: -8px;
  top: -8px;

  width: 16px;
  height: 16px;
  background-color: #fff;
  border-radius: 50%;
  border: 1px solid #171721;
  cursor: ne-resize;
`.styled(':hover')`
  background-color: #199dfc;
`

const devtoolsStyles = styled('')`
  --syntax_normal: #1b1e23;
  --syntax_comment: #a9b0bc;
  --syntax_number: #20a5ba;
  --syntax_keyword: #c30771;
  --syntax_atom: #10a778;
  --syntax_string: #008ec4;
  --syntax_error: #ffbedc;
  --syntax_unknown_variable: #838383;
  --syntax_known_variable: #005f87;
  --syntax_matchbracket: #20bbfc;
  --syntax_key: #6636b4;
  --mono_fonts: 82%/1.5 Menlo, Consolas, monospace;

  width: ${({ width }: { width: string; height: string }) => width};
  height: ${({ height }: { width: string; height: string }) => height};

  position: absolute;
  left: 8px;
  bottom: 8px;
  background: #171721;
  color: #fff;
  border-radius: 4px;
`.styled(`:hover .${devtoolsResizerStyles({}).className}`)`
  display: block;
`

const devtoolsContentStyles = styled('')`
  padding: 8px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  box-sizing: border-box;
  height: 100%;
  gap: 8px;
`

const tabsStyles = styled('')`
  margin-top: -8px;
  margin-bottom: 0px;
  margin-left: -8px;
  margin-right: -8px;
  width: calc(100% + 16px);
  display: flex;
`

const tabStyles = styled('')`
  border: none;
  font: inherit;
  font-weight: bolder;
  background: #24243a;
  color: white;
  padding: 4px;
  flex: 1;
  font-size: smaller;
`.styled(':hover')`
  background-color: #3B3B4E;
`.styled(':first-child')`
  border-top-left-radius: 0.25rem;
`.styled(':last-child')`
  border-top-right-radius: 0.25rem;
`.styled('.active')`
  background-color: #f9364d;
`.styled('.active:hover')`
  background-color: #d32e41;
`
