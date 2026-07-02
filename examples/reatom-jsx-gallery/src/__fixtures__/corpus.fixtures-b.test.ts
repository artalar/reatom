import { describe, expect, test } from 'vitest'

import {
  listFixtures,
  readFixtureBlob,
} from '../__fixtures__/fixtureLoader.node'
import { parseImageMeta } from '../image-engine/header'

describe('tier-b fixtures', () => {
  test('parseImageMeta completes for every tier-b file', async () => {
    const entries = listFixtures('tier-b')

    for (const entry of entries) {
      const blob = await readFixtureBlob(entry.tier, entry.dest)
      await expect(
        parseImageMeta(blob, { filename: entry.dest.split('/').pop() }),
      ).resolves.toBeDefined()
    }
  })

  test('corrupt fixtures still return metadata or null without throwing', async () => {
    const corruptEntries = listFixtures('tier-b').filter((entry) =>
      entry.dest.startsWith('corrupt/'),
    )

    for (const entry of corruptEntries) {
      const blob = await readFixtureBlob(entry.tier, entry.dest)
      await expect(
        parseImageMeta(blob, { filename: entry.dest.split('/').pop() }),
      ).resolves.toBeDefined()
    }
  })
})
