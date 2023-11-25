import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { parseHTML } from 'linkedom'
import { createTestCtx, mockFn } from '@reatom/testing'
import { reatomJsx } from './'
import { atom } from '@reatom/core'
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
  const jsx = reatomJsx(ctx, window)
  return [ctx, jsx, window] as const
}

test('static attributes', () => {
  const [ctx, jsx] = setup()

  const element = jsx.reatomElement('div', {
    id: 'some-id',
  })

  ctx.get(element.sync)
  assert.is(element.element.id, 'some-id')
})

test('dynamic bindings', () => {
  const [ctx, jsx] = setup()

  const id = atom('first', 'id')

  const element = jsx.reatomElement('div', {
    id: id,
  })

  ctx.get(element.sync)
  assert.is(element.element.id, 'first')

  id(ctx, 'second')
  ctx.get(element.sync)
  assert.is(element.element.id, 'second')
})

test('event handlers', () => {
  const [ctx, jsx] = setup()

  const handler = mockFn()

  const element = jsx.reatomElement<HTMLButtonElement>('button', {
    onclick: handler,
  })

  ctx.get(element.sync)

  element.element.click()
  assert.is(handler.calls.length, 1)
  assert.is(handler.lastInput(0), ctx)

  element.element.click()
  assert.is(handler.calls.length, 2)
})

test('static children', () => {
  const [ctx, jsx] = setup()

  const inner = jsx.reatomElement('div', {})

  const outer = jsx.reatomElement('div', {
    children: ['The number is:', 0, inner],
  })

  ctx.get(outer.sync)
  assert.is(outer.element.childNodes.length, 3)
  assert.is(outer.element.childNodes[0]!.textContent, 'The number is:')
  assert.is(outer.element.childNodes[1]!.textContent, '0')
  assert.is(outer.element.childNodes[2], inner.element)
})

test('dynamic children', () => {
  const [ctx, jsx] = setup()

  const num = atom(0, 'num')
  const numIsBig = atom((ctx) => ctx.spy(num) > 10)

  const inner = jsx.reatomElement('strong', {
    children: ['Your number is really big!'],
  })

  const outer = jsx.reatomElement('div', {
    children: [
      //
      'The number is',
      num,
      match(numIsBig).truthy(inner),
    ],
  })

  ctx.get(outer.sync)
  assert.is(outer.element.childNodes.length, 2)
  assert.is(outer.element.childNodes[1]!.textContent, '0')

  num(ctx, 3)
  ctx.get(outer.sync)
  assert.is(outer.element.childNodes[1]!.textContent, '3')
})

test('element lifecycle hooks', () => {
  const
})

test('fragment', () => {
  const [ctx, jsx] = setup()

  const element = jsx.h('div', {
    children: [
      jsx.h(jsx.hf, {
        children: jsx.h(jsx.hf, {
          children: ['Hello world!'],
        }),
      }),
    ],
  }) as ReatomElement

  ctx.get(element.sync)
  assert.is(element.element.textContent, 'Hello world!')
})

test('mounting', () => {
  const [ctx, jsx, window] = setup()

  const root = window.document.createElement('div')
  window.document.body.appendChild(root)

  const title = atom('Hello world!', 'title')

  jsx.mount(root, jsx.h('div', {}, [title]))

  assert.is(root.childNodes.length, 1)
  assert.is(root.childNodes[0]?.textContent, 'Hello world!')

  title(ctx, 'Bye!')
  assert.is(root.childNodes[0]?.textContent, 'Bye!')
})

test.run()
