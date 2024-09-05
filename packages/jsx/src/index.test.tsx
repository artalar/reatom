/* @jsx h */
import { parseHTML } from 'linkedom'
import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { createTestCtx, mockFn } from '@reatom/testing'
import { Fn, action, atom } from '@reatom/core'
import { reatomLinkedList } from '@reatom/primitives'
import { isConnected } from '@reatom/hooks'
import { reatomJsx, type JSX } from '.'
import { sleep } from '@reatom/utils'

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
  const list = atom((ctx) => Array.from({ length: ctx.spy(n) }, (_, i) => <li>{i + 1}</li>))

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

test('linked list', async () => {
  const { ctx, h, hf, mount, parent } = setup()

  const list = reatomLinkedList((ctx, n: number) => atom(n))
  const jsxList = list.reatomMap((ctx, n) => <span>{n}</span>)
  const one = list.create(ctx, 1)
  const two = list.create(ctx, 2)

  mount(parent, <div>{jsxList}</div>)

  assert.is(parent.innerText, '12')
  assert.ok(isConnected(ctx, one))
  assert.ok(isConnected(ctx, two))

  list.swap(ctx, one, two)
  assert.is(parent.innerText, '21')

  list.remove(ctx, two)
  assert.is(parent.innerText, '1')
  await sleep()
  assert.ok(isConnected(ctx, one))
  assert.not.ok(isConnected(ctx, two))
})

test('boolean as child', () => {
  const { h, hf } = setup()

  const trueAtom = atom(true, 'true')
  const trueValue = true
  const falseAtom = atom(false, 'false')
  const falseValue = false

  const element = (
    <div>
      {trueAtom}
      {trueValue}
      {falseAtom}
      {falseValue}
    </div>
  )

  assert.is(element.childNodes.length, 2)
  assert.is(element.textContent, '')
})

test('null as child', () => {
  const { h, hf } = setup()

  const nullAtom = atom(null, 'null')
  const nullValue = null

  const element = (
    <div>
      {nullAtom}
      {nullValue}
    </div>
  )

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '')
})

test('undefined as child', () => {
  const { h, hf } = setup()

  const undefinedAtom = atom(undefined, 'undefined')
  const undefinedValue = undefined

  const element = (
    <div>
      {undefinedAtom}
      {undefinedValue}
    </div>
  )

  assert.is(element.childNodes.length, 1)
  assert.is(element.textContent, '')
})

test('empty string as child', () => {
  const { h, hf } = setup()

  const emptyStringAtom = atom('', 'emptyString')
  const emptyStringValue = ''

  const element = (
    <div>
      {emptyStringAtom}
      {emptyStringValue}
    </div>
  )

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

test('custom component', () => {
  const { h, hf, window } = setup()

  const Component = (props: JSX.HTMLAttributes) => <div {...props} />

  assert.instance(<Component />, window.HTMLElement)
  assert.is(((<Component draggable />) as HTMLElement).draggable, true)
  assert.equal(((<Component>123</Component>) as HTMLElement).innerText, '123')
})

test('ref unmount callback', async () => {
  const { h, hf, parent, mount, window } = setup()

  const Component = (props: JSX.HTMLAttributes) => <div {...props} />

  let ref: null | HTMLElement = null

  const component = (
    <Component
      ref={(ctx, el) => {
        ref = el
        return () => {
          ref = null
        }
      }}
    />
  )

  mount(parent, component)
  assert.instance(ref, window.HTMLElement)

  parent.remove()
  await sleep()
  assert.is(ref, null)
})

test('child ref unmount callback', async () => {
  const { h, hf, parent, mount, window } = setup()

  const Component = (props: JSX.HTMLAttributes) => <div {...props} />

  let ref: null | HTMLElement = null

  const component = (
    <Component
      ref={(ctx, el) => {
        ref = el
        return () => {
          ref = null
        }
      }}
    />
  )

  mount(parent, component)
  assert.instance(ref, window.HTMLElement)
  await sleep()

  ref!.remove()
  await sleep()
  assert.is(ref, null)
})

test('same arguments in ref mount and unmount hooks', async () => {
  const { ctx, h, hf, parent, mount, window } = setup()

  const mountArgs: unknown[] = []
  const unmountArgs: unknown[] = []

  let ref: null | HTMLElement = null

  const component = (
    <div
      ref={(ctx, el) => {
        mountArgs.push(ctx, el)
        ref = el
        return (ctx, el) => {
          unmountArgs.push(ctx, el)
          ref = null
        }
      }}
    />
  )

  mount(parent, component)
  assert.instance(ref, window.HTMLElement)
  await sleep()

  ref!.remove()
  await sleep()
  assert.is(ref, null)

  assert.is(mountArgs[0], ctx)
  assert.is(mountArgs[1], component)

  assert.is(unmountArgs[0], ctx)
  assert.is(unmountArgs[1], component)
})

test('css property and class attribute', async () => {
  const { h, hf, parent, mount, window } = setup()

  const cls = 'class'
  const css = 'color: red;'

  const ref1 = (<div css={css} class={cls}></div>)
  const ref2 = (<div class={cls} css={css}></div>)

  const component = (
    <div>
      {ref1}
      {ref2}
    </div>
  )

  mount(parent, component)
  assert.instance(ref1, window.HTMLElement)
  assert.instance(ref2, window.HTMLElement)
  await sleep()

  assert.is(ref1.className, cls)
  assert.ok(ref1.dataset.reatom)

  assert.is(ref2.className, cls)
  assert.ok(ref2.dataset.reatom)

  assert.is(ref1.dataset.reatom, ref2.dataset.reatom)
})

test('ref mount and unmount callbacks order', async () => {
  const { h, hf, parent, mount, window } = setup()

  const order: number[] = []

  const createRef = (index: number) => {
    return () => {
      order.push(index)
      return () => {
        order.push(index)
      }
    }
  }

  const component = (
    <div ref={createRef(0)}>
      <div ref={createRef(1)}>
        <div ref={createRef(2)}>
        </div>
      </div>
    </div>
  )

  mount(parent, component)
  parent.remove()
  await sleep()

  assert.equal(order, [2, 1, 0, 2, 1, 0])
})

test('style object update', () => {
  const { ctx, h, hf, parent, mount, window } = setup()

  const styleAtom = atom({
    top: '0',
    right: undefined,
    bottom: null as unknown as undefined,
    left: '0',
  } as JSX.CSSProperties)

  const component = (
    <div style={styleAtom}></div>
  )

  mount(parent, component)

  assert.is(component.getAttribute('style'), 'top:0;left:0')

  styleAtom(ctx, {
    top: undefined,
    bottom: '0',
  })

  assert.is(component.getAttribute('style'), 'left:0;bottom:0')
})

test.run()
