import { expect, userEvent, waitFor } from 'storybook/test'

export {
  clickAdminButton,
  confirmAdminDestructiveAction,
  getAdminButton,
  getAdminFrameDetail,
  getAdminShadowRoot,
  getAdminText,
  getVisibleLogs,
  openLatestAdminLogByName,
  openLatestAdminLogMatching,
  pauseAdminCapture,
  resumeAdminCapture,
  searchAdminLogs,
  showOnlyAdminErrors,
  startFreshAdminSession,
} from '../reatom-jsx-xo/testing'

import { ADMIN_FRAME } from '../../root'
import { currentDevtools } from '../../testing/storybook-runtime'
import {
  clickAdminButton,
  getAdminButton,
  getAdminShadowRoot,
  getAdminText,
} from '../reatom-jsx-xo/testing'

export function getAdminStoreFrames() {
  const admin = currentDevtools?.admin
  if (!admin) throw new Error('Current admin devtools instance is missing')
  // Prefer reporter frames — they are the source of truth before store sync.
  return ADMIN_FRAME.run(() => admin.reporter.frames())
}

export function getAdminStoreAtomName(atomId: string): string {
  const admin = currentDevtools?.admin
  if (!admin) throw new Error('Current admin devtools instance is missing')
  return (
    ADMIN_FRAME.run(() => admin.reporter.atoms().get(atomId)?.name) ?? atomId
  )
}

export function getAdminStoreLogsByName(name: string | RegExp) {
  return getAdminStoreFrames()
    .map((frame) => ({
      frame,
      name: getAdminStoreAtomName(frame.atomId),
    }))
    .filter((entry) =>
      typeof name === 'string'
        ? entry.name === name
        : name.test(entry.name),
    )
}

export async function expectAdminStoreLogNamed(
  name: string | RegExp,
): Promise<void> {
  await waitFor(
    () => {
      expect(getAdminStoreLogsByName(name).length).toBeGreaterThan(0)
    },
    { timeout: 10_000 },
  )
}

export async function expectAdminStoreLogCount(
  name: string | RegExp,
  minimum: number,
): Promise<void> {
  await waitFor(
    () => {
      expect(getAdminStoreLogsByName(name).length).toBeGreaterThanOrEqual(
        minimum,
      )
    },
    { timeout: 10_000 },
  )
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function getAdminFilterBarText(): string {
  const filterBar = getAdminShadowRoot().querySelector(
    '[data-reatom-name="FilterBar"]',
  )
  return normalizeText(filterBar?.textContent ?? '')
}

export function getAdminSavedRuleCards(): Array<HTMLElement> {
  const workbench = getAdminShadowRoot().querySelector(
    '[data-reatom-name="FilterWorkbench"]',
  )
  if (!(workbench instanceof HTMLElement)) return []

  return Array.from(workbench.querySelectorAll('article')).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  )
}

export function getAdminGraphNodeNames(): Array<string> {
  const graphNodes = getAdminShadowRoot().querySelector(
    '[data-reatom-name="GraphNodes"]',
  )
  if (!(graphNodes instanceof HTMLElement)) return []

  return Array.from(graphNodes.querySelectorAll('strong, [data-node-name]'))
    .map((element) => normalizeText(element.textContent ?? ''))
    .filter((name) => name.length > 0)
}

export async function clickAdminCauseChainEntry(
  matcher: RegExp | string,
): Promise<void> {
  const detail = getAdminShadowRoot().querySelector(
    '[data-reatom-name="FrameDetail"]',
  )
  if (!(detail instanceof HTMLElement)) {
    throw new Error('Frame detail is missing')
  }

  const causeChainSection = Array.from(detail.querySelectorAll('section')).find(
    (section) => section.textContent?.includes('Cause chain'),
  )
  if (!(causeChainSection instanceof HTMLElement)) {
    throw new Error('Cause chain section is missing')
  }

  await waitFor(() => {
    const button = Array.from(
      causeChainSection.querySelectorAll('button'),
    ).find((candidate) => {
      const label = candidate.textContent ?? ''
      return typeof matcher === 'string'
        ? label.includes(matcher)
        : matcher.test(label)
    })
    expect(button).toBeTruthy()
  })

  const target = Array.from(causeChainSection.querySelectorAll('button')).find(
    (candidate) => {
      const label = candidate.textContent ?? ''
      return typeof matcher === 'string'
        ? label.includes(matcher)
        : matcher.test(label)
    },
  )

  if (!(target instanceof HTMLButtonElement)) {
    throw new Error(`Missing cause-chain button ${String(matcher)}`)
  }

  await userEvent.click(target)
}

export async function setAdminGraphDepthLimit(depth: number): Promise<void> {
  const controls = getAdminShadowRoot().querySelector(
    '[data-reatom-name="CauseGraphControls"]',
  )
  if (!(controls instanceof HTMLElement)) {
    throw new Error('Cause graph controls are missing')
  }

  const depthInput = controls.querySelector('input[type="number"]')
  if (!(depthInput instanceof HTMLInputElement)) {
    throw new Error('Depth limit input is missing')
  }

  depthInput.focus()
  depthInput.value = String(depth)
  depthInput.dispatchEvent(new Event('input', { bubbles: true }))
  depthInput.dispatchEvent(new Event('change', { bubbles: true }))
}

