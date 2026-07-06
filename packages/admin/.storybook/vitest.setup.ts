import { setProjectAnnotations } from '@storybook/html-vite'
import { afterEach } from 'vitest'
import { page } from 'vitest/browser'

import preview from './preview'

setProjectAnnotations([preview])

afterEach(async (context) => {
  if (context.task.result?.state !== 'fail') return

  const screenshotPath = context.task.meta?.['screenshotPath']
  if (typeof screenshotPath === 'string') {
    await page.screenshot({ path: screenshotPath })
    return
  }

  await page.screenshot()
})
