import type { Meta, StoryObj } from '@storybook/html'
import { waitFor } from '@testing-library/dom'
import { expect } from 'storybook/test'

import { buildPersonalFixtureFolderTree } from './__fixtures__/fixtureLoader'
import { App } from './App'
import { currentImages, openLightbox } from './model'
import { createMyself, type Locator } from './shared/test'
import { loadGalleryStateWithImageModels } from './shared/testSetup'
import type { FolderNode } from './types'

const decodeTimeoutMs = 60_000
const waitForTimeoutMs = 30_000

// Headless chromium DPR is 1, grid cells are >= 200 CSS px, so a sharp
// thumbnail must land on at least the 256 bucket. A 192x128 embedded EXIF
// preview sneaking through shows up here as naturalWidth below the floor.
const minSharpThumbnailLongEdge = 256

const loc = {
  imageCountAppears: (canvas) => canvas.findByText(/\d+ images/),
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeGalleryLoaded: async () => {
    await I.see(loc.imageCountAppears)
  },
  seeLightboxOpen: async () => {
    await I.see(loc.lightboxCounterAppears)
  },
  seeSharpGridThumbnails: async (expectedCount: number) => {
    await waitFor(
      () => {
        const root = I._canvasElement
        if (!root) throw new Error('canvas element missing')
        const thumbnails = Array.from(
          root.querySelectorAll<HTMLImageElement>('#gallery-main img'),
        )
        expect(thumbnails.length).toBeGreaterThanOrEqual(expectedCount)
        for (const thumbnail of thumbnails) {
          const intrinsicLongEdge = Math.max(
            thumbnail.naturalWidth,
            thumbnail.naturalHeight,
          )
          expect
            .soft(
              intrinsicLongEdge,
              `thumbnail "${thumbnail.alt}" decoded at ${thumbnail.naturalWidth}x${thumbnail.naturalHeight}`,
            )
            .toBeGreaterThanOrEqual(minSharpThumbnailLongEdge)
        }
      },
      { timeout: waitForTimeoutMs },
    )
  },
  seeFullResolutionLightboxImage: async (name: string, width: number) => {
    await waitFor(
      async () => {
        const image = await I.resolveLocator((canvas) =>
          canvas.findByAltText(name),
        )
        await expect(image).toBeInstanceOf(HTMLImageElement)
        await expect((image as HTMLImageElement).naturalWidth).toBe(width)
      },
      { timeout: waitForTimeoutMs },
    )
  },
  matchScreenshot: async (screenshotName: string) => {
    // vitest and vitest/browser are virtual modules that only exist in
    // browser mode; static imports would crash Storybook dev. The screenshot
    // matcher is registered on vitest's own expect, not storybook's.
    const [{ page }, { expect: vitestExpect }] = await Promise.all([
      import('vitest/browser'),
      import('vitest'),
    ])
    const root = I._canvasElement
    if (!root) throw new Error('canvas element missing')
    await vitestExpect(page.elementLocator(root)).toMatchScreenshot(
      screenshotName,
    )
  },
}))

let personalTree: FolderNode | null = null

const loadPersonalTree = () => {
  personalTree = buildPersonalFixtureFolderTree()
}

const renderGalleryWithPersonalFixtures = () => {
  if (!personalTree) throw new Error('Personal fixture tree is not loaded')
  loadGalleryStateWithImageModels({ tree: personalTree })
  return <App />
}

const meta: Meta = {
  title: 'Regression/VisualReference',
  parameters: {
    layout: 'fullscreen',
    vitest: { testTimeout: decodeTimeoutMs },
  },
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

/**
 * Reference render of the gallery grid on real photos: every thumbnail must
 * decode to at least the smallest sharp bucket, and the composed page must
 * match the committed baseline screenshot.
 */
export const GalleryGridReference: Story = {
  loaders: [loadPersonalTree],
  render: () => renderGalleryWithPersonalFixtures(),
  play: async () => {
    await I.seeGalleryLoaded()
    await I.seeSharpGridThumbnails(4)
    await I.matchScreenshot('gallery-grid-reference')
  },
}

/**
 * Reference render of the lightbox on a real photo at full resolution.
 */
export const LightboxReference: Story = {
  loaders: [loadPersonalTree],
  render: () => {
    const element = renderGalleryWithPersonalFixtures()
    const first = currentImages()[0]
    if (first) openLightbox(first)
    return element
  },
  play: async () => {
    await I.seeLightboxOpen()
    await I.seeFullResolutionLightboxImage('DSC08224.jpg', 9183)
    await I.matchScreenshot('lightbox-reference')
  },
}
