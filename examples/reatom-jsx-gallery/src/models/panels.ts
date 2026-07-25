import { reatomDialog, reatomDisclosure, withDialogDom } from '@reatom/ux'

export { activeFilterCount } from './filters'

export const filterPanelOpen = reatomDialog({
  hidden: false,
  name: 'filterPanel',
}).extend(withDialogDom())

export const settingsPanelOpen = reatomDialog({
  hidden: false,
  name: 'settingsPanel',
}).extend(withDialogDom())

export const imageInfoPanelOpen = reatomDisclosure({
  hidden: false,
  name: 'imageInfoPanel.open',
})
