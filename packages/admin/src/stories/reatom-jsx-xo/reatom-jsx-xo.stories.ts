import type { Meta, StoryObj } from '@storybook/html'
import { mswLoader } from 'msw-storybook-addon'
import { expect, waitFor } from 'storybook/test'

import { button, createActor, heading, role } from '../../../.storybook/helpers'
import {
  refreshGithubStarsRequest,
  renderXoHarness,
  waitForXoHarnessReady,
} from './boot'
import { githubStars } from './mocks/handlers'
import {
  clickAdminButton,
  getAdminFrameDetail,
  getAdminText,
  getVisibleLogs,
  openLatestAdminLogByName,
  openLatestAdminLogMatching,
  pauseAdminCapture,
  searchAdminLogs,
  showOnlyAdminErrors,
  startFreshAdminSession,
} from './testing'
import { matchAdminScreenshot } from '../../testing/visual'
const I = createActor()

const winningMoveLabels = [
  'Top left cell',
  'Middle left cell',
  'Top center cell',
  'Center cell',
  'Top right cell',
] as const

const expectedWinningMoveParams = ['[0]', '[3]', '[1]', '[4]', '[2]'] as const

function getWinningMoveLogs() {
  return getVisibleLogs().filter((logItem) => logItem.name === 'makeMove')
}

function getFooterRequestLogs() {
  return getVisibleLogs().filter((logItem) =>
    logItem.name.includes('footer.repositoryStarCount'),
  )
}

const meta = {
  title: 'Integration/Reatom JSX XO',
  tags: ['integration'],
  render: () => renderXoHarness(),
  parameters: {
    layout: 'fullscreen',
  },
  loaders: [mswLoader],
  beforeEach: (ctx) => void I.init(ctx),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const WinningDebuggingJourney: Story = {
  name: 'Winning debugging journey',
  tags: ['@smoke', '@visual'],
  play: async () => {
    await waitForXoHarnessReady()
    await I.see(heading(/Tic-Tac-Toe/i).wait())
    await I.see(role('group', 'Tic-tac-toe board'))
    await waitFor(() => {
      expect(getAdminText()).toContain('Reatom Admin')
      expect(getAdminText()).toContain('Start fresh session')
    })

    await startFreshAdminSession()

    for (const cellLabel of winningMoveLabels) {
      await I.click(button(cellLabel))
    }

    await waitFor(() => {
      const winningMoveLogs = getWinningMoveLogs()
      const moveParams = winningMoveLogs.map((logItem) => logItem.content)

      expect(moveParams).toEqual(expectedWinningMoveParams)
      expect(getVisibleLogs().some((logItem) => logItem.name === 'board')).toBe(
        true,
      )
      expect(
        getVisibleLogs().some((logItem) => logItem.name === 'winner'),
      ).toBe(true)
      expect(getVisibleLogs().some((logItem) => logItem.name === 'xWins')).toBe(
        true,
      )
    })

    await I.see(heading(/Player X Wins/i).wait())
    await I.see(button(/Play Again/i))

    const allVisibleLogs = getVisibleLogs()
    expect(getAdminText()).toContain('0 errors')
    expect(
      allVisibleLogs.filter((logItem) => logItem.name === 'makeMove'),
    ).toHaveLength(5)
    expect(
      allVisibleLogs.some(
        (logItem) =>
          logItem.name === 'board' &&
          logItem.content === '["X","X","X","O","O",null,null,null,null]',
      ),
    ).toBe(true)
    expect(
      allVisibleLogs.some(
        (logItem) => logItem.name === 'winner' && logItem.content === 'X',
      ),
    ).toBe(true)
    expect(
      allVisibleLogs.some(
        (logItem) => logItem.name === 'xWins' && logItem.content === '1',
      ),
    ).toBe(true)

    await searchAdminLogs('winner')

    await waitFor(() => {
      const filteredLogNames = getVisibleLogs().map((logItem) => logItem.name)

      expect(filteredLogNames.length).toBeGreaterThan(0)
      expect(filteredLogNames).toContain('winner')
      expect(filteredLogNames).not.toContain('makeMove')
    })

    await openLatestAdminLogByName('winner')

    await waitFor(() => {
      const detail = getAdminFrameDetail()
      expect(detail).not.toBeNull()
      expect(detail?.atomName).toBe('winner')
      expect(detail?.bodyText).toContain('stateX')
      expect(detail?.causeChainNames.length ?? 0).toBeGreaterThan(0)
      expect(detail?.hasError).toBe(false)
    })

    await searchAdminLogs('')

    await waitFor(() => {
      const adminText = getAdminText()
      expect(adminText).toContain('State explorer')
      expect(adminText).toContain('board')
      expect(adminText).toContain('"X", "X", "X", "O", "O"')
      expect(adminText).toContain('winner')
      expect(adminText).toContain('xWins')
    })

    await matchAdminScreenshot('xo-winning-debug-reference')
    await pauseAdminCapture()
  },
}

export const GithubStarsFetchFailure: Story = {
  name: 'GitHub stars fetch failure',
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers: {
        githubStars: githubStars.error,
      },
    },
  },
  play: async () => {
    await waitForXoHarnessReady()
    await I.see(heading(/Tic-Tac-Toe/i).wait())
    await I.see(role('group', 'Tic-tac-toe board'))
    await waitFor(() => {
      expect(getAdminText()).toContain('Reatom Admin')
      expect(getAdminText()).toContain('Start fresh session')
    })

    await refreshGithubStarsRequest().catch(() => undefined)

    await waitFor(
      () => {
        const adminText = getAdminText()
        const footerRequestLogs = getFooterRequestLogs()

        expect(adminText).toContain('1 error')
        expect(footerRequestLogs.length).toBeGreaterThan(0)
      },
      { timeout: 5000 },
    )

    const footerRequestLogs = getFooterRequestLogs()
    expect(getAdminText()).toContain('Errors')
    expect(footerRequestLogs.length).toBeGreaterThan(0)
    expect(
      footerRequestLogs.some((logItem) =>
        logItem.name.includes('footer.repositoryStarCount'),
      ),
    ).toBe(true)

    await searchAdminLogs('footer.repositoryStarCount')

    await waitFor(() => {
      const filteredLogs = getVisibleLogs()

      expect(filteredLogs.length).toBeGreaterThan(0)
      expect(
        filteredLogs.every((logItem) =>
          logItem.name.includes('footer.repositoryStarCount'),
        ),
      ).toBe(true)
    })

    await openLatestAdminLogMatching((logItem) => {
      return logItem.name.includes('footer.repositoryStarCount')
    })

    await waitFor(() => {
      const detail = getAdminFrameDetail()
      expect(detail).not.toBeNull()
      expect(detail?.atomName).toContain('footer.repositoryStarCount')
      expect(detail?.bodyText).toContain('Service Unavailable')
      expect(detail?.hasError).toBe(true)
    })

    await searchAdminLogs('')
    await showOnlyAdminErrors()

    await waitFor(() => {
      const filteredLogs = getVisibleLogs()

      expect(filteredLogs.length).toBeGreaterThan(0)
      expect(
        filteredLogs.some((logItem) =>
          logItem.name.includes('footer.repositoryStarCount'),
        ),
      ).toBe(true)
    })

    await clickAdminButton(/^Reset$/)
    await pauseAdminCapture()
  },
}
