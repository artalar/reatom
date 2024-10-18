import * as assert from 'uvu/assert'
import { buildClassName } from './utils'

describe('buildClassName', () => {
  it('handles undefined correctly', () => {
    assert.is(buildClassName(undefined), '')
  })

  it('handles string correctly', () => {
    assert.is(buildClassName('foo'), 'foo')
  })

  it('handles array correctly', () => {
    assert.is(buildClassName(['foo', undefined, true, false, 'bar']), 'foo bar ')
  })

  // it('handles string containing spaces correctly', () => {
  //   assert.is(buildClassName('foo1 '), 'foo1')
  //   assert.is(buildClassName(['foo ', ' baz ']), 'foo baz')
  // })

  it('handles empty array correctly', () => {
    assert.is(buildClassName([]), '')
  })

  it('handles nested array correctly', () => {
    assert.is(buildClassName(['foo', ['bar'], [['baz']]]), 'foo bar  baz   ')
  })

  it('handles object correctly', () => {
    assert.is(buildClassName({ foo: true, bar: false, baz: true }), 'foo baz ')
  })

  it('handles empty object correctly', () => {
    assert.is(buildClassName({}), '')
  })

  it('handles arrays and objects correctly', () => {
    assert.is(buildClassName(['foo', ['bar'], { baz: true }, [{ qux: true }]]), 'foo bar  baz  qux   ')
  })

  it('handles array of objects with falsy values', () => {
    assert.is(
      buildClassName([
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
      buildClassName([
        { foo: true },
        { bar: 'not-empty' },
        { baz: 1 },
        { qux: {} },
        { quux: [] },
      ]), 'foo  bar  baz  qux  quux  ')
  })
})
