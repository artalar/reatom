import { describe, expect, test } from 'vitest'

import { parseImageMeta } from '../image-engine/header'
import {
  listFixtures,
  readFixtureBlob,
  tierCAvailable,
} from './fixtureLoader.node'

const tierCAvailablePromise = tierCAvailable()

describe('tier-c fixtures', () => {
  test('parseImageMeta succeeds for representative RAW files when LFS objects exist', async (ctx) => {
    if (!(await tierCAvailablePromise)) ctx.skip()

    const sampleDests = ['raw/IMG_3887.CR2', 'dng/574-purple-cast.dng'] as const

    for (const dest of sampleDests) {
      const entry = listFixtures('tier-c').find((item) => item.dest === dest)
      expect(entry, dest).toBeDefined()
      if (!entry) continue

      const blob = await readFixtureBlob(entry.tier, entry.dest)
      const meta = await parseImageMeta(blob, {
        filename: entry.dest.split('/').pop(),
      })

      expect(meta, entry.dest).not.toBeNull()
      expect(meta?.format, entry.dest).not.toBe('unknown')
    }
  })
})
