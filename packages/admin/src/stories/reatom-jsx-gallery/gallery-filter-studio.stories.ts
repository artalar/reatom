import type { Meta, StoryObj } from '@storybook/html'
import { expect, userEvent, waitFor } from 'storybook/test'

import { button, role, text } from '../../../.storybook/helpers'
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
  addAdminTagToDraftExpression,
  clickAdminButton,
  clickGalleryControl,
  createAdminPredicateTag,
  fillAdminPredicateTagDraft,
  getAdminButton,
  getAdminFilterBarText,
  getAdminSavedRuleCards,
  getAdminText,
  getVisibleLogs,
  pauseAdminCapture,
  saveAdminDraftAsShowOnly,
  searchAdminLogs,
  startFreshAdminSession,
} from './testing'

const meta = {
  ...galleryMeta,
  title: 'Integration/Reatom JSX Gallery/Filter Studio',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const FilterStudioCurationJourney: Story = {
  name: 'Filter studio curation across app noise',
  tags: ['@smoke'],
  play: async () => {
    await waitForGalleryLoaded()
    await startFreshAdminSession()

    await I.click(button('list view'))
    await I.click(button('table view'))
    await I.click(button('grid view'))
    await expectVisibleLogCount('setViewMode', 3)

    await searchAdminLogs('')
    await I.click(role('checkbox', 'Select photo1.jpg'))
    await I.click(role('checkbox', 'Select photo2.png'))
    await expectVisibleLogCount('selectImage', 2)

    await searchAdminLogs('')
    await I.click(button('Open photo1.jpg'))
    await I.see(text(/\d+ \/ \d+/).wait())
    document.body.focus()
    await userEvent.keyboard('{ArrowRight}')
    await clickGalleryControl('Close preview')
    await expectVisibleLogNamed('openLightbox')
    await expectVisibleLogNamed('navigateLightbox')
    await expectVisibleLogNamed('closeLightbox')

    await searchAdminLogs('')
    await I.click(button(/Switch to (light|dark) theme/))
    await expectVisibleLogNamed('themeMode.toggleResolved')

    await searchAdminLogs('')
    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(5)
    })

    await clickAdminButton(/^Actions$/)
    await waitFor(() => {
      const visible = getVisibleLogs()
      expect(visible.length).toBeGreaterThan(0)
      expect(visible.every((log) => log.badges.includes('action'))).toBe(true)
      expect(getAdminFilterBarText()).toMatch(/1 active rule/)
    })

    await clickAdminButton(/^Reset$/)
    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(0)
      expect(getAdminFilterBarText()).toMatch(/0 active rule/)
    })

    await navigateAdminRoute('Filters')
    await waitFor(() => {
      expect(getAdminText()).toContain('Filter studio')
      expect(getAdminText()).toContain('Tag studio')
    })

    await fillAdminPredicateTagDraft({
      name: 'Lightbox traffic',
      value: 'lightbox',
    })
    await createAdminPredicateTag()
    await waitFor(() => {
      expect(getAdminText()).toContain('Lightbox traffic')
    })

    await addAdminTagToDraftExpression('Lightbox traffic')
    await saveAdminDraftAsShowOnly()
    await waitFor(() => {
      const cards = getAdminSavedRuleCards()
      expect(cards.length).toBeGreaterThan(0)
      expect(
        cards.some((card) =>
          (card.textContent ?? '').includes('Show only rule'),
        ),
      ).toBe(true)
    })

    await navigateAdminRoute('Activity')
    await waitFor(() => {
      const visible = getVisibleLogs()
      expect(visible.length).toBeGreaterThan(0)
      expect(
        visible.every((log) => /lightbox/i.test(`${log.name} ${log.content}`)),
      ).toBe(true)
      expect(getAdminFilterBarText()).toMatch(/[1-9]\d* active rule/)
    })

    await navigateAdminRoute('Filters')
    await waitFor(() => {
      expect(getAdminSavedRuleCards().length).toBeGreaterThan(0)
    })

    await clickAdminButton(/^Disable$/)
    await waitFor(() => {
      expect(getAdminText()).toContain('Paused')
      expect(getAdminText()).toContain('Enable')
    })

    await navigateAdminRoute('Activity')
    await waitFor(() => {
      const visible = getVisibleLogs()
      expect(visible.length).toBeGreaterThan(0)
      expect(
        visible.some((log) => log.name === 'setViewMode') ||
          visible.some((log) => log.name === 'selectImage') ||
          visible.some((log) => log.name === 'viewMode') ||
          visible.some((log) => /lightbox/i.test(log.name)),
      ).toBe(true)
    })

    await navigateAdminRoute('Filters')
    await clickAdminButton(/^Clear saved rules$/)
    await waitFor(() => {
      expect(getAdminButton(/^Confirm clear$/)).not.toBeNull()
    })

    await clickAdminButton(/^Confirm clear$/)
    await waitFor(() => {
      expect(getAdminText()).toContain('No saved rules yet')
      expect(getAdminSavedRuleCards()).toHaveLength(0)
    })

    await navigateAdminRoute('Activity')
    await pauseAdminCapture()
    await settleGalleryHarness()
  },
}
