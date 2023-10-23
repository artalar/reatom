import { AtomMaybe } from '@reatom/core'
import { t } from './t'

export const DevtoolsIcon = ({ path }: { path: AtomMaybe<string> }) =>
  t.svg({
    children: [
      t.path({
        d: path,
      }),
    ],
  })

export const DevtoolsIconPlus = () =>
  DevtoolsIcon({ path: 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z' })

export const DevtoolsIconDelete = () =>
  DevtoolsIcon({
    path: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19C6,20.1 6.9,21 8,21H16C17.1,21 18,20.1 18,19V7H6V19Z',
  })
