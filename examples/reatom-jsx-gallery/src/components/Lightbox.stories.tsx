import type { Meta, StoryObj } from '@storybook/html'

import { mockFolderTree } from '../__fixtures__/mockData'
import { currentImages, openLightbox } from '../model'
import { StoryWrapper } from '../shared/StoryWrapper'
import { createMyself, type Locator } from '../shared/test'
import { loadGalleryStateWithImageModels } from '../shared/testSetup'
import { Lightbox } from './Lightbox'

const loc = {
  lightboxCounterAppears: (canvas) => canvas.findByText(/\d+ \/ \d+/),
  closeButtonAppears: (canvas) =>
    canvas.findByRole('button', { name: 'Close preview' }),
  scrubberAppears: (canvas) =>
    canvas.findByRole('slider', { name: 'Folder position' }),
} satisfies Record<string, Locator>

const I = createMyself((I) => ({
  seeLightboxOpen: async () => {
    await I.see(loc.lightboxCounterAppears)
    await I.see(loc.closeButtonAppears)
    await I.see(loc.scrubberAppears)
  },
}))

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
