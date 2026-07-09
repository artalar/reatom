import type { Meta, StoryObj } from '@storybook/html'
import { expect, userEvent, waitFor } from 'storybook/test'

import {
  button,
  heading,
  role,
  text,
} from '../../../.storybook/helpers'
import { navigateAdminRoute } from '../../testing/admin-navigation'
import {
  expectVisibleLogCount,
  expectVisibleLogNamed,
  galleryMeta,
  I,
  settleGalleryHarness,
  waitForGalleryLoaded,
} from './journeys-shared'
import {
  fillGalleryFilterSearch,
  getAdminFrameDetail,
  getAdminText,
  getVisibleLogs,
  openLatestAdminLogByName,
  pauseAdminCapture,
  searchAdminLogs,
  startFreshAdminSession,
} from './testing'

const meta = {
  ...galleryMeta,
  title: 'Integration/Reatom JSX Gallery/Curation',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const CurationInvestigationJourney: Story = {
  name: 'Curation investigation',
  tags: ['@smoke'],
  play: async () => {
    await waitForGalleryLoaded()
    await startFreshAdminSession()

    await waitFor(() => {
      expect(getAdminText()).toMatch(/CAPTURED|frames/i)
    })
    await I.see(text(/6 images/))

    await I.click(button('list view'))
    await expectVisibleLogNamed('setViewMode')
    await expectVisibleLogNamed('viewMode')

    await searchAdminLogs('')
    await I.click(button('table view'))
    await expectVisibleLogCount('setViewMode', 2)
    await expectVisibleLogCount('viewMode', 2)

    await searchAdminLogs('')
    await I.click(button('grid view'))
    await expectVisibleLogCount('setViewMode', 3)

    await searchAdminLogs('')
    await I.click(button(/^Filters$/))
    await I.see(heading('Filters').wait())
    await fillGalleryFilterSearch('photo1')
    await expectVisibleLogNamed('searchQuery')
    await waitFor(() => {
      expect(document.body.textContent ?? '').toMatch(/1 images?/)
    })

    await I.click(button(/Clear All Filters/i))
    await waitFor(() => {
      expect(document.body.textContent ?? '').toMatch(/6 images?/)
    })
    await I.click(button('Close filters'))

    await I.click(role('checkbox', 'Select photo1.jpg'))
    await expectVisibleLogNamed('selectImage')
    await waitFor(() => {
      expect(document.body.textContent ?? '').toMatch(/1 selected/)
    })

    await searchAdminLogs('')
    document.body.focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    await expectVisibleLogNamed('selectAllImages')
    await waitFor(() => {
      expect(document.body.textContent ?? '').toMatch(/\d+ selected/)
    })

    await searchAdminLogs('')
    document.body.focus()
    await userEvent.keyboard('f')
    await expectVisibleLogNamed(/favorite/i)

    const favoriteLogName =
      getVisibleLogs().find((log) => log.name.includes('.favorite'))?.name ??
      getVisibleLogs().find((log) =>
        log.name.includes('toggleFavoriteOnSelected'),
      )?.name
    expect(favoriteLogName).toBeTruthy()
    await openLatestAdminLogByName(favoriteLogName!)

    await waitFor(() => {
      const detail = getAdminFrameDetail()
      expect(detail).not.toBeNull()
      expect(detail?.atomName.length).toBeGreaterThan(0)
      expect(detail?.hasError).toBe(false)
      expect(detail?.causeChainNames.length ?? 0).toBeGreaterThan(0)
    })

    await searchAdminLogs('')
    await navigateAdminRoute('Timeline')
    await waitFor(() => {
      const adminText = getAdminText()
      expect(adminText).toContain('Session activity')
      expect(adminText).toContain('Event list')
      expect(adminText).not.toContain('No timeline yet')
    })

    await navigateAdminRoute('Activity')
    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(0)
    })

    await pauseAdminCapture()
    await settleGalleryHarness()
  },
}
