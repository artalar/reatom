import { createTestCtx } from '@reatom/testing'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { Atom, atom } from '@reatom/core'
import { parseAtoms } from './parseAtoms'

const test = suite('parseAtoms')

test('should return value', () => {
  const ctx = createTestCtx()

  assert.is(parseAtoms(ctx, 'some bare value'), 'some bare value')
  assert.is(parseAtoms(ctx, 10), 10)
  assert.is(
    parseAtoms(ctx, Symbol.for('specialSymbol')),
    Symbol.for('specialSymbol'),
  )
  ;`👍` //?
})

test('should parse deep atoms', () => {
  const ctx = createTestCtx()

  assert.is(
    parseAtoms(
      ctx,
      atom(() => atom('deep')),
    ),
    'deep',
  )
  assert.equal(
    parseAtoms(
      ctx,
      atom(() => [atom(['deep'])]),
    ),
    [['deep']],
  )
  ;`👍` //?
})

test('should parse records', () => {
  const ctx = createTestCtx()

  assert.equal(
    parseAtoms(ctx, {
      someValue: atom(1),
      someDeep: {
        deep: {
          deep: atom('value'),
        },
      },
    }),
    {
      someValue: 1,
      someDeep: {
        deep: {
          deep: 'value',
        },
      },
    },
  )
  ;`👍` //?
})

test('should parse maps', () => {
  const ctx = createTestCtx()

  const atomized = new Map()
  const keyObj = {}
  const keyAtom = atom('')
  atomized.set(1, atom(1))
  atomized.set(keyObj, atom({ someKey: atom('someValue') }))
  atomized.set(keyAtom, 'someRawValue')

  const parsed = parseAtoms(ctx, atomized)
  assert.is(parsed.get(1), 1)
  assert.equal(parsed.get(keyObj), { someKey: 'someValue' })
  assert.equal(parsed.get(keyAtom), 'someRawValue')
  assert.is(parsed.size, 3)
  ;`👍` //?
})
test('should spy if inside atom', () => {
  const ctx = createTestCtx()

  const valueAtom = atom('default')
  const parsedAtom = atom((ctx) => parseAtoms(ctx, { key: valueAtom }))

  assert.equal(ctx.get(parsedAtom), { key: 'default' })

  valueAtom(ctx, 'new')
  assert.equal(ctx.get(parsedAtom), { key: 'new' })
  ;`👍` //?
})

test('should parse sets', () => {
  const ctx = createTestCtx()

  const atomized = new Set()
  const symbol = Symbol()
  const keyObj = { __id__: symbol }
  atomized.add(atom(1))
  atomized.add(atom(1))
  atomized.add(atom(1))
  atomized.add(atom(1))

  atomized.add(keyObj)
  atomized.add('someRawValue')

  const parsed = parseAtoms(ctx, atomized)
  const values = Array.from(parsed.values())
  assert.ok(parsed.has(1), '')
  assert.ok(parsed.has('someRawValue'))

  assert.not.ok(parsed.has(keyObj))
  assert.ok(values.some((a: any) => a?.__id__ === symbol))

  // assert.is(parsed.size, 3)
  ;`👍` //?
})

test('should parse mixed values', () => {
  const ctx = createTestCtx()

  assert.equal(
    parseAtoms(ctx, {
      someValue: atom(1),
      someDeep: {
        deep: {
          deep: atom('value'),
        },
      },
    }),
    {
      someValue: 1,
      someDeep: {
        deep: {
          deep: 'value',
        },
      },
    },
  )
  ;`👍` //?
})

test('should parse deep structures', () => {
  const ctx = createTestCtx()

  assert.equal(parseAtoms(ctx, [[[[[atom('deepStruct')]]]]]), [
    [[[['deepStruct']]]],
  ])
  ;`👍` //?
})

test('circular structures', () => {
  const ctx = createTestCtx()

  const dummy = atom(null)

  const a = atom((ctx):{b: Atom<any>} => {
    ctx.spy(dummy) // add a dependency to prevent it from restarting on every call
    return {b}
  })

  const b = atom((ctx) => {
    ctx.spy(dummy)
    return {a}
  })

  const snapshot = parseAtoms(ctx, a)
  assert.equal(snapshot, snapshot.b.a)
  assert.equal(snapshot.b, snapshot.b.a.b)
})

test.run()
