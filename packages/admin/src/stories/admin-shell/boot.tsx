import { urlAtom } from '@reatom/core'
import { mount } from '@reatom/jsx'

import { ADMIN_FRAME } from '../../root'
import {
  clearAdminStorage,
  clearCurrentDevtools,
  registerStoryCleanup,
  setCurrentDevtools,
} from '../../testing/storybook-runtime'
import { createAdminDevtools } from '../../view'

type PersistentDevtools = ReturnType<typeof createAdminDevtools>

export interface AdminHarnessOptions {
  applicationRootId?: string
  devtoolsWidth?: string
  devtoolsHeight?: string
}

let persistentDevtools: PersistentDevtools | null = null

function getPersistentDevtools(
  options: AdminHarnessOptions,
): PersistentDevtools {
  if (persistentDevtools) return persistentDevtools

  persistentDevtools = createAdminDevtools({
    initialWidth: options.devtoolsWidth ?? '560px',
    initialHeight: options.devtoolsHeight ?? '760px',
  })

  return persistentDevtools
}

function resetPersistentAdminState(devtools: PersistentDevtools): void {
  clearAdminStorage()
  devtools.show()

  ADMIN_FRAME.run(() => {
    urlAtom.go('/')
    devtools.admin.reporter.paused.setFalse()
    devtools.admin.reporter.clear()
    devtools.admin.store.clear()
    devtools.admin.session.start()
    devtools.admin.filters.search.searchQuery.set('')
    devtools.admin.filters.search.searchTarget.set('all')
    devtools.admin.filters.engine.clearConfigs()
    devtools.admin.filters.expression.setExpression({
      operator: 'AND',
      children: [],
    })
  })
}

export function renderAdminHarness(
  renderApplication: (target: HTMLElement) => Promise<() => void> | (() => void),
  options: AdminHarnessOptions = {},
): HTMLDivElement {
  const applicationRootId = options.applicationRootId ?? 'admin-shell-app'
  const storyRoot = document.createElement('div')
  storyRoot.dataset.testid = 'admin-shell-story-root'
  storyRoot.style.width = '100%'
  storyRoot.style.minHeight = '100vh'

  const applicationRoot = document.createElement('div')
  applicationRoot.id = applicationRootId
  storyRoot.append(applicationRoot)

  void (async () => {
    const devtools = getPersistentDevtools(options)
    resetPersistentAdminState(devtools)
    setCurrentDevtools(devtools)

    let unmountApplication: (() => void) | null = null

    registerStoryCleanup(() => {
      try {
        unmountApplication?.()
      } catch {
        return
      } finally {
        devtools.hide()
        clearCurrentDevtools()
        applicationRoot.replaceChildren()
      }
    })

    const unmountResult = await renderApplication(applicationRoot)
    unmountApplication =
      typeof unmountResult === 'function' ? unmountResult : null
  })()

  return storyRoot
}
