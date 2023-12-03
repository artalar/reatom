import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { parseHTML } from 'linkedom'
import { createTestCtx, mockFn } from '@reatom/testing'
import { reatomJsx } from '.'
import { CtxSpy, atom } from '@reatom/core'
import { match } from '@reatom/lens'
import { ReatomElement } from './types'

const setup = () => {
  const ctx = createTestCtx()
  const { window } = parseHTML(`
    <!doctype html>
    <html>
      <head></head>
      <body></body>
    </html>
  `)
  const parent = window.document.createElement('div')
  window.document.body.appendChild(parent)
  const jsx = reatomJsx(ctx, window)
  return [ctx, jsx, parent, window] as const
}

test('static props & children', () => {
  const [ctx, jsx, parent] = setup()

  const element = jsx.h('div', {
    id: 'some-id',
    children: 'Hello, world!',
  })

  jsx.mount(parent, element)

  assert.is(element.tagName, 'DIV')
  assert.is(element.id, 'some-id')
  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, 'Hello, world!')
})

test('dynamic props', () => {
  const [ctx, jsx, parent] = setup()

  const val = atom('foo', 'val')

  const element = jsx.h('div', {
    id: val,
    dunno: val,
    'field:dunno': val,
  })

  jsx.mount(parent, element)

  assert.is(element.id, 'foo')
  assert.is(element.dunno, 'foo')
  assert.is(element.getAttribute('dunno'), 'foo')

  val(ctx, 'bar')

  assert.is(element.id, 'bar')
  assert.is(element.dunno, 'bar')
  assert.is(element.getAttribute('dunno'), 'bar')
})

test('dynamic children', () => {
  const [ctx, jsx, parent, { document }] = setup()

  const val = atom('foo', 'val')

  const route = atom('a', 'route')
  const a = document.createElement('div')
  const b = document.createElement('div')

  const element = jsx.h('div', {
    children: [
      'Static one. ',
      val,
      (ctx: CtxSpy) => (ctx.spy(route) === 'a' ? a : b),
    ],
  })

  jsx.mount(parent, element)

  assert.is(element.childNodes.length, 3)
  assert.is(element.childNodes[1].constructor, 'foo')
  assert.is(element.childNodes[2], a)

  val(ctx, 'bar')
  assert.is(element.childNodes[1].innerText, 'bar')

  route(ctx, 'b')
  assert.is(element.childNodes[2], b)
})

test.run()
