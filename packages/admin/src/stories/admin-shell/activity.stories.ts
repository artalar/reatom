import type { Meta, StoryObj } from '@storybook/html'
import { expect, waitFor } from 'storybook/test'

import { button, createActor, heading, text } from '../../../.storybook/helpers'
import { renderAdminHarness } from './boot'
import { mountCounterApplication } from './counter-ui'
import {
  getAdminText,
  getVisibleLogs,
  matchAdminScreenshot,
  searchAdminLogs,
  startFreshAdminSession,
} from './testing'

const I = createActor()

const meta = {
  title: 'Integration/Admin Shell/Counter Activity',
  tags: ['integration', '@smoke'],
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

export const Default: Story = {
  name: 'Counter activity smoke',
  play: async () => {
    await I.see(heading('Counter demo').wait())
    await waitFor(() => {
      expect(getAdminText()).toContain('Reatom Admin')
    })

    await startFreshAdminSession()

    await I.click(button('Increment'))
    await I.click(button('Increment'))
    await I.click(button('Increment'))

    await waitFor(() => {
      const visibleLogs = getVisibleLogs()
      expect(visibleLogs.some((logItem) => logItem.name === 'increment')).toBe(
        true,
      )
      expect(visibleLogs.some((logItem) => logItem.name === 'count')).toBe(true)
    })

    await I.see(text('Count: 3'))

    await searchAdminLogs('count')

    await waitFor(() => {
      const filteredLogs = getVisibleLogs()
      expect(filteredLogs.length).toBeGreaterThan(0)
      expect(filteredLogs.every((logItem) => logItem.name === 'count')).toBe(
        true,
      )
    })
  },
}

export const ActivityVisualReference: Story = {
  name: 'Counter activity visual reference',
  tags: ['@visual'],
  play: async () => {
    await I.see(heading('Counter demo').wait())
    await startFreshAdminSession()

    await I.click(button('Increment'))
    await I.click(button('Increment'))

    await waitFor(() => {
      expect(getVisibleLogs().some((logItem) => logItem.name === 'count')).toBe(
        true,
      )
    })

    await matchAdminScreenshot('counter-activity-reference')
  },
}
