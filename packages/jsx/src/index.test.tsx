/* @jsx h */
import { parseHTML } from 'linkedom'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { Fn, atom } from '@reatom/core'
import { reatomLinkedList } from '@reatom/primitives'
import { isConnected } from '@reatom/hooks'
import { reatomJsx } from '.'

const test = suite('reatomJsx')

export const createWindow = () => {
  const window = parseHTML(`
    <!doctype html>
    <html>
      <head></head>
      <body></body>
    </html>
  `)

  // crutch: https://github.com/WebReflection/linkedom/issues/252
  const Text = new Proxy(window.Text, {
    construct(_, [value = '']) {
      return window.document.createTextNode(value)
    },
  })

  // crutch: https://github.com/WebReflection/linkedom/issues/252
  const DocumentFragment = new Proxy(window.DocumentFragment, {
    construct() {
      return window.document.createDocumentFragment()
    },
  })

  // linkedom `window` can't just be spread - add fields manually as needed
  return {
    document: window.document,
    Node: window.Node,
    Text,
    Element: window.Element,
    MutationObserver: window.MutationObserver,
    HTMLElement: window.HTMLElement,
    DocumentFragment,
  }
}

const setup = () => {
  const ctx = createTestCtx()
  const window = createWindow()
  const parent = window.document.createElement('div')
  window.document.body.appendChild(parent)
  const jsx = reatomJsx(ctx, window)
  return { ctx, ...jsx, parent, window }
}

test('static props & children', () => {
  const { h, hf } = setup()

  const element = <div id="some-id">Hello, world!</div>

  assert.is(element.tagName, 'DIV')
  assert.is(element.id, 'some-id')
  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, 'Hello, world!')
})

test('dynamic props', () => {
  const { ctx, h, hf, mount, parent } = setup()

  const val = atom('val', 'val')
  const prp = atom('prp', 'prp')
  const atr = atom('atr', 'atr')

  const element = <div id={val} prop:prp={prp} attr:atr={atr} />

  mount(parent, element)

  assert.is(element.id, 'val')
  // @ts-expect-error `dunno` can't be inferred
  assert.is(element.prp, 'prp')
  assert.is(element.getAttribute('atr'), 'atr')

  val(ctx, 'val1')
  prp(ctx, 'prp1')
  atr(ctx, 'atr1')

  assert.is(element.id, 'val1')
  // @ts-expect-error `dunno` can't be inferred
  assert.is(element.prp, 'prp1')
  assert.is(element.getAttribute('atr'), 'atr1')
})

test('children updates', () => {
  const {
    ctx,
    h,
    hf,
    mount,
    parent,
    window: { document },
  } = setup()

  const val = atom('foo', 'val')

  const route = atom('a', 'route')
  const a = document.createElement('div')
  const b = document.createElement('div')

  const element = (
    <div>
      Static one. {val}
      {atom((ctx) => (ctx.spy(route) === 'a' ? a : b))}
    </div>
  )

  mount(parent, element)

  assert.is(element.childNodes.length, 3)
  assert.is(element.childNodes[1]?.textContent, 'foo')
  assert.is(element.childNodes[2], a)

  val(ctx, 'bar')
  assert.is(element.childNodes[1]?.textContent, 'bar')

  assert.is(element.childNodes[2], a)
  route(ctx, 'b')
  assert.is(element.childNodes[2], b)
})

test('dynamic children', () => {
  const { ctx, h, hf, mount, parent } = setup()

  const children = atom(<div />)

  const element = <div>{children}</div>

  mount(parent, element)

  assert.is(element.childNodes.length, 1)

  children(ctx, <div>Hello, world!</div>)
  assert.is(element.childNodes[0]?.textContent, 'Hello, world!')

  const inner = <span>inner</span>
  children(ctx, <div>{inner}</div>)
  assert.is(element.childNodes[0]?.childNodes[0], inner)

  const before = atom('before', 'before')
  const after = atom('after', 'after')
  children(
    ctx,
    <div>
      {before}
      {inner}
      {after}
    </div>,
  )
  assert.is((element as HTMLDivElement).innerText, 'beforeinnerafter')

  before(ctx, 'before...')
  assert.is((element as HTMLDivElement).innerText, 'before...innerafter')
})

