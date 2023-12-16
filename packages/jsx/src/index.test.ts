import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx } from '@reatom/testing'
import { reatomJsx, sync } from '.'
import { CtxSpy, Rec, atom } from '@reatom/core'
import { JsxNode } from './types'
import { createWindow } from './create-window'

const setup = () => {
  const ctx = createTestCtx()
  const window = createWindow()
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

test('children updates', () => {
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
  assert.is(element.childNodes[1].textContent, 'foo')
  assert.is(element.childNodes[2], a)

  val(ctx, 'bar')
  assert.is(element.childNodes[1].textContent, 'bar')

  assert.is(element.childNodes[2], a)
  route(ctx, 'b')
  assert.is(element.childNodes[2], b)
})

test('dynamic children', () => {
  let [ctx, jsx] = setup()
  ctx.spy = ctx.get.bind(ctx)

  const children = atom<JsxNode | Array<JsxNode>>([])

  const element = jsx.h('div', {}, children)

  assert.is(element.childNodes.length, 0)

  children(ctx, 'Hello, world!')
  sync(ctx as any, element)
  assert.is(element.childNodes[0].textContent, 'Hello, world!')

  children(ctx, 'Bye, world!')
  sync(ctx as any, element)
  assert.is(element.childNodes[0].textContent, 'Bye, world!')

  const inner = jsx.h('span', {}, 'inner')
  children(ctx, inner)
  sync(ctx as any, element)
  assert.is(element.childNodes[0], inner)

  const before = atom('before', 'before')
  const after = atom('after', 'after')
  children(ctx, [before, inner, after])
  sync(ctx as any, element)
  assert.is(element.innerText, 'beforeinnerafter')

  before(ctx, 'before...')
  sync(ctx as any, element)
  assert.is(element.innerText, 'before...innerafter')
})

test('spreads', () => {
  const [ctx, jsx] = setup()
  ctx.spy = ctx.get.bind(ctx)

  const val = atom('Foo', 'val')

  const e1 = jsx.h('div', {
    $props: {
      static: true,
      val,
    },
  })

  sync(ctx as any, e1)
  assert.is(e1.getAttribute('static'), 'true')
  assert.is(e1.getAttribute('val'), 'Foo')

  val(ctx, 'Bar')
  sync(ctx as any, e1)
  assert.is(e1.getAttribute('val'), 'Bar')

  const $props = atom<Rec>({}, '$props')
  const e2 = jsx.h('div', {
    $props,
  })

  $props(ctx, { val: 'Foo' })
  sync(ctx as any, e2)
  assert.is(e2.getAttribute('val'), 'Foo')

  $props(ctx, { val: 'Bar' })
  sync(ctx as any, e2)
  assert.is(e2.getAttribute('val'), 'Bar')

  $props(ctx, { val: 'Bar', another: true })
  sync(ctx as any, e2)
  assert.is(e2.getAttribute('another'), 'true')

  $props(ctx, {})
  sync(ctx as any, e2)
  assert.is(e2.getAttribute('val'), null)
  assert.is(e2.getAttribute('another'), null)
})

test.run()
