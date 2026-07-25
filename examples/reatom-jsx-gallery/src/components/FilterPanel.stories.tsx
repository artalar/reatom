import type { Meta, StoryObj } from '@storybook/html'
import { expect } from 'storybook/test'

import { mockFolderTree } from '../__fixtures__/mockData'
import { StoryWrapper } from '../shared/StoryWrapper'
import { createMyself, type Locator } from '../shared/test'
import { loadGalleryState } from '../shared/testSetup'
import { FilterPanel } from './FilterPanel'
import { filterPanelOpen } from './panelState'

const waitForUpdate = () => new Promise<void>((r) => setTimeout(r, 50))

const loc = {
  filterHeadingAppears: (canvas) =>
    canvas.findByRole('heading', { name: 'Filters' }),
  searchInputAppears: (canvas) =>
    canvas.findByPlaceholderText('Search by filename...'),
  jpgCheckboxAppears: (canvas) =>
    canvas.findByRole('checkbox', { name: /JPG/i }),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeFilterPanelOpen: async () => {
    await I.see(loc.filterHeadingAppears)
    await I.see(loc.searchInputAppears)
  },
  toggleJpgFilter: async () => {
    await I.click(loc.jpgCheckboxAppears)
    await waitForUpdate()
    const checkbox = await I.resolveLocator(loc.jpgCheckboxAppears)
    await expect(checkbox).toBeChecked()
  },
}))

const meta: Meta = {
  title: 'Components/FilterPanel',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const OpenNoFilters: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    filterPanelOpen.show()
    return (
      <StoryWrapper>
        <FilterPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeFilterPanelOpen()
  },
}

export const ToggleTypeFilter: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    filterPanelOpen.show()
    return (
      <StoryWrapper>
        <FilterPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.toggleJpgFilter()
  },
}
