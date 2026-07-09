import type { Meta, StoryObj } from '@storybook/html'
import { expect, userEvent, waitFor } from 'storybook/test'

import { button, text } from '../../../.storybook/helpers'
import { navigateAdminRoute } from '../../testing/admin-navigation'
import { matchAdminScreenshot } from '../../testing/visual'
import {
  expectVisibleLogCount,
  expectVisibleLogNamed,
  galleryMeta,
  I,
  settleGalleryHarness,
  waitForGalleryLoaded,
} from './journeys-shared'
import {
  clickAdminButton,
  clickAdminCauseChainEntry,
  clickAdminGraphDirection,
  clickGalleryControl,
  getAdminFrameDetail,
  getAdminGraphNodeNames,
  getAdminText,
  getVisibleLogs,
  openLatestAdminLogByName,
  pauseAdminCapture,
  searchAdminLogs,
  setAdminGraphDepthLimit,
  startFreshAdminSession,
} from './testing'

const meta = {
  ...galleryMeta,
  title: 'Integration/Reatom JSX Gallery/Lightbox',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const LightboxCauseGraphJourney: Story = {
  name: 'Lightbox deep-dive with cause graph',
  tags: ['@smoke', '@visual'],
  play: async () => {
    await waitForGalleryLoaded()
    await startFreshAdminSession()

    await I.click(button('Open photo1.jpg'))
    await I.see(text(/\d+ \/ \d+/).wait())
    await expectVisibleLogNamed('openLightbox')

    await searchAdminLogs('')
    document.body.focus()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{ArrowLeft}')
    await expectVisibleLogCount('navigateLightbox', 4)

    await searchAdminLogs('')
    await clickGalleryControl('Zoom in')
    await clickGalleryControl('Zoom in')
    await clickGalleryControl('Reset zoom')
    await expectVisibleLogNamed('lightbox.zoomIn')
    await expectVisibleLogNamed('lightbox.zoomReset')

    await searchAdminLogs('navigateLightbox')
    await waitFor(() => {
      const filtered = getVisibleLogs()
      expect(filtered.length).toBeGreaterThanOrEqual(4)
      expect(
        filtered.every((log) => log.name.includes('navigateLightbox')),
      ).toBe(true)
    })

    await openLatestAdminLogByName('navigateLightbox')
    await waitFor(() => {
      const detail = getAdminFrameDetail()
      expect(detail).not.toBeNull()
      expect(detail?.atomName).toContain('navigateLightbox')
      expect(detail?.causeChainNames.length ?? 0).toBeGreaterThan(0)
    })

    const detail = getAdminFrameDetail()
    const causeTarget = detail?.causeChainNames[0]
    if (causeTarget) {
      await clickAdminCauseChainEntry(causeTarget)
    } else {
      await clickAdminButton(/Open in cause graph/i)
    }

    await navigateAdminRoute('Graph')
    await waitFor(() => {
      expect(getAdminText()).toContain('Graph nodes')
      const nodeNames = getAdminGraphNodeNames()
      expect(nodeNames.length).toBeGreaterThan(0)
      expect(
        nodeNames.some(
          (name) =>
            /lightbox/i.test(name) ||
            name.includes('navigateLightbox') ||
            name.includes('openLightbox'),
        ),
      ).toBe(true)
    })

    await setAdminGraphDepthLimit(3)
    await clickAdminGraphDirection('ancestors')
    await clickAdminGraphDirection('full')
    await waitFor(() => {
      expect(getAdminGraphNodeNames().length).toBeGreaterThan(0)
    })

    // Search lives on Activity — return there before closing + asserting.
    await navigateAdminRoute('Activity')
    await clickGalleryControl('Close preview')
    await expectVisibleLogNamed('closeLightbox')

    await searchAdminLogs('')
    await navigateAdminRoute('Graph')
    await waitFor(() => {
      expect(getAdminText()).toContain('Graph nodes')
      expect(getAdminGraphNodeNames().length).toBeGreaterThan(0)
    })

    await matchAdminScreenshot('gallery-lightbox-graph-reference')
    await pauseAdminCapture()
    await settleGalleryHarness()
  },
}
