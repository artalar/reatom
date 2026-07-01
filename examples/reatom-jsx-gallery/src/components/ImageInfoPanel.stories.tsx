import type { Meta, StoryObj } from '@storybook/html'

import { mockFolderTree } from '../__fixtures__/mockData'
import { currentImages, lightboxImage, lightboxOpen } from '../model'
import { StoryWrapper } from '../shared/StoryWrapper'
import {
  type Canvas,
  createMyself,
  type DefiniteLocator,
  type Locator,
} from '../shared/test'
import {
  loadEmptyState,
  loadGalleryState,
  loadGalleryStateWithImageModels,
} from '../shared/testSetup'
import { ImageInfoPanel } from './ImageInfoPanel'
import { imageInfoPanelOpen } from './panelState'

const loc = {
  panelAppears: (canvas: Canvas) =>
    canvas.findByRole('dialog', { name: 'Image details' }),
  panelDoesNotAppear: (canvas: Canvas) =>
    canvas.queryByRole('dialog', { name: 'Image details' }),
  imageNameAppears:
    (name: string): Locator =>
    async (canvas) => {
      const matches = await canvas.findAllByText(name)
      return matches[0] ?? null
    },
} satisfies Record<string, Locator | ((name: string) => Locator)>

const I = createMyself((I) => ({
  seeImageName: async (name: string) => {
    await I.see(loc.panelAppears as DefiniteLocator)
    await I.see(loc.imageNameAppears(name))
  },
  dontSeePanel: async () => {
    await I.dontSee(loc.panelDoesNotAppear)
  },
}))

const meta: Meta = {
  title: 'Components/ImageInfoPanel',
  loaders: [(ctx) => void I.init(ctx)],
}

export default meta

type Story = StoryObj

export const WithSelectedImage: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return (
      <StoryWrapper>
        <ImageInfoPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.dontSeePanel()
  },
}

export const NoImageSelected: Story = {
  render: () => {
    loadGalleryState({ tree: mockFolderTree })
    return (
      <StoryWrapper>
        <ImageInfoPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.dontSeePanel()
  },
}

export const WithLightboxImage: Story = {
  render: () => {
    loadGalleryStateWithImageModels({ tree: mockFolderTree })
    const model = currentImages().find((node) => node.source.name === 'photo1.jpg')
    if (model) {
      lightboxImage.set(() => model)
      lightboxOpen.setTrue()
      imageInfoPanelOpen.setTrue()
    }
    return (
      <StoryWrapper>
        <ImageInfoPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.seeImageName('photo1.jpg')
  },
}

export const EmptyGallery: Story = {
  render: () => {
    loadEmptyState()
    return (
      <StoryWrapper>
        <ImageInfoPanel />
      </StoryWrapper>
    )
  },
  play: async () => {
    await I.dontSeePanel()
  },
}
