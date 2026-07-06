import type { Meta, StoryObj } from '@storybook/html'
import { expect, waitFor } from 'storybook/test'

import { button, createActor, heading } from '../../../.storybook/helpers'
import { renderAdminHarness } from './boot'
import { mountCounterApplication } from './counter-ui'
import {
  getAdminText,
  getVisibleLogs,
  matchAdminScreenshot,
  navigateAdminRoute,
  startFreshAdminSession,
} from './testing'

const I = createActor()

const meta = {
  title: 'Integration/Admin Shell/Timeline',
  tags: ['integration'],
  parameters: {
    layout: 'fullscreen',
    vitest: { testTimeout: 30_000 },
  },
  render: () =>
    renderAdminHarness((target) => {
      mountCounterApplication(target)
    }),
  beforeEach: (ctx) => void I.init(ctx),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const TimelineJourney: Story = {
  name: 'Counter timeline journey',
  tags: ['@smoke'],
  play: async () => {
    await I.see(heading('Counter demo').wait())
    await startFreshAdminSession()

    for (let step = 0; step < 6; step += 1) {
      await I.click(button('Increment'))
    }

    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(0)
    })

    await navigateAdminRoute('Timeline')

    await waitFor(() => {
      const adminText = getAdminText()
      expect(adminText).toContain('Timeline')
      expect(adminText).toContain('Bucket size')
      expect(adminText).toContain('Zoom')
    })
  },
}

export const TimelineVisualReference: Story = {
  name: 'Timeline visual reference',
  tags: ['@visual'],
  play: async () => {
    await I.see(heading('Counter demo').wait())
    await startFreshAdminSession()

    for (let step = 0; step < 8; step += 1) {
      await I.click(button('Increment'))
    }

    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(0)
    })

    await navigateAdminRoute('Timeline')

    await waitFor(() => {
      expect(getAdminText()).toContain('Bucket size')
    })

    await matchAdminScreenshot('counter-timeline-reference')
  },
}
