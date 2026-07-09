import type { Meta, StoryObj } from '@storybook/html'
import { expect, waitFor } from 'storybook/test'

import { createActor, text } from '../../../.storybook/helpers'
import {
  renderGalleryHarness,
  waitForGalleryHarnessReady,
} from './boot'
import { getAdminText, searchAdminLogs, getVisibleLogs } from './testing'

export const I = createActor()

export const galleryMeta = {
  title: 'Integration/Reatom JSX Gallery',
  tags: ['integration'],
  render: () => renderGalleryHarness(),
  parameters: {
    layout: 'fullscreen',
    vitest: { testTimeout: 180_000 },
  },
  beforeEach: (ctx) => void I.init(ctx),
} satisfies Meta

export type GalleryStory = StoryObj<typeof galleryMeta>

export async function waitForGalleryLoaded(): Promise<void> {
  await waitForGalleryHarnessReady()
  await I.see(text(/\d+ images/).wait())
  await waitFor(() => {
    expect(getAdminText()).toContain('Reatom Admin')
    expect(getAdminText()).toContain('Fresh')
  })
}

export async function expectVisibleLogNamed(
  name: string | RegExp,
): Promise<void> {
  const query =
    typeof name === 'string'
      ? name
      : name.source.replace(/[\\^$*+?.()|[\]{}]/g, '')
  await searchAdminLogs(query)
  await waitFor(
    () => {
      const logs = getVisibleLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(
        logs.some((log) =>
          typeof name === 'string' ? log.name === name : name.test(log.name),
        ),
      ).toBe(true)
    },
    { timeout: 10_000 },
  )
}

export async function expectVisibleLogCount(
  name: string,
  minimum: number,
): Promise<void> {
  await searchAdminLogs(name)
  await waitFor(
    () => {
      expect(
        getVisibleLogs().filter((log) => log.name === name).length,
      ).toBeGreaterThanOrEqual(minimum)
    },
    { timeout: 10_000 },
  )
}

/**
 * Soft-cut abort-parent chains left by gallery decode/lightbox traffic so
 * Vitest does not treat post-story unhandled rejections as suite failures.
 */
export async function settleGalleryHarness(): Promise<void> {
  const { clearStack, context } = await import('@reatom/core')
  try {
    clearStack()
    context.start()
  } catch {
    // ignore
  }
  await new Promise((resolve) => setTimeout(resolve, 0))
}
