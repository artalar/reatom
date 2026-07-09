import { clearStack, context, urlAtom } from '@reatom/core'
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

export type GalleryHarnessFixture = {
  empty?: boolean
  tree?: unknown
}

const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

type PatchableImage = {
  name: string
  fileInfo?: { name: string; type: string; lastModified: number; size: number }
  fileHandle: { getFile: () => Promise<File> }
}

type PatchableFolder = {
  images: PatchableImage[]
  children: PatchableFolder[]
}

/** Mutate handles so mock images decode as tiny PNGs (fast, no empty-blob storms). */
const patchTreeFiles = <T extends PatchableFolder>(node: T): T => {
  for (const image of node.images) {
    const name = image.name
    const type = image.fileInfo?.type || 'image/png'
    const lastModified = image.fileInfo?.lastModified ?? Date.now()
    image.fileHandle = {
      ...image.fileHandle,
      getFile: async () => {
        const bytes = new Uint8Array(TINY_PNG)
        return new File([bytes], name, { type, lastModified })
      },
    }
    image.fileInfo = {
      name,
      size: TINY_PNG.length,
      type,
      lastModified,
    }
  }
  for (const child of node.children) {
    patchTreeFiles(child)
  }
  return node
}

const clearGalleryPersistence = async () => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('gallery.')) {
      localStorage.removeItem(key)
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('reatom_default')
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error('IDB delete failed'))
      request.onblocked = () => resolve()
    })
  } catch {
    // Best-effort: missing DB is fine for story isolation.
  }
}

let persistentDevtools: PersistentDevtools | null = null
let harnessReady: Promise<void> = Promise.resolve()

export function waitForGalleryHarnessReady(): Promise<void> {
  return harnessReady
}

function getPersistentDevtools(): PersistentDevtools {
  if (persistentDevtools) return persistentDevtools
  // Install the reporter BEFORE any gallery modules load so app atoms
  // pick up EXTENSIONS middleware at creation time.
  persistentDevtools = createAdminDevtools({
    initialWidth: '560px',
    initialHeight: '760px',
    maxFrames: 5000,
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

function applyGalleryFixtureSync(
  loadEmptyState: () => void,
  loadGalleryState: (options: { tree: unknown }) => void,
  mockFolderTree: unknown,
  fixture?: GalleryHarnessFixture,
): void {
  if (fixture?.empty) {
    loadEmptyState()
    return
  }

  const source = (fixture?.tree ?? mockFolderTree) as PatchableFolder
  loadGalleryState({
    tree: patchTreeFiles(source),
  })
}

/**
 * Persistent admin + per-story gallery remount (XO-style).
 * Gallery modules load only after createAdminDevtools so the reporter
 * extension is on EXTENSIONS when app atoms are created.
 *
 * Journeys live in separate story files for browser-process isolation —
 * remounting the gallery after heavy abort traffic in the same document
 * overflows abort-parent chains.
 */
async function bootGalleryApplication(
  target: HTMLElement,
  fixture?: GalleryHarnessFixture,
): Promise<() => void> {
  await import('gallery-app/setup')
  const [{ App }, testSetup, mockData] = await Promise.all([
    import('gallery-app/App'),
    import('gallery-app/shared/testSetup'),
    import('gallery-app/__fixtures__/mockData'),
  ])

  applyGalleryFixtureSync(
    testSetup.loadEmptyState,
    testSetup.loadGalleryState,
    mockData.mockFolderTree,
    fixture,
  )
  const mounted = mount(target, <App />)
  return mounted.unmount
}

/**
 * Persistent admin + per-story gallery remount with clearStack isolation.
 */
export function renderGalleryHarness(
  fixture: GalleryHarnessFixture = {},
): HTMLDivElement {
  const storyRoot = document.createElement('div')
  storyRoot.dataset.testid = 'gallery-story-root'
  storyRoot.style.width = '100%'
  storyRoot.style.minHeight = '100vh'

  const applicationRoot = document.createElement('div')
  applicationRoot.id = 'app'
  storyRoot.append(applicationRoot)

  harnessReady = (async () => {
    await clearGalleryPersistence()

    const devtools = getPersistentDevtools()
    resetPersistentAdminState(devtools)
    setCurrentDevtools(devtools)

    let unmountApplication: (() => void) | null = null

    registerStoryCleanup(() => {
      // Cut abort-parent chains before DOM teardown so async abort walks from
      // lightbox/decode traffic do not overflow after the story finishes.
      try {
        clearStack()
        context.start()
      } catch {
        // ignore
      }
      unmountApplication = null
      applicationRoot.replaceChildren()
      try {
        devtools.hide()
      } catch {
        // already torn down
      }
      // Match XO: clear before preview afterEach so admin is not disposed.
      clearCurrentDevtools()
    })

    unmountApplication = await bootGalleryApplication(
      applicationRoot,
      fixture,
    )
  })()

  return storyRoot
}
