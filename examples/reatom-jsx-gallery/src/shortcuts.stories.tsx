import type { Meta, StoryObj } from '@storybook/html'

import { mockFolderTree } from './__fixtures__/mockData'
import { App } from './App'
import { currentImages, openLightbox } from './model'
import { createMyself, type Locator } from './shared/test'
import {
  loadGalleryState,
  loadGalleryStateWithImageModels,
} from './shared/testSetup'

const waitForUpdate = () => new Promise<void>((r) => setTimeout(r, 50))

const loc = {
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
  maybeLightboxCounter: (canvas) => canvas.queryByText(/\d+ \/ \d+/),
  closeButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: 'Close preview' }),
  imageCountAppears: (canvas) => canvas.findByText(/\d+ images/),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeLightboxOpen: async () => {
    await I.see(loc.lightboxCounterAppears)
  },
  seeLightboxClosed: async () => {
    await I.dontSee(loc.maybeLightboxCounter)
  },
  closeLightbox: async () => {
    await I.click(loc.closeButtonAppears)
    await waitForUpdate()
  },
  seeImageCount: async () => {
    await I.see(loc.imageCountAppears)
  },
}))

const meta: Meta = {
  title: 'Integration/KeyboardShortcuts',
  parameters: { layout: 'fullscreen' },
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const CloseLightbox: Story = {
  render: () => {
    loadGalleryStateWithImageModels({ tree: mockFolderTree })
    const first = currentImages()[0]
    if (first) openLightbox(first)
    return <App />
  },
  play: async () => {
    await I.seeLightboxOpen()
    await I.closeLightbox()
    await I.seeLightboxClosed()
  },
}

export const FullAppWithShortcuts: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return <App />
  },
  play: async () => {
    await I.seeImageCount()
  },
}
