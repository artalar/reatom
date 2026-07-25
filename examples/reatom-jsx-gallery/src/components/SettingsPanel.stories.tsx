import type { Meta, StoryObj } from '@storybook/html'
import { within } from '@testing-library/dom'
import { expect } from 'storybook/test'

import { mockFolderTree } from '../__fixtures__/mockData'
import { StoryWrapper } from '../shared/StoryWrapper'
import {
  createMyself,
  type DefiniteLocator,
  type Locator,
} from '../shared/test'
import { loadGalleryState } from '../shared/testSetup'
import { settingsPanelOpen } from './panelState'
import { SettingsPanel } from './SettingsPanel'

const loc = {
  settingsHeadingAppears: (canvas) =>
    canvas.findByRole('heading', { name: 'Settings' }),
  noGridGapRadioAppears: async (canvas) => {
    const group = await canvas.findByRole('radiogroup', { name: 'Grid gap' })
    return await within(group).findByRole('radio', { name: 'none' })
  },
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeSettingsPanelOpen: async () => {
    await I.see(loc.settingsHeadingAppears)
  },
  selectNoGridGap: async () => {
    await I.click(loc.noGridGapRadioAppears as DefiniteLocator)
    const radio = await I.resolveLocator(
      loc.noGridGapRadioAppears as DefiniteLocator,
    )
    await expect(radio).toHaveAttribute('aria-checked', 'true')
  },
}))

const meta: Meta = {
  title: 'Components/SettingsPanel',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const OpenWithDefaults: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    settingsPanelOpen.show()
    return (
      <StoryWrapper>
        <SettingsPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeSettingsPanelOpen()
    await I.selectNoGridGap()
  },
}
