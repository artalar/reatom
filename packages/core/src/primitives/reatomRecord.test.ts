import { describe, expect, test } from 'test'

import { reatomRecord } from './reatomRecord'

describe('reatomRecord', () => {
  test('should manage record state correctly', () => {
    const person = reatomRecord({
      civis: true,
      paterfamilias: true,
      servus: false,
      vir: true,
      coniugium: false,
      senator: true,
    })

    person.merge({
      civis: false,
      servus: true,
      senator: false,
    })

    expect(person()).toEqual({
      civis: false,
      paterfamilias: true,
      servus: true,
      vir: true,
      coniugium: false,
      senator: false,
    })

    person.reset('civis', 'servus')
    person.omit('coniugium')

    expect(person()).toEqual({
      civis: true,
      paterfamilias: true,
      servus: false,
      vir: true,
      // omitted:
      // coniugium: false,
      senator: false,
    })
  })

  test('should restore an omitted key on reset', () => {
    const record = reatomRecord({ a: 1, b: 2 })

    record.merge({ b: 3 })
    record.omit('a')
    record.reset('a')

    expect(record()).toEqual({ a: 1, b: 3 })
  })
})
