import { createCtx } from '@reatom/core'
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { reatomRecord } from '../build'

test('reatomRecord', () => {
  const ctx = createCtx()
  const person = reatomRecord({
    civis: true,
    paterfamilias: true,
    servus: false,
    vir: true,
    coniugium: false,
    senator: true,
  })

  person.merge(ctx, {
    civis: false,
    servus: true,
    senator: false,
  })

  assert.equal(ctx.get(person), {
    civis: false,
    paterfamilias: true,
    servus: true,
    vir: true,
    coniugium: false,
    senator: false,
  })

  person.reset(ctx, 'civis', 'servus')
  person.omit(ctx, 'coniugium')

  assert.equal(ctx.get(person), {
    civis: true,
    paterfamilias: true,
    servus: false,
    vir: true,
    // omitted:
    // coniugium: false,
    senator: false,
  })
})

test.run()
