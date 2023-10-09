import { Ctx, action, atom } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { match } from '@reatom/lens'
import styled from 'stylerun'
import * as model from './rld-model'
import { RldInspect } from './rld-inspect'
import { RldFilterMenu } from './rld-filter'
import { t } from './t'

type Tab = (typeof Tabs)[number]
const Tabs = ['inspect', 'filters'] as const

export function Rld({ app }: { app: Ctx }) {
  const opened = atom(true, 'opened')
  const currentTab = atom<Tab>('inspect', 'currentTab')

  const jsx = atom((ctx) =>
    t.div({
      ...devtoolsStyles({}),
      children: [
        match(
          opened,
          t.div({
            ...devtoolsContentStyles({}),
            children: [
              t.div({
                ...tabsStyles({}),
                children: Tabs.map((tab) =>
                  t.button({
                    ...tabStyles(
                      {},
                      {},
                      tab === ctx.spy(currentTab) ? 'active' : '',
                    ),
                    children: [tab],
                    onclick: action((ctx) => currentTab(ctx, tab)),
                  }),
                ),
              }),
              atom(
                (ctx) =>
                  ({
                    inspect: RldInspect(),
                    filters: RldFilterMenu(),
                  })[ctx.spy(currentTab)],
              ),
              t.button({
                ...buttonStyles({}),
                children: ['Close Devtools'],
                onclick: action((ctx) => opened(ctx, false)),
              }),
            ],
          }),
          t.button({
            ...buttonStyles({}),
            children: ['Reatom Devtools'],
            onclick: action((ctx) => opened(ctx, true)),
          }),
        ),
      ],
    }),
  )

  onConnect(jsx, (ctx) => {
    const unsub = app.subscribe((logs) =>
      // execute in the microtask to prevent 'cause collision' error
      queueMicrotask(() => model.cachesAdd(ctx, logs)),
    )
    return unsub
  })

  return jsx
}

const devtoolsStyles = styled('')`
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  background: #171721;
  color: #fff;
  border-radius: 0.25rem;
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
`

const devtoolsContentStyles = styled('')`
  padding: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

export const buttonStyles = styled('')`
  border: none;
  font: inherit;
  font-weight: bolder;
  background: #24243a;
  color: white;
  border-radius: 0.25rem;
  border: 1px solid #c5c6de88;
  padding: 0.25rem;
  width: 100%;
`.styled(':hover')`
  background-color: #3B3B4E;
`

const tabsStyles = styled('')`
  margin: -0.25rem;
  width: calc(100% + 0.5rem);
  display: flex;
`

const tabStyles = styled('')`
  border: none;
  font: inherit;
  font-weight: bolder;
  background: #24243a;
  color: white;
  padding: 0.25rem;
  flex-grow: 1;
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
