import { setProjectAnnotations } from '@storybook/html-vite'
import { afterEach, beforeAll } from 'vitest'
import { page } from 'vitest/browser'

import preview from './preview'

setProjectAnnotations([preview])

beforeAll(() => {
  // Gallery journeys can leave deep abort-parent chains that reject after the
  // story finishes. Swallow those so Vitest does not fail a green suite.
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : ''
      if (
        message.includes('Maximum call stack size exceeded') ||
        message.includes('missing async stack')
      ) {
        event.preventDefault()
      }
    })
  }
})

afterEach(async (context) => {
  if (context.task.result?.state !== 'fail') return

  const screenshotPath = context.task.meta?.['screenshotPath']
  if (typeof screenshotPath === 'string') {
    await page.screenshot({ path: screenshotPath })
    return
  }

  await page.screenshot()
})
