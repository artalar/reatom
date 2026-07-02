import { context, effect } from '@reatom/core'
import type { Meta, StoryObj } from '@storybook/html'
import { expect } from 'storybook/test'

import {
  buildPersonalFixtureFolderTree,
} from '../__fixtures__/fixtureLoader'
import { currentImages, openLightbox } from '../model'
import { viewportSize } from '../models/viewport'
import { StoryWrapper } from '../shared/StoryWrapper'
import { createMyself, type Locator } from '../shared/test'
import { loadGalleryStateWithImageModels } from '../shared/testSetup'
import type { FolderNode } from '../types'
import { Lightbox } from './Lightbox'

const loc = {
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
  zoomInButton: (canvas) => canvas.findByRole('button', { name: 'Zoom in' }),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeLightboxOpen: async () => {
    await I.see(loc.lightboxCounterAppears)
  },
  zoomIn: async () => {
    await I.click(loc.zoomInButton)
  },
  seeMainThreadResponsive: async (label: string) => {
    const start = performance.now()
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    const elapsed = performance.now() - start
    await expect
      .soft(elapsed, `main thread stalled during: ${label}`)
      .toBeLessThan(2_000)
  },
}))

let personalTree: FolderNode | null = null

const loadPersonalTree = () => {
  personalTree = buildPersonalFixtureFolderTree()
}

const meta: Meta = {
  title: 'Regression/LightboxFreeze',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

/**
 * Minimal reproduction of the tab freeze: `viewportSize` returns a fresh
 * object identity from `getState` on every read, so two reactive subscribers
 * invalidate each other forever. The lightbox subscribes it several times
 * (one `displayTargetSize` per windowed image plus the debouncer effect),
 * which is why opening any image froze the tab.
 */
export const ViewportSizeSubscribersSettle: Story = {
  render: () => {
    const container = document.createElement('div')
    container.textContent = 'viewport subscribers probe'
    return container
  },
  play: async () => {
    let runsA = 0
    let runsB = 0
    const frame = context.start()
    const [watcherA, watcherB] = frame.run(() => [
      effect(() => {
        runsA += 1
        viewportSize()
      }, 'freezeRepro.watcherA'),
      effect(() => {
        runsB += 1
        viewportSize()
      }, 'freezeRepro.watcherB'),
    ])

    try {
      await I.seeMainThreadResponsive('two viewportSize subscribers')
      await expect(runsA + runsB).toBeLessThan(10)
    } finally {
      watcherA.unsubscribe()
      watcherB.unsubscribe()
    }
  },
}

/**
 * End-to-end angle: open the lightbox on a real photo and make sure the main
 * thread stays responsive while the sized-image pipeline reacts to the
 * display target. Times out if the reactive loop freezes the tab.
 */
export const OpenImageKeepsMainThreadResponsive: Story = {
  loaders: [loadPersonalTree],
  render: () => {
    if (!personalTree) throw new Error('Personal fixture tree is not loaded')
    loadGalleryStateWithImageModels({ tree: personalTree })
    const target = currentImages()[0]
    if (target) openLightbox(target)
    return (
      <StoryWrapper>
        <Lightbox />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeLightboxOpen()
    await I.seeMainThreadResponsive('lightbox open')

    // Give thumbnailMeta time to resolve: the display-target computeds only
    // start reading `viewportSize` once the image dimensions are known, which
    // is the moment the real app froze.
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000))
    await I.seeMainThreadResponsive('after image meta resolved')

    await I.zoomIn()
    await I.seeMainThreadResponsive('after zoom in')
    await I.zoomIn()
    await I.seeMainThreadResponsive('after second zoom in')
  },
}