test('spreads', () => {
  const { h, hf, mount, parent } = setup()

  const clickTrack = mockFn()
  const props = atom({
    id: '1',
    'attr:b': '2',
    'on:click': clickTrack as Fn,
  })

  const element = <div $spread={props} />

  mount(parent, element)

  assert.is(element.id, '1')
  assert.is(element.getAttribute('b'), '2')
  assert.is(clickTrack.calls.length, 0)
  // @ts-expect-error
  element.click()
  assert.is(clickTrack.calls.length, 1)
})

test('fragment as child', () => {
  const { h, hf, mount, parent } = setup()

  const child = (
    <>
      <div>foo</div>
      <>
        <div>bar</div>
      </>
    </>
  )
  mount(parent, child)

  assert.is(parent.childNodes.length, 2)
  assert.is(parent.childNodes[0]?.textContent, 'foo')
  assert.is(parent.childNodes[1]?.textContent, 'bar')
})

test('array children', () => {
  const { ctx, h, hf, mount, parent } = setup()

  const n = atom(1)
  const list = atom((ctx) =>
    Array.from({ length: ctx.spy(n) }, (_, i) => <li>{i + 1}</li>),
  )

  assert.throws(() => {
    mount(
      parent,
      <ul>
        {list /* expected TS error */ as any}
        <br />
      </ul>,
    )
  })

  const element = <ul>{list}</ul>

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '1')

  n(ctx, 2)
  assert.is(element.childNodes.length, 2)
  assert.is(element.textContent, '12')
})

test('linked list', () => {
  const { ctx, h, hf, mount, parent } = setup()

  const list = reatomLinkedList((ctx, n: number) => atom(n))
  const jsxList = list.reatomMap((ctx, n) => <li>{n}</li>)
  const one = list.create(ctx, 1)
  const two = list.create(ctx, 2)
  const ul = <ul>{jsxList}</ul>

  mount(parent, ul)

  ctx.get(jsxList).head!.innerHTML += 0
  assert.is(parent.innerText, '10\n2')

  list.swap(ctx, one, two)
  assert.is(parent.innerText, '2\n10')

  list.clear(ctx)
  assert.is(parent.innerText, '')

  // TODO
  // assert.not.ok(isConnected(ctx, one))

  // assert.is(parent.children.length, 1)
  // assert.ok(isConnected(ctx, jsxList))

  // ul.remove()
  // list.create(ctx, 1)
  // assert.is(parent.children.length, 0)
  // assert.not.ok(isConnected(ctx, jsxList))
})

test('boolean as child', () => {
  const { h, hf } = setup()

  const trueAtom = atom(true, 'true')
  const trueValue = true
  const falseAtom = atom(false, 'false')
  const falseValue = false

  const element = <div>
    {trueAtom}
    {trueValue}
    {falseAtom}
    {falseValue}
  </div>

  assert.is(element.childNodes.length, 2)
  assert.is(element.textContent, '')
})

test('null as child', () => {
  const { h, hf } = setup()

  const nullAtom = atom(null, 'null')
  const nullValue = null

  const element = <div>
    {nullAtom}
    {nullValue}
  </div>

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '')
})

test('undefined as child', () => {
  const { h, hf } = setup()

  const undefinedAtom = atom(undefined, 'undefined')
  const undefinedValue = undefined

  const element = <div>
    {undefinedAtom}
    {undefinedValue}
  </div>

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '')
})

test('empty string as child', () => {
  const { h, hf } = setup()

  const emptyStringAtom = atom('', 'emptyString')
  const emptyStringValue = ''

  const element = <div>
    {emptyStringAtom}
    {emptyStringValue}
  </div>

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '')
})

test('update skipped atom', () => {
  const { ctx, h, hf, mount, parent } = setup()

  const valueAtom = atom<number | undefined>(undefined, 'value')

  const element = <div>{valueAtom}</div>

  mount(parent, element)

  assert.is(parent.childNodes.length, 1)
  assert.is(parent.textContent, '')

  valueAtom(ctx, 123)

  assert.is(parent.childNodes.length, 1)
  assert.is(parent.textContent, '123')
})

test('render HTMLElement atom', () => {
  const { h, hf } = setup()

  const htmlAtom = atom(<div>div</div>, 'html')

  const element = <div>{htmlAtom}</div>

  assert.is(element.innerHTML, '<div>div</div>')
})

test('render SVGElement atom', () => {
  const { h, hf } = setup()

  const svgAtom = atom(<svg:svg>svg</svg:svg>, 'svg')

  const element = <div>{svgAtom}</div>

  assert.is(element.innerHTML, '<svg>svg</svg>')
})

test.run()
