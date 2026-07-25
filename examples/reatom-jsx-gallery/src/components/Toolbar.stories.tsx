import type { Meta, StoryObj } from '@storybook/html'
import { context } from '@reatom/core'
import { expect } from 'storybook/test'

import { mockFolderTree } from '../__fixtures__/mockData'
import { viewMode } from '../model'
import { StoryWrapper } from '../shared/StoryWrapper'
import {
  createMyself,
  type DefiniteLocator,
  type Locator,
} from '../shared/test'
import { loadEmptyState, loadGalleryState } from '../shared/testSetup'
import { Toolbar } from './Toolbar'

const waitForUpdate = () => new Promise<void>((r) => setTimeout(r, 50))

const loc = {
  openButtonAppears: (canvas) => canvas.findByRole('button', { name: /Open/i }),
  searchInputAppears: (canvas) =>
    canvas.findByPlaceholderText('Search images...'),
  listViewButtonAppears: (canvas) =>
    canvas.findByRole('radio', { name: 'list view' }),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeToolbarWithGallery: async () => {
    await I.see(loc.openButtonAppears)
    await I.see(loc.searchInputAppears)
  },
  seeToolbarEmpty: async () => {
    await I.see(loc.openButtonAppears)
  },
  switchToListView: async () => {
    await I.click(loc.listViewButtonAppears as DefiniteLocator)
    await waitForUpdate()
    const listBtn = await I.resolveLocator(
      loc.listViewButtonAppears as DefiniteLocator,
    )
    await expect(context.start(() => viewMode())).toBe('list')
    await expect(listBtn).toHaveAttribute('aria-checked', 'true')
  },
}))

const meta: Meta = {
  title: 'Components/Toolbar',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const WithLoadedGallery: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return (
      <StoryWrapper>
        <Toolbar />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeToolbarWithGallery()
  },
}

export const EmptyState: Story = {
  render: () => {
    loadEmptyState()
    return (
      <StoryWrapper>
        <Toolbar />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeToolbarEmpty()
  },
}

export const ViewModeToggle: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return (
      <StoryWrapper>
        <Toolbar />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.switchToListView()
  },
}
