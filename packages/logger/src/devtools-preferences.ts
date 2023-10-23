import { t } from './t'
import * as model from './devtools-model'
import styled from 'stylerun'
import { action } from '@reatom/core'

export const DevtoolsPreferences = () => {
  return t.div({
    ...preferencesStyles({}),
    children: [
      Preference({
        name: 'logs history size',
        input: t.input({
          type: 'number',
          value: model.logsHistorySize,
          oninput: action((ctx, event: any) =>
            model.logsHistorySize(ctx, event.target.value),
          ),
        }),
      }),
    ],
  })
}

const Preference = ({ name, input }: { name: string; input: Element }) => {
  return t.div({
    ...preferenceStyles({}),
    children: [t.div([name]), input],
  })
}

const preferencesStyles = styled('')`
  display: flex;
  flex-flow: column;
`

const preferenceStyles = styled('')`
  display: flex;
  gap: 8px;
`