export async function clickAdminGraphDirection(
  direction: 'ancestors' | 'descendants' | 'full',
): Promise<void> {
  await clickAdminButton(new RegExp(`^${direction}$`, 'i'))
  await waitFor(() => {
    expect(getAdminButton(new RegExp(`^${direction}$`, 'i'))).not.toBeNull()
  })
}

export async function fillAdminPredicateTagDraft(options: {
  name: string
  value: string
}): Promise<void> {
  const builder = getAdminShadowRoot().querySelector(
    '[data-reatom-name="PredicateBuilder"]',
  )
  if (!(builder instanceof HTMLElement)) {
    throw new Error('Predicate builder is missing')
  }

  const nameInput = builder.querySelector('input[placeholder]')
  if (!(nameInput instanceof HTMLInputElement)) {
    throw new Error('Tag name input is missing')
  }

  // Shadow-DOM inputs often reject userEvent.clear focus; set values directly.
  nameInput.focus()
  nameInput.value = options.name
  nameInput.dispatchEvent(new Event('input', { bubbles: true }))
  nameInput.dispatchEvent(new Event('change', { bubbles: true }))
  expect(nameInput.value).toBe(options.name)

  const valueInputs = Array.from(builder.querySelectorAll('input[type="text"]'))
  const valueInput = valueInputs.find((input) => input !== nameInput)
  if (!(valueInput instanceof HTMLInputElement)) {
    throw new Error('Predicate value input is missing')
  }

  valueInput.focus()
  valueInput.value = options.value
  valueInput.dispatchEvent(new Event('input', { bubbles: true }))
  valueInput.dispatchEvent(new Event('change', { bubbles: true }))
  expect(valueInput.value).toBe(options.value)
}

export async function createAdminPredicateTag(): Promise<void> {
  await clickAdminButton(/^Create tag$/)
}

export async function addAdminTagToDraftExpression(
  tagName: string,
): Promise<void> {
  const ariaLabel = `Add ${tagName} tag to draft expression`

  await waitFor(() => {
    const button = Array.from(
      getAdminShadowRoot().querySelectorAll('button'),
    ).find(
      (candidate) =>
        candidate instanceof HTMLButtonElement &&
        candidate.getAttribute('aria-label') === ariaLabel,
    )
    expect(button).toBeTruthy()
  })

  const target = Array.from(
    getAdminShadowRoot().querySelectorAll('button'),
  ).find(
    (candidate) =>
      candidate instanceof HTMLButtonElement &&
      candidate.getAttribute('aria-label') === ariaLabel,
  )

  if (!(target instanceof HTMLButtonElement)) {
    throw new Error(`Missing tag button ${ariaLabel}`)
  }

  await userEvent.click(target)
  await waitFor(() => {
    expect(getAdminText()).toMatch(/Draft nodes:\s*[1-9]/)
  })
}

export async function saveAdminDraftAsShowOnly(): Promise<void> {
  await clickAdminButton(/Save as Show only/i)
  await waitFor(() => {
    expect(getAdminSavedRuleCards().length).toBeGreaterThan(0)
  })
}

export async function clickGalleryControl(
  matcher: RegExp | string,
): Promise<void> {
  await waitFor(() => {
    const target = Array.from(document.querySelectorAll('button')).find(
      (candidate) =>
        candidate instanceof HTMLButtonElement &&
        matchesAccessibleName(candidate, matcher),
    )
    expect(target).toBeTruthy()
  })

  const target = Array.from(document.querySelectorAll('button')).find(
    (candidate) =>
      candidate instanceof HTMLButtonElement &&
      matchesAccessibleName(candidate, matcher),
  )

  if (!(target instanceof HTMLButtonElement)) {
    throw new Error(`Missing gallery control ${String(matcher)}`)
  }

  // Lightbox controls use mousedown handlers and may briefly have
  // pointer-events:none while faded; drive them the same way the app does.
  target.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 1 }),
  )
  target.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, button: 0 }),
  )
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
  target.click()
}

function matchesAccessibleName(
  button: HTMLButtonElement,
  matcher: RegExp | string,
): boolean {
  const label =
    button.getAttribute('aria-label') ?? button.textContent ?? button.title
  return typeof matcher === 'string'
    ? label === matcher || (label?.includes(matcher) ?? false)
    : matcher.test(label ?? '')
}

export async function fillGalleryFilterSearch(value: string): Promise<void> {
  await waitFor(() => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-label="Filters"]',
    )
    expect(dialog).toBeTruthy()
    expect(dialog?.hasAttribute('inert')).toBe(false)
  })

  const dialog = document.querySelector(
    '[role="dialog"][aria-label="Filters"]',
  )
  if (!(dialog instanceof HTMLElement)) {
    throw new Error('Gallery filter dialog is missing')
  }

  const input = dialog.querySelector('input[type="search"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Gallery filter search input is missing')
  }

  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))

  await waitFor(() => {
    expect(input.value).toBe(value)
  })
}

export async function fillGalleryToolbarSearch(value: string): Promise<void> {
  const input = document.querySelector('input[aria-label="Search images"]')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Gallery toolbar search input is missing')
  }

  input.focus()
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))

  await waitFor(() => {
    expect(input.value).toBe(value)
  })
}

export function getAdminActiveRuleCountLabel(): string {
  const match = getAdminFilterBarText().match(/(\d+)\s+active rule/)
  return match?.[0] ?? ''
}

