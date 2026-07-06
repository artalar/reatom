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

function installEnvironmentMocks(): () => void {
  const originalVibrateDescriptor = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    'vibrate',
  )

  Object.defineProperty(Navigator.prototype, 'vibrate', {
    value: () => false,
    configurable: true,
    writable: true,
  })

  return () => {
    if (originalVibrateDescriptor) {
      Object.defineProperty(
        Navigator.prototype,
        'vibrate',
        originalVibrateDescriptor,
      )
      return
    }
    Reflect.deleteProperty(Navigator.prototype, 'vibrate')
  }
}

async function bootXoApplication(target: HTMLElement): Promise<() => void> {
  await import('./src/setup')
  const { App } = await import('./src/App')
  const mountedApplication = mount(target, <App />)
  return mountedApplication.unmount
}

let persistentDevtools: PersistentDevtools | null = null
let harnessReady: Promise<void> = Promise.resolve()

export function waitForXoHarnessReady(): Promise<void> {
  return harnessReady
}

function getPersistentDevtools(): PersistentDevtools {
  if (persistentDevtools) return persistentDevtools
  persistentDevtools = createAdminDevtools({
    initialWidth: '560px',
    initialHeight: '760px',
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

async function resetGithubStarsRequest(): Promise<void> {
  const footerModule = await import('./src/components/Footer')
  footerModule.repositoryStarCountResource.reset()
}

export async function refreshGithubStarsRequest(): Promise<void> {
  const footerModule = await import('./src/components/Footer')
  await footerModule.repositoryStarCountResource.retry()
}

export function renderXoHarness(): HTMLDivElement {
  const storyRoot = document.createElement('div')
  storyRoot.dataset.testid = 'xo-story-root'
  storyRoot.style.width = '100%'
  storyRoot.style.minHeight = '100vh'

  const applicationRoot = document.createElement('div')
  applicationRoot.id = 'app'
  storyRoot.append(applicationRoot)

  harnessReady = (async () => {
    const restoreEnvironment = installEnvironmentMocks()
    const devtools = getPersistentDevtools()
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
        restoreEnvironment()
        applicationRoot.replaceChildren()
      }
    })

    await resetGithubStarsRequest()
    unmountApplication = await bootXoApplication(applicationRoot)
  })()

  return storyRoot
}
