import { currentDevtools } from './storybook-runtime'

async function stabilizeAdminShell(): Promise<void> {
  const { getAdminText, pauseAdminCapture } =
    await import('../stories/reatom-jsx-xo/testing')

  if (!getAdminText().includes('Recording paused')) {
    await pauseAdminCapture()
  }

  await new Promise((resolve) => setTimeout(resolve, 900))
}

export function getAdminDevtoolsHost(): HTMLElement {
  const containerId = currentDevtools?.containerId
  if (!containerId) {
    throw new Error('Current admin devtools instance is missing')
  }

  const host = document.getElementById(containerId)
  if (!(host instanceof HTMLElement)) {
    throw new Error(`Missing admin devtools host for ${containerId}`)
  }

  return host
}

export function getAdminVisualSnapshotTarget(): HTMLElement {
  const host = getAdminDevtoolsHost()
  const snapshotTarget = host.shadowRoot?.querySelector(
    '[data-testid="admin-visual-snapshot"]',
  )

  if (snapshotTarget instanceof HTMLElement) {
    return snapshotTarget
  }

  return host
}

export async function matchElementScreenshot(
  element: HTMLElement,
  screenshotName: string,
): Promise<void> {
  const [{ page }, { expect: vitestExpect }] = await Promise.all([
    import('vitest/browser'),
    import('vitest'),
  ])

  await vitestExpect(page.elementLocator(element)).toMatchScreenshot(
    screenshotName,
    {
      timeout: 20_000,
      screenshotOptions: {
        animations: 'disabled',
      },
      comparatorOptions: {
        allowedMismatchedPixelRatio: 0.02,
      },
    },
  )
}

export async function matchAdminScreenshot(
  screenshotName: string,
): Promise<void> {
  await stabilizeAdminShell()
  await matchElementScreenshot(getAdminVisualSnapshotTarget(), screenshotName)
}

export async function matchStoryRootScreenshot(
  root: HTMLElement,
  screenshotName: string,
): Promise<void> {
  await matchElementScreenshot(root, screenshotName)
}
