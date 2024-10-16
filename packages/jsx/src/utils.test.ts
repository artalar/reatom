import * as assert from 'uvu/assert'
import { normalizeClass } from './utils'

describe('normalizeClass', () => {
  it('handles undefined correctly', () => {
    assert.is(normalizeClass(undefined), '')
  })

  it('handles string correctly', () => {
    assert.is(normalizeClass('foo'), 'foo')
  })

  it('handles array correctly', () => {
    assert.is(normalizeClass(['foo', undefined, true, false, 'bar']), 'foo bar')
  })

  it('handles string containing spaces correctly', () => {
    assert.is(normalizeClass('foo1 '), 'foo1')
    assert.is(normalizeClass(['foo ', ' baz ']), 'foo baz')
  })

  it('handles empty array correctly', () => {
    assert.is(normalizeClass([]), '')
  })

  it('handles nested array correctly', () => {
    assert.is(normalizeClass(['foo', ['bar'], [['baz']]]), 'foo bar baz')
  })

  it('handles object correctly', () => {
    assert.is(normalizeClass({ foo: true, bar: false, baz: true }), 'foo baz')
  })

  it('handles empty object correctly', () => {
    assert.is(normalizeClass({}), '')
  })

  it('handles arrays and objects correctly', () => {
    assert.is(normalizeClass(['foo', ['bar'], { baz: true }, [{ qux: true }]]), 'foo bar baz qux')
  })

  it('handles array of objects with falsy values', () => {
    assert.is(
      normalizeClass([
        { foo: false },
        { bar: 0 },
        { baz: -0 },
        { qux: '' },
        { quux: null },
        { corge: undefined },
        { grault: NaN },
      ]), '')
  })

  it('handles array of objects with truthy values', () => {
    assert.is(
      normalizeClass([
        { foo: true },
        { bar: 'not-empty' },
        { baz: 1 },
        { qux: {} },
        { quux: [] },
      ]), 'foo bar baz qux quux')
  })
})
