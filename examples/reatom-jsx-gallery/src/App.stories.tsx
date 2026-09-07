import type { Meta, StoryObj } from '@storybook/html'

import { fixtureFolderTree, mockFolderTree } from './__fixtures__/mockData'
import { App } from './App'
import { createMyself, type Locator } from './shared/test'
import { loadEmptyState, loadGalleryState } from './shared/testSetup'

const waitForUpdate = () => new Promise<void>((r) => setTimeout(r, 50))

const loc = {
  galleryHeadingAppears: (canvas) =>
    canvas.findByRole('heading', { name: 'Your images, polished fast' }),
  openFolderButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: /Open Folder/i }),
  imageCountAppears: (canvas) => canvas.findByText(/\d+ images/),
  scanningTextAppears: (canvas) => canvas.findByText('Scanning folder...'),
  cancelButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: 'Cancel' }),
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
  maybeLightboxCounter: (canvas) => canvas.queryByText(/\d+ \/ \d+/),
  firstImageButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: 'Open photo1.jpg' }),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeEmptyState: async () => {
    await I.see(loc.galleryHeadingAppears)
    await I.see(loc.openFolderButtonAppears)
  },
  seeGalleryLoaded: async () => {
    await I.see(loc.imageCountAppears)
  },
  seeParsingProgress: async () => {
    await I.see(loc.scanningTextAppears)
    await I.see(loc.cancelButtonAppears)
  },
  openLightboxByClickingFirstImage: async () => {
    const firstImage = await I.see(loc.firstImageButtonAppears)
    firstImage.click()
    await waitForUpdate()
    await I.see(loc.lightboxCounterAppears)
  },
  openLightboxFromFirstImageWithKeyboard: async () => {
    const firstImage = await I.see(loc.firstImageButtonAppears)
    firstImage.focus()
    firstImage.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    await waitForUpdate()
    await I.see(loc.lightboxCounterAppears)
  },
}))

const meta: Meta = {
  title: 'Integration/Gallery',
  parameters: { layout: 'fullscreen' },
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const EmptyState: Story = {
  render: () => {
    loadEmptyState()
    return <App />
  },
  play: async () => {
    await I.seeEmptyState()
  },
}

export const GalleryLoaded: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return <App />
  },
  play: async () => {
    await I.seeGalleryLoaded()
  },
}

export const GalleryWithFixtures: Story = {
  render: () => {
    loadGalleryState({ tree: fixtureFolderTree })
    return <App />
  },
  play: async () => {
    await I.seeGalleryLoaded()
  },
}

export const LightboxFlow: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return <App />
  },
  play: async () => {
    await I.openLightboxByClickingFirstImage()
  },
}

export const LightboxKeyboardFlow: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return <App />
  },
  play: async () => {
    await I.openLightboxFromFirstImageWithKeyboard()
  },
}
