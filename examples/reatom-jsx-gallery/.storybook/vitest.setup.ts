import { setProjectAnnotations } from '@storybook/html-vite'
import { afterEach } from 'vitest'
import { page } from 'vitest/browser'

import * as previewAnnotations from './preview'

setProjectAnnotations([previewAnnotations])

afterEach(async () => {
  await page.screenshot()
})
