/// <reference path="../src/global.d.ts" />
import { urlAtom } from '@reatom/core'
import kahramanPreview, { type KahramanParameters } from 'kahraman/preview'
import { initialize, mswLoader } from 'msw-storybook-addon'

import { reatomJsxXoHandlers } from '../src/stories/reatom-jsx-xo/mocks/handlers'
import {
  clearAdminStorage,
  clearCurrentDevtools,
  currentDevtools,
  runStoryCleanups,
} from '../src/testing/storybook-runtime'
import { FALLBACK_VIEWPORT, getViewportSize } from './viewports'

type ViewportGlobal = { value?: string } | string | undefined
type PreviewGlobals = Record<string, ViewportGlobal>
type PreviewContext = {
  globals: PreviewGlobals
  parameters?: KahramanParameters
}

initialize(
  {
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: {
      url: `${import.meta.env['BASE_URL']}mockServiceWorker.js`,
    },
  },
  [reatomJsxXoHandlers.githubStars],
)

const preview = {
  parameters: {
    a11y: { test: 'off' },
    msw: {
      handlers: reatomJsxXoHandlers,
    },
  },
  loaders: [mswLoader],
  async beforeEach(context: PreviewContext) {
    kahramanPreview.beforeEach(context)
    const { globals } = context

    urlAtom.routes = {}
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState({}, '', '/')
    }
    clearAdminStorage()

    if (import.meta.env['VITEST']) {
      const { page } = await import('vitest/browser')
      const viewportGlobal = globals['viewport']
      const viewportName =
        typeof viewportGlobal === 'string'
          ? viewportGlobal
          : viewportGlobal?.value
      const viewport =
        (viewportName ? getViewportSize(viewportName) : null) ??
        FALLBACK_VIEWPORT
      await page.viewport(viewport.width, viewport.height)
    }

    return () => {
      runStoryCleanups()
      if (currentDevtools) {
        currentDevtools.hide()
        currentDevtools.admin.dispose()
        clearCurrentDevtools()
      }
      clearAdminStorage()
    }
  },
}

export default preview
