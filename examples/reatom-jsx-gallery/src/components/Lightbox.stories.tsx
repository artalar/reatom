import type { Meta, StoryObj } from '@storybook/html'
import { waitFor } from '@testing-library/dom'
import { expect } from 'storybook/test'

import {
  buildPersonalFixtureFolderTree,
  personalFixtureEntries,
  type PersonalFixtureEntry,
} from '../__fixtures__/fixtureLoader'
import { mockFolderTree } from '../__fixtures__/mockData'
import { currentImages, openLightbox } from '../model'
import { StoryWrapper } from '../shared/StoryWrapper'
import { createMyself, type Locator } from '../shared/test'
import { loadGalleryStateWithImageModels } from '../shared/testSetup'
import type { FolderNode } from '../types'
import { Lightbox } from './Lightbox'

const personalFixtureByName = new Map<string, PersonalFixtureEntry>(
  personalFixtureEntries.map((entry) => [entry.name, entry]),
)

const loc = {
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
  closeButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: 'Close preview' }),
  scrubberAppears: (canvas) =>
    canvas.findByRole('slider', { name: 'Folder position' }),
  nextButton: (canvas) =>
    canvas.findByRole('button', { name: 'Next image' }),
} satisfies Record<string, Locator>

const largePhotoDecodeTimeoutMs = 60_000

const I = createMyself((I) => ({
  seeLightboxOpen: async () => {
    await I.see(loc.lightboxCounterAppears)
    await I.see(loc.closeButtonAppears)
    await I.see(loc.scrubberAppears)
  },
  seeFullResolutionImage: async (name: string) => {
    const fixture = personalFixtureByName.get(name)
    if (!fixture) throw new Error(`Unknown personal fixture: ${name}`)

    await waitFor(
      async () => {
        const image = await I.resolveLocator((canvas) =>
          canvas.findByAltText(name),
        )
        await expect(image).toBeInstanceOf(HTMLImageElement)
        const { naturalWidth } = image as HTMLImageElement
        await expect(naturalWidth).toBe(fixture.width)
      },
      { timeout: largePhotoDecodeTimeoutMs },
    )
  },
  goToNextImage: async () => {
    await I.click(loc.nextButton)
  },
}))

let personalTree: FolderNode | null = null
let restoreNativeImage: (() => void) | null = null

const loadPersonalTree = () => {
  personalTree = buildPersonalFixtureFolderTree()
}

const renderLightboxAtIndex = (index: number) => {
  if (!personalTree) throw new Error('Personal fixture tree is not loaded')
  loadGalleryStateWithImageModels({ tree: personalTree })
  const target = currentImages()[index]
  if (target) openLightbox(target)
  return (
    <StoryWrapper>
      <Lightbox />
    </StoryWrapper>
  )
}

const largePhotoStoryParameters = {
  vitest: { testTimeout: largePhotoDecodeTimeoutMs },
}

const meta: Meta = {
  title: 'Components/Lightbox',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const OpenWithImages: Story = {
  render: () => {
    loadGalleryStateWithImageModels({ tree: mockFolderTree })
    const first = currentImages()[0]
    if (first) openLightbox(first)
    return (
      <StoryWrapper>
        <Lightbox />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeLightboxOpen()
  },
}

/**
 * Regression on real ~54 MP camera JPEGs from `__fixtures__/personal/`.
 * Navigating to the preloaded neighbor used to get stuck on preview quality
 * because concurrent full-size decodes rejected with EncodingError.
 */
export const FullResolutionAcrossNavigation: Story = {
  parameters: largePhotoStoryParameters,
  loaders: [loadPersonalTree],
  render: () => renderLightboxAtIndex(0),
  play: async () => {
    await I.seeLightboxOpen()
    await I.seeFullResolutionImage('DSC08224.jpg')

    await I.goToNextImage()
    await I.seeFullResolutionImage('DSC08225.jpg')

    await I.goToNextImage()
    await I.seeFullResolutionImage('DSC08226.jpg')

    await I.goToNextImage()
    await I.seeFullResolutionImage('DSC08249.jpg')
  },
}

/**
 * Same regression from the "open the second image first" angle.
 */
export const FullResolutionFromMiddleImage: Story = {
  parameters: largePhotoStoryParameters,
  loaders: [loadPersonalTree],
  render: () => renderLightboxAtIndex(1),
  play: async () => {
    await I.seeLightboxOpen()
    await I.seeFullResolutionImage('DSC08225.jpg')

    await I.goToNextImage()
    await I.seeFullResolutionImage('DSC08226.jpg')

    await I.goToNextImage()
    await I.seeFullResolutionImage('DSC08249.jpg')
  },
}

/**
 * Overlapping `img.decode()` on large photos rejects with EncodingError when
 * decoded frames exceed Chrome's working-set budget. Serialization plus the
 * loaded-bytes fallback must still reach full resolution on real fixtures.
 */
export const FullResolutionUnderDecodePressure: Story = {
  parameters: largePhotoStoryParameters,
  loaders: [loadPersonalTree],
  render: () => {
    const NativeImage = window.Image
    let inFlightDecodes = 0

    class DecodePressureImage extends NativeImage {
      override decode(): Promise<void> {
        inFlightDecodes += 1
        const overloaded = inFlightDecodes > 1
        return super
          .decode()
          .finally(() => {
            inFlightDecodes -= 1
          })
          .then(() => {
            if (overloaded) {
              throw new DOMException(
                'The source image cannot be decoded.',
                'EncodingError',
              )
            }
          })
      }
    }

    window.Image = DecodePressureImage
    restoreNativeImage = () => {
      window.Image = NativeImage
      restoreNativeImage = null
    }

    return renderLightboxAtIndex(0)
  },
  play: async () => {
    try {
      await I.seeLightboxOpen()
      await I.seeFullResolutionImage('DSC08224.jpg')

      await I.goToNextImage()
      await I.seeFullResolutionImage('DSC08225.jpg')
    } finally {
      restoreNativeImage?.()
    }
  },
}
