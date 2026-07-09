import { expect, userEvent, waitFor } from 'storybook/test'

import {
  getLastLogItemByName,
  getLastLogItemMatching,
  getLogItems,
  type ParsedFrameDetail,
  type ParsedLogItem,
  parseFrameDetail,
  parseLogItem,
} from '../../testing/admin-log-dom'
import { currentDevtools } from '../../testing/storybook-runtime'

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function getAdminShadowRoot(): ShadowRoot {
  const containerId = currentDevtools?.containerId
  if (!containerId) {
    throw new Error('Current admin devtools instance is missing')
  }

  const host = document.getElementById(containerId)
  if (!(host instanceof HTMLElement) || !host.shadowRoot) {
    throw new Error(`Missing admin shadow root for ${containerId}`)
  }

  return host.shadowRoot
}

function matchesText(value: string, matcher: RegExp | string): boolean {
  return typeof matcher === 'string'
    ? value.includes(matcher)
    : matcher.test(value)
}

export function getAdminButton(
  matcher: RegExp | string,
): HTMLButtonElement | null {
  return (
    Array.from(getAdminShadowRoot().querySelectorAll('button')).find(
      (candidate): candidate is HTMLButtonElement =>
        candidate instanceof HTMLButtonElement &&
        matchesText(candidate.textContent ?? '', matcher),
    ) ?? null
  )
}

function getAdminSearchInput(): HTMLInputElement {
  const input = getAdminShadowRoot().querySelector(
    '[data-testid="filter-search-input"]',
  )
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Admin search input is missing')
  }
  return input
}

export function getAdminText(): string {
  return normalizeText(getAdminShadowRoot().textContent ?? '')
}

export function getVisibleLogs(): Array<ParsedLogItem> {
  return getLogItems(getAdminShadowRoot()).map((item) => parseLogItem(item))
}

export async function clickAdminButton(
  matcher: RegExp | string,
): Promise<void> {
  await waitFor(() => {
    expect(getAdminButton(matcher)).not.toBeNull()
  })

  const targetButton = getAdminButton(matcher)
  if (!targetButton) {
    throw new Error(`Missing admin button ${String(matcher)}`)
  }

  await userEvent.click(targetButton)
}

export async function searchAdminLogs(query: string): Promise<void> {
  const searchInput = getAdminSearchInput()
  searchInput.focus()
  searchInput.value = query
  searchInput.dispatchEvent(new Event('input', { bubbles: true }))
  searchInput.dispatchEvent(new Event('change', { bubbles: true }))
}

export async function openLatestAdminLogByName(name: string): Promise<void> {
  await waitFor(() => {
    expect(getLastLogItemByName(getAdminShadowRoot(), name)).not.toBeNull()
  })

  const logItem = getLastLogItemByName(getAdminShadowRoot(), name)
  if (!logItem) {
    throw new Error(`Missing admin log item ${name}`)
  }

  await userEvent.click(logItem)
}

export async function openLatestAdminLogMatching(
  predicate: (logItem: ParsedLogItem) => boolean,
): Promise<void> {
  await waitFor(() => {
    expect(
      getLastLogItemMatching(getAdminShadowRoot(), predicate),
    ).not.toBeNull()
  })

  const logItem = getLastLogItemMatching(getAdminShadowRoot(), predicate)
  if (!logItem) {
    throw new Error('Missing admin log item for predicate')
  }

  await userEvent.click(logItem)
}

export function getAdminFrameDetail(): ParsedFrameDetail | null {
  return parseFrameDetail(getAdminShadowRoot())
}

export async function resumeAdminCapture(): Promise<void> {
  await clickAdminButton(/Resume capture/i)
  await waitFor(() => {
    expect(getAdminText()).not.toContain('Recording paused')
  })
}

export async function confirmAdminDestructiveAction(
  armMatcher: RegExp | string,
  confirmMatcher: RegExp | string,
): Promise<void> {
  await clickAdminButton(armMatcher)
  await waitFor(() => {
    expect(getAdminButton(confirmMatcher)).not.toBeNull()
  })
  await clickAdminButton(confirmMatcher)
}

export async function startFreshAdminSession(): Promise<void> {
  const capturePaused = getAdminText().includes('Recording paused')

  if (!capturePaused) {
    await pauseAdminCapture()
  }

  await confirmAdminDestructiveAction(/^Fresh$/, /^Confirm fresh$/)

  await waitFor(() => {
    expect(getLogItems(getAdminShadowRoot())).toHaveLength(0)
  })

  await resumeAdminCapture()
}

export async function pauseAdminCapture(): Promise<void> {
  if (getAdminText().includes('Recording paused')) {
    return
  }

  await clickAdminButton(/Pause capture/i)
  await waitFor(() => {
    expect(getAdminText()).toContain('Recording paused')
  })
}

export async function showOnlyAdminErrors(): Promise<void> {
  await clickAdminButton(/^Errors$/)
  await waitFor(() => {
    const visibleLogs = getVisibleLogs()
    expect(visibleLogs.length).toBeGreaterThan(0)
    expect(visibleLogs.every((logItem) => logItem.isError)).toBe(true)
  })
}
