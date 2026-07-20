import {
  atom,
  clearStack,
  computed,
  context,
  type Fn,
  isConnected,
  reatomField,
  reatomForm,
  sleep,
  top,
  withConnectHook,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test, vi } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { Bind, DEBUG, h, hf, instance, type JSX, mount, stylesheet } from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const parent = atom(() => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)

  return main
}, 'parent')

const stripJsxCompilerProps = (value: string) =>
  value.replaceAll(/\s__(?:self|source)="[^"]*"/g, '')

test('static props & children', () =>
  context.start(async () => {
    const element = <div id="some-id">Hello, world!</div>

    mount(parent(), element)
    await wrap(sleep())

    expect(element.tagName).toBe('DIV')
    expect(element.id).toBe('some-id')
    expect(element.childNodes.length).toBe(1)
    expect(element.textContent).toBe('Hello, world!')
  }))

test('dynamic props', () =>
  context.start(async () => {
    const val = atom('val', 'val')
    const prp = atom('prp', 'prp')
    const atr = atom('atr', 'atr')

    const element = <div id={val} prop:prp={prp} attr:atr={atr} />

    mount(parent(), element)
    await wrap(sleep())

    expect(element.id).toBe('val')
    expect((element as any).prp).toBe('prp')
    expect(element.getAttribute('atr')).toBe('atr')

    val.set('val1')
    prp.set('prp1')
    atr.set('atr1')

    await wrap(sleep())
    expect(element.id).toBe('val1')
    expect((element as any).prp).toBe('prp1')
    expect(element.getAttribute('atr')).toBe('atr1')
  }))

test('getter props', () =>
  context.start(async () => {
    const val = atom('val', 'val')
    const getter = () => val() + ' ' + val()
    const element = <div id={getter} />

    mount(parent(), element)
    await wrap(sleep())
    expect(element.id).toBe(getter())

    val.set('val1')
    await wrap(sleep())
    expect(element.id).toBe(getter())
  }))

test('children updates', () =>
  context.start(async () => {
    const val = atom('foo', 'val')

    const route = atom('a', 'route')
    const a = window.document.createElement('div')
    const b = window.document.createElement('div')

    const element = (
      <div>
        Static one. {val}
        {computed(() => (route() === 'a' ? a : b))}
      </div>
    )

    mount(parent(), element)
    await wrap(sleep())

    // Primitive string atom → single Text node (no live-fragment markers)
    expect(element.childNodes.length).toBe(5)
    expect(element.childNodes[1]?.textContent).toBe('foo')
    expect(element.childNodes[3]).toBe(a)

    val.set('bar')
    await wrap(sleep())
    expect(element.childNodes[1]?.textContent).toBe('bar')

    expect(element.childNodes[3]).toBe(a)
    route.set('b')
    await wrap(sleep())
    expect(element.childNodes[3]).toBe(b)
  }))

test('dynamic children', () =>
  context.start(async () => {
    const children = atom(<div />)

    const element = <div>{children}</div>

    mount(parent(), element)
    await wrap(sleep())

    expect(element.childNodes.length).toBe(3)

    children.set(<div>Hello, world!</div>)
    await wrap(sleep())
    expect(element.childNodes[1]?.textContent).toBe('Hello, world!')

    const inner = <span>inner</span>
    children.set(<div>{inner}</div>)
    await wrap(sleep())
    expect(element.childNodes[1]?.childNodes[0]).toBe(inner)

    const before = atom('before', 'before')
    const after = atom('after', 'after')
    children.set(
      <div>
        {before}
        {inner}
        {after}
      </div>,
    )
    before.set('before...')
    await wrap(sleep())
    expect(instance(HTMLDivElement, element).innerText).toBe(
      'before...innerafter',
    )
  }))

test('on: handler action name uses function name', () =>
  context.start(async () => {
    // Action wrapping for named handlers only runs when DEBUG is enabled.
    DEBUG.set(true)
    let namedActionName = ''
    let anonymousActionName = ''
    let frequentActionName = ''

    function handleClick() {
      namedActionName = top().atom.name
    }

    function handlePanMove() {
      frequentActionName = top().atom.name
    }

    const Button = () => (
      <button
        on:click={handleClick}
        on:dblclick={() => (anonymousActionName = top().atom.name)}
        on:mousemove={handlePanMove}
      >
        click
      </button>
    )

    const element = instance(HTMLButtonElement, <Button />)

    mount(parent(), element)
    await wrap(sleep())

    element.click()
    expect(namedActionName).toBe('Button.button.handleClick')

    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(anonymousActionName).toBe('Button.button.dblclick')

    element.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    expect(frequentActionName).toBe('Button.button._handlePanMove')

    DEBUG.set(false)
  }))

test('function child computed name uses component and element', () =>
  context.start(async () => {
    // Atom key strings are only allocated when DEBUG is enabled.
    DEBUG.set(true)
    let computedName = ''

    const InfoRow = ({ value }: { value: () => string }) => (
      <div>
        <span>{value}</span>
      </div>
    )

    const element = (
      <InfoRow
        value={() => {
          computedName = top().atom.name
          return 'ok'
        }}
      />
    )

    mount(parent(), element)
    await wrap(sleep())

    expect(computedName).toBe('InfoRow.span._children')
    DEBUG.set(false)
  }))

test('spreads', () =>
  context.start(async () => {
    const clickTrack = vi.fn()
    const props = atom({
      id: '1',
      'attr:b': '2',
      'on:click': clickTrack as Fn,
      $spread: {
        class: () => ['aaa', atom('bbb')],
        $spread: {
          'style:color': 'red',
        },
      },
    })

    const element = instance(HTMLDivElement, <div $spread={props} />)

    mount(parent(), element)
    await wrap(sleep())

    expect(element.id).toBe('1')
    expect(element.getAttribute('b')).toBe('2')
    expect(element.getAttribute('class')).toBe('aaa bbb')
    expect(element.getAttribute('style')).toBe('color: red;')
    expect(clickTrack.mock.calls.length).toBe(0)
    element.click()
    expect(clickTrack.mock.calls.length).toBe(1)
  }))

test.skip('spreads difference', () =>
  context.start(async () => {
    const props = atom<Partial<Record<'class' | 'id', string>>>({
      class: 'class',
    })
    const element = instance(HTMLDivElement, <div $spread={props} />)

    mount(parent(), element)
    await wrap(sleep())
    expect(element.className).toBe('class')
    expect(element.id).toBe('')

    props.set({ id: 'id' })
    await wrap(sleep())
    expect(element.className).toBe('')
    expect(element.id).toBe('id')
  }))

test('multiple render shared element', () =>
  context.start(async () => {
    const valueAtom = atom('abc', 'value')

    // Create the element inside the component so each mount gets a fresh
    // binding. Reusing a node after teardown drops reconnect thunks (leak
    // prevention) and would leave a stale text node.
    const Component = () => {
      const element = <p>{valueAtom}</p>
      return (
        <>
          <div id="1">{element}</div>
          <div id="2">{element}</div>
        </>
      )
    }

    const childAtom = atom<JSX.Element | undefined>(
      <Component></Component>,
      'child',
    )
    const app = <div>{childAtom}</div>

    mount(parent(), app)
    await wrap(sleep())
    expect(stripJsxCompilerProps(app.innerHTML)).toBe(
      '<!--child--><!----><div id="1"></div><div id="2"><p>abc</p></div><!----><!--child-->',
    )

    valueAtom.set('def')
    await wrap(sleep())
    expect(stripJsxCompilerProps(app.innerHTML)).toBe(
      '<!--child--><!----><div id="1"></div><div id="2"><p>def</p></div><!----><!--child-->',
    )

    childAtom.set(undefined)
    await wrap(sleep())
    expect(stripJsxCompilerProps(app.innerHTML)).toBe(
      '<!--child--><!--child-->',
    )

    childAtom.set(<Component></Component>)
    valueAtom.set('ghi')
    await wrap(sleep())
    expect(stripJsxCompilerProps(app.innerHTML)).toBe(
      '<!--child--><!----><div id="1"></div><div id="2"><p>ghi</p></div><!----><!--child-->',
    )
  }))

test('fragment as child', () =>
  context.start(async () => {
    const child = (
      <>
        <div>foo</div>
        <>
          <div>bar</div>
        </>
      </>
    )
    mount(parent(), child)
    await wrap(sleep())

    expect(parent().childNodes.length).toBe(6)
    expect(parent().textContent).toBe('foobar')
  }))

test('array children', () =>
  context.start(async () => {
    const n = atom(1)
    const list = computed(() =>
      Array.from({ length: n() }, (_, i) => <li>{i + 1}</li>),
    )

    const element = (
      <ul>
        {list}
        <br />
      </ul>
    )

    mount(parent(), element)
    await wrap(sleep())
    expect(element.childNodes.length).toBe(4)
    expect(element.textContent).toBe('1')

    n.set(2)
    await wrap(sleep())
    expect(element.childNodes.length).toBe(5)
    expect(element.textContent).toBe('12')
  }))

test('boolean as child', () =>
  context.start(async () => {
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

    await wrap(sleep())
    expect(element.childNodes.length).toBe(4)
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--true--><!--true--><!--false--><!--false-->',
    )
    expect(element.textContent).toBe('')
  }))

test('null as child', () =>
  context.start(async () => {
    const nullAtom = atom(null, 'null')
    const nullValue = null

    const element = (
      <div>
        {nullAtom}
        {nullValue}
      </div>
    )

    await wrap(sleep())
    expect(element.childNodes.length).toBe(2)
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--null--><!--null-->',
    )
    expect(element.textContent).toBe('')
  }))

test('undefined as child', () =>
  context.start(async () => {
    const undefinedAtom = atom(undefined, 'undefined')
    const undefinedValue = undefined

    const element = (
      <div>
        {undefinedAtom}
        {undefinedValue}
      </div>
    )

    await wrap(sleep())
    expect(element.childNodes.length).toBe(2)
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--undefined--><!--undefined-->',
    )
    expect(element.textContent).toBe('')
  }))

test('empty string as child', () =>
  context.start(async () => {
    const emptyStringAtom = atom('', 'emptyString')
    const emptyStringValue = ''

    const element = (
      <div>
        {emptyStringAtom}
        {emptyStringValue}
      </div>
    )

    await wrap(sleep())
    expect(element.childNodes.length).toBe(2)
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--emptyString--><!--emptyString-->',
    )
    expect(element.textContent).toBe('')
  }))

test('update skipped atom', () =>
  context.start(async () => {
    const valueAtom = atom<number | undefined>(undefined, 'value')

    const element = <div>{valueAtom}</div>

    mount(parent(), element)
    await wrap(sleep())

    expect(parent().childNodes.length).toBe(1)
    expect(parent().textContent).toBe('')

    valueAtom.set(123)

    await wrap(sleep())
    expect(parent().childNodes.length).toBe(1)
    expect(parent().textContent).toBe('123')
  }))

test('render HTMLElement atom', () =>
  context.start(async () => {
    const htmlAtom = atom(<div>div</div>, 'html')
    const element = <div>{htmlAtom}</div>

    mount(parent(), element)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--html--><div>div</div><!--html-->',
    )
  }))

test('render SVGElement atom', () =>
  context.start(async () => {
    const svgAtom = atom(<svg:svg>svg</svg:svg>, 'svg')
    const element = <div>{svgAtom}</div>

    mount(parent(), element)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--svg--><svg>svg</svg><!--svg-->',
    )
  }))

test('custom component', () =>
  context.start(async () => {
    const Component = (props: JSX.HTMLAttributes) => <div {...props} />

    await wrap(sleep())
    expect(<Component />).toBeInstanceOf(window.HTMLElement)
    expect(instance(HTMLElement, <Component draggable />).draggable).toBe(true)
    expect(instance(HTMLElement, <Component>123</Component>).innerText).toBe(
      '123',
    )
  }))

test('ref unmount callback', () =>
  context.start(async () => {
    const Component = (props: JSX.HTMLAttributes) => <div {...props} />

    let ref: null | HTMLElement = null

    const component = (
      <Component
        ref={(el) => {
          ref = el
          return () => {
            ref = null
          }
        }}
      />
    )

    mount(parent(), component)
    await wrap(sleep())
    expect(ref).toBeInstanceOf(window.HTMLElement)

    parent().remove()
    await wrap(sleep())
    expect(ref).toBe(null)
  }))

test('undefined ref does not throw on mount', () =>
  context.start(async () => {
    const Component = (props: JSX.HTMLAttributes) => <div {...props} />

    mount(parent(), <Component ref={undefined} />)
    await wrap(sleep())

    expect(parent().children).toHaveLength(1)
  }))

test('child ref unmount callback', () =>
  context.start(async () => {
    const Component = (props: JSX.HTMLAttributes) => <div {...props} />

    let ref: null | HTMLElement = null

    const component = (
      <Component
        ref={(el) => {
          ref = el
          return () => {
            ref = null
          }
        }}
      />
    )

    mount(parent(), component)
    await wrap(sleep())
    expect(ref).toBeInstanceOf(window.HTMLElement)

    ref!.remove()
    await wrap(sleep())
    expect(ref).toBe(null)
  }))

test('same arguments in ref mount and unmount hooks', () =>
  context.start(async () => {
    let mountElement: HTMLElement
    let unmountElement: HTMLElement

    let ref: null | HTMLElement = null

    const component = (
      <div
        ref={(el) => {
          mountElement = el
          ref = el
          return (el) => {
            unmountElement = el
            ref = null
          }
        }}
      />
    )

    mount(parent(), component)
    await wrap(sleep())
    expect(ref).toBeInstanceOf(window.HTMLElement)

    ref!.remove()
    await wrap(sleep())
    expect(ref).toBe(null)
    expect(mountElement!).toBe(component)
    expect(unmountElement!).toBe(component)
  }))

test('css property and class attribute', () =>
  context.start(async () => {
    const cls = 'class'
    const css = 'color: red;'

    const ref1 = <div css={css} class={cls}></div>
    const ref2 = <div class={cls} css={css}></div>

    const component = (
      <div>
        {ref1}
        {ref2}
      </div>
    )

    mount(parent(), component)
    expect(ref1).toBeInstanceOf(window.HTMLElement)
    expect(ref2).toBeInstanceOf(window.HTMLElement)
    await wrap(sleep())

    expect(ref1.className).toBe(cls)
    expect(ref1.dataset['reatomStyle']).toBeTruthy()

    expect(ref2.className).toBe(cls)
    expect(ref2.dataset['reatomStyle']).toBeTruthy()

    expect(ref1.dataset['reatomStyle']).toBe(ref2.dataset['reatomStyle'])
  }))

test('css property generate class name', () =>
  context.start(async () => {
    const First = () => <div css="color: red;"></div> // same
    const Second = () => <div css="color: red;"></div> // same
    const Third = () => <div css="color: blue;"></div>

    DEBUG.set(true)

    const first = <First></First>
    const second = <Second></Second>
    const third = <Third></Third>

    const component = (
      <div>
        {first}
        {second}
        {third}
      </div>
    )

    mount(parent(), component)
    await wrap(sleep())

    expect({ ...first.dataset }).toEqual({
      reatomName: 'First',
      reatomStyle: '_1', // same
    })
    expect({ ...second.dataset }).toEqual({
      reatomName: 'Second',
      reatomStyle: '_1', // same
    })
    expect({ ...third.dataset }).toEqual({
      reatomName: 'Third',
      reatomStyle: '_2',
    })
  }))

test('css custom property', () =>
  context.start(async () => {
    const colorAtom = atom('red' as string | undefined)

    const component = (
      <div css:first-property={colorAtom} css:secondProperty={colorAtom}></div>
    )

    mount(parent(), component)
    await wrap(sleep())

    expect(component.style.getPropertyValue('--first-property')).toBe('red')
    expect(component.style.getPropertyValue('--secondProperty')).toBe('red')

    colorAtom.set('green')

    await wrap(sleep())
    expect(component.style.getPropertyValue('--first-property')).toBe('green')
    expect(component.style.getPropertyValue('--secondProperty')).toBe('green')

    colorAtom.set(undefined)

    await wrap(sleep())
    expect(component.style.getPropertyValue('--first-property')).toBe('')
    expect(component.style.getPropertyValue('--secondProperty')).toBe('')
  }))

test('class and className attribute', () =>
  context.start(async () => {
    const classAtom = atom('' as string | undefined)

    const ref1 = <div class={classAtom}></div>
    const ref2 = <div className={classAtom}></div>

    const component = (
      <div>
        {ref1}
        {ref2}
      </div>
    )

    mount(parent(), component)
    await wrap(sleep())

    expect(ref1.hasAttribute('class')).toBe(true)
    expect(ref2.hasAttribute('class')).toBe(true)

    classAtom.set('cls')
    await wrap(sleep())
    expect(ref1.className).toBe('cls')
    expect(ref2.className).toBe('cls')
    expect(ref1.hasAttribute('class')).toBe(true)
    expect(ref2.hasAttribute('class')).toBe(true)

    classAtom.set(undefined)
    await wrap(sleep())
    expect(ref1.className).toBe('')
    expect(ref2.className).toBe('')
    expect(ref1.hasAttribute('class')).toBe(true)
    expect(ref2.hasAttribute('class')).toBe(true)
  }))

test('class handles complex correctly', () =>
  context.start(async () => {
    const isBAtom = atom(true)
    const stringAtom = atom('d')
    const element = (
      <div
        class={() => ['a', { b: isBAtom }, ['c'], stringAtom, () => 'e']}
      ></div>
    )

    mount(parent(), element)
    await wrap(sleep())
    expect(element.className).toBe('a b c d e')

    isBAtom.set(false)
    stringAtom.set('dd')
    await wrap(sleep())
    expect(element.className).toBe('a c dd e')
  }))

test('ref mount and unmount callbacks order', () =>
  context.start(async () => {
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
          <div ref={createRef(2)}></div>
        </div>
      </div>
    )

    mount(parent(), component)
    await wrap(sleep())
    parent().remove()
    await wrap(sleep())

    expect(order).toStrictEqual([2, 1, 0, 0, 1, 2])
  }))

test('batched removal unsubscribes shared pubs in reverse subscription order', () =>
  context.start(async () => {
    const order: string[] = []
    const shared = atom('shared', 'shared')
    const track = (name: string) =>
      computed(() => `${shared()} ${name}`, name).extend(
        withConnectHook(() => {
          order.push(`connect ${name}`)
          return () => order.push(`disconnect ${name}`)
        }),
      )

    const a = track('a')
    const b = track('b')
    const c = track('c')

    const element = <div />
    const { unmount } = mount(parent(), element)
    await wrap(sleep())
    element.append(<span id={a} />, <span id={b} />, <span id={c} />)
    await wrap(sleep())
    expect(order).toStrictEqual(['connect a', 'connect b', 'connect c'])

    element.replaceChildren()
    await wrap(sleep())
    expect(order).toStrictEqual([
      'connect a',
      'connect b',
      'connect c',
      'disconnect c',
      'disconnect b',
      'disconnect a',
    ])

    unmount()
  }))

test('style object update', () =>
  context.start(async () => {
    const styleTopAtom = atom<JSX.StyleProperties['top']>('0')
    const styleRightAtom = atom<JSX.StyleProperties['right']>(undefined)
    const styleBottomAtom = atom<JSX.StyleProperties['bottom']>(null)
    const styleLeftAtom = atom<JSX.StyleProperties['left']>('0')
    const styleAtom = computed<JSX.StyleProperties>(() => ({
      top: styleTopAtom(),
      right: styleRightAtom(),
      bottom: styleBottomAtom(),
      left: styleLeftAtom(),
    }))

    const firstEl = <div style={styleAtom}></div>
    const secondEl = (
      <div
        style:top={styleTopAtom}
        style:right={styleRightAtom}
        style:bottom={styleBottomAtom}
        style:left={styleLeftAtom}
      ></div>
    )

    const component = (
      <div>
        {firstEl}
        {secondEl}
      </div>
    )

    mount(parent(), component)

    await wrap(sleep())
    expect(firstEl.getAttribute('style')).toBe('top: 0px; left: 0px;')
    expect(secondEl.getAttribute('style')).toBe('top: 0px; left: 0px;')

    styleTopAtom.set(undefined)
    styleBottomAtom.set(0)

    await wrap(sleep())
    expect(firstEl.getAttribute('style')).toBe('left: 0px; bottom: 0px;')
    expect(secondEl.getAttribute('style')).toBe('left: 0px; bottom: 0px;')
  }))

test('style string value', () =>
  context.start(async () => {
    const styleAtom = atom<string | null>('background-color: red; top: 0px;')

    const element = <div style={styleAtom}></div>

    mount(parent(), element)

    await wrap(sleep())
    expect(element.getAttribute('style')).toBe(
      'background-color: red; top: 0px;',
    )

    styleAtom.set('color: blue;')
    await wrap(sleep())
    expect(element.getAttribute('style')).toBe('color: blue;')

    styleAtom.set(null)
    await wrap(sleep())
    expect(element.getAttribute('style')).toBeNull()
  }))

test('style object reset', () =>
  context.start(async () => {
    const styleAtom = atom<JSX.CSSProperties | null>({
      'background-color': 'red',
      top: '0px',
    })

    const element = <div style={styleAtom}></div>

    mount(parent(), element)

    await wrap(sleep())
    expect(element.getAttribute('style')).toBe(
      'background-color: red; top: 0px;',
    )

    styleAtom.set(null)
    await wrap(sleep())
    expect(element.getAttribute('style')).toBeNull()
  }))

test('render atom fragments', () =>
  context.start(async () => {
    const bool1Atom = atom(false)
    const bool2Atom = atom(false)

    const element = (
      <div>
        <p>0</p>
        {computed(
          () =>
            bool1Atom() ? (
              <>
                <p>1</p>
                {computed(
                  () =>
                    bool2Atom() ? (
                      <>
                        <p>2</p>
                        <p>3</p>
                      </>
                    ) : undefined,
                  '2',
                )}
                <p>4</p>
              </>
            ) : undefined,
          '1',
        )}
        <p>5</p>
      </div>
    )

    mount(parent(), element)

    await wrap(sleep())

    const expect1 = '<p>0</p><!--1--><!--1--><p>5</p>'
    const expect2 =
      '<p>0</p><!--1--><!----><p>1</p><!--2--><!--2--><p>4</p><!----><!--1--><p>5</p>'
    const expect3 =
      '<p>0</p><!--1--><!----><p>1</p><!--2--><!----><p>2</p><p>3</p><!----><!--2--><p>4</p><!----><!--1--><p>5</p>'

    bool1Atom.set(false)
    bool2Atom.set(false)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect1)

    bool1Atom.set(false)
    bool2Atom.set(true)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect1)

    bool1Atom.set(true)
    bool2Atom.set(false)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect2)

    bool1Atom.set(true)
    bool2Atom.set(true)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect3)

    bool1Atom.set(true)
    bool2Atom.set(false)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect2)

    bool1Atom.set(true)
    bool2Atom.set(true)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect3)

    bool1Atom.set(false)
    bool2Atom.set(true)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect1)

    bool1Atom.set(false)
    bool2Atom.set(false)
    await wrap(sleep())
    expect(stripJsxCompilerProps(element.innerHTML)).toBe(expect1)
  }))

test('Bind', () =>
  context.start(async () => {
    const div = instance(HTMLDivElement, <div />)
    const input = instance(HTMLInputElement, <input />)
    const svg = instance(SVGSVGElement, <svg:svg />)

    const inputState = atom('42')

    const testDiv = <Bind element={div} />
    const testInput = (
      <Bind
        element={input}
        value={inputState}
        on:input={(e) => inputState.set(e.currentTarget.value)}
      />
    )
    const testSvg = (
      <Bind element={svg}>
        <svg:path d="M 10 10 H 100" />
      </Bind>
    )

    mount(
      parent(),
      <main>
        {testDiv}
        {testInput}
        {testSvg}
      </main>,
    )

    await wrap(sleep())

    inputState.set('43')

    await wrap(sleep())
    expect(input.value).toBe('43')
    expect(stripJsxCompilerProps(testSvg.innerHTML)).toBe(
      '<path d="M 10 10 H 100"></path>',
    )
  }))

test('dynamic atom fragment', () =>
  context.start(async () => {
    const child = atom<JSX.HTMLAttributes['children']>(<span />, 'test')

    const container = <div>{child}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!--test--><span></span><!--test--></div>',
    )

    child.set(() => atom('child atom', 'test.child'))
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!--test-->child atom<!--test--></div>',
    )
  }))

test('atom child switching from primitive to element renders the element', () =>
  context.start(async () => {
    const child = atom<JSX.ElementChildren>('loading...', 'child')
    const element = <div>{child}</div>

    mount(parent(), element)
    await wrap(sleep())
    expect(element.textContent).toBe('loading...')

    // The primitive Text fast path must upgrade to the live-fragment path
    // when the atom state stops being a primitive.
    child.set((<span>done</span>) as unknown as JSX.ElementChildren)
    await wrap(sleep())
    expect(element.querySelector('span')?.textContent).toBe('done')
    expect(element.textContent).toBe('done')

    // And the fragment stays reactive for further updates.
    child.set('text again')
    await wrap(sleep())
    expect(element.textContent).toBe('text again')
  }))

const expectHtmlElementProperty = <
  Tag extends keyof JSX.HTMLElementTags,
  Property extends keyof JSX.HTMLElementTags[Tag],
  Value extends JSX.HTMLElementTags[Tag][Property],
  Expected extends Tag extends keyof HTMLElementTagNameMap
    ? Property extends keyof HTMLElementTagNameMap[Tag]
      ? HTMLElementTagNameMap[Tag][Property]
      : never
    : never,
>(
  tag: Tag,
  prop: Property & string,
  value: Value,
  expected: Expected,
  hasAttr: boolean,
  getAttr: null | string,
) => {
  const element = instance(HTMLElement, h(tag, { [prop]: value }))
  expect((element as any)[prop]).toBe(expected)
  expect(element.hasAttribute(prop.toLowerCase())).toBe(hasAttr)
  expect(element.getAttribute(prop.toLowerCase())).toBe(getAttr)
}

test('width property', () =>
  context.start(async () => {
    expectHtmlElementProperty('img', 'width', undefined, 0, false, null)
    expectHtmlElementProperty('img', 'width', null, 0, false, null)
    expectHtmlElementProperty('img', 'width', 1, 1, true, '1')
    expectHtmlElementProperty('img', 'width', '1', 1, true, '1')
    expectHtmlElementProperty('img', 'width', -1, 0, true, '-1')
  }))

test('height property', () =>
  context.start(async () => {
    expectHtmlElementProperty('img', 'height', undefined, 0, false, null)
    expectHtmlElementProperty('img', 'height', null, 0, false, null)
    expectHtmlElementProperty('img', 'height', 1, 1, true, '1')
    expectHtmlElementProperty('img', 'height', '1', 1, true, '1')
    expectHtmlElementProperty('img', 'height', -1, 0, true, '-1')
  }))

test('download property', () =>
  context.start(async () => {
    expectHtmlElementProperty('a', 'download', undefined, '', false, null)
    expectHtmlElementProperty('a', 'download', null, '', false, null)
    expectHtmlElementProperty('a', 'download', 'abc', 'abc', true, 'abc')
  }))

test('href property', () =>
  context.start(async () => {
    expectHtmlElementProperty('a', 'href', undefined, '', false, null)
    expectHtmlElementProperty('a', 'href', null, '', false, null)
    expectHtmlElementProperty(
      'a',
      'href',
      'https://test.com/',
      'https://test.com/',
      true,
      'https://test.com/',
    )
  }))

test('role property', () =>
  context.start(async () => {
    expectHtmlElementProperty('div', 'role', undefined, null, false, null)
    expectHtmlElementProperty('div', 'role', null, null, false, null)
    expectHtmlElementProperty('div', 'role', 'alert', 'alert', true, 'alert')
  }))

test('list property', () =>
  context.start(async () => {
    const element = instance(HTMLInputElement, <input list="list"></input>)
    const list = instance(HTMLDataListElement, <datalist id="list"></datalist>)
    mount(
      parent(),
      <div>
        {element}
        {list}
      </div>,
    )

    expect(element.list).toBe(list)
    expect(element.hasAttribute('list')).toBe(true)
    expect(element.getAttribute('list')).toBe('list')

    expectHtmlElementProperty('input', 'list', undefined, null, false, null)
    expectHtmlElementProperty('input', 'list', null, null, false, null)
  }))

test('form property', () =>
  context.start(async () => {
    const element = instance(HTMLInputElement, <input form="form"></input>)
    const form = instance(HTMLFormElement, <form id="form"></form>)
    mount(
      parent(),
      <div>
        {element}
        {form}
      </div>,
    )

    expect(element.form).toBe(form)
    expect(element.hasAttribute('form')).toBe(true)
    expect(element.getAttribute('form')).toBe('form')

    expectHtmlElementProperty('input', 'form', undefined, null, false, null)
    expectHtmlElementProperty('input', 'form', null, null, false, null)
  }))

// test('tabIndex property', () =>
//   context.start(async () => {
//     expectHtmlElementProperty('div', 'tabIndex', undefined, -1, false, null)
//     expectHtmlElementProperty('div', 'tabIndex', null, -1, false, null)
//     expectHtmlElementProperty('div', 'tabIndex', 0, 0, true, '0')
//     expectHtmlElementProperty('div', 'tabIndex', '0', 0, true, '0')
//   }))
// test('rowSpan property', () =>
//   context.start(async () => {
//     expectHtmlElementProperty('td', 'rowSpan', undefined, 1, false, null)
//     expectHtmlElementProperty('td', 'rowSpan', null, 1, false, null)
//     expectHtmlElementProperty('td', 'rowSpan', 0, 0, true, '0')
//     expectHtmlElementProperty('td', 'rowSpan', -1, 1, true, '-1')
//   }))
// test('colSpan property', () =>
//   context.start(async () => {
//     expectHtmlElementProperty('td', 'colSpan', undefined, 1, false, null)
//     expectHtmlElementProperty('td', 'colSpan', null, 1, false, null)
//     expectHtmlElementProperty('td', 'colSpan', 1, 1, true, '1')
//     expectHtmlElementProperty('td', 'colSpan', 0, 1, true, '0')
//   }))

test('aria attributes', () =>
  context.start(async () => {
    const expectAttribute = <
      Attr extends keyof JSX.AriaAttributes,
      Value extends JSX.AriaAttributes[Attr],
    >(
      attr: Attr,
      value: Value,
    ) => {
      const element = h('div', { [attr]: value })
      expect(element.hasAttribute(attr)).toBe(value != null)
      expect(element.getAttribute(attr)).toBe(value?.toString() ?? null)
    }

    expectAttribute('aria-checked', undefined)
    expectAttribute('aria-checked', null)
    expectAttribute('aria-checked', false)
    expectAttribute('aria-checked', true)
    expectAttribute('aria-checked', 'false')
    expectAttribute('aria-checked', 'true')
    expectAttribute('aria-colcount', 1)
    expectAttribute('aria-colcount', '1')
  }))

test('custom stylesheet for css property', () =>
  context.start(async () => {
    const sheet = new CSSStyleSheet()
    document.adoptedStyleSheets.push(sheet)
    stylesheet.set(sheet)

    const element = <div css="display:flex"></div>

    mount(parent(), element)
    await wrap(sleep())

    expect(stylesheet()).toEqual(sheet)
    expect(stylesheet().cssRules.length).toBe(1)
    expect(element.computedStyleMap().get('display')!.toString(), 'flex')
  }))

test('element subscribes to atom when mounted to DOM', () =>
  context.start(async () => {
    const valueAtom = atom('aaa')
    const element = <div class={valueAtom}></div>

    mount(parent(), element)
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(true)
    expect(element.className).toBe('aaa')

    valueAtom.set('bbb')
    await wrap(sleep())
    parent().append(element)
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(true)
    expect(element.className).toBe('bbb')
  }))

test('element unsubscribes from atom when removed from DOM', () =>
  context.start(async () => {
    const valueAtom = atom('aaa')
    const element = <div class={valueAtom}></div>

    await wrap(sleep())
    expect(isConnected(valueAtom)).toBe(false)
    expect(element.className).toBe('')

    mount(parent(), element)
    await wrap(sleep())
    element.remove()
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(false)
    expect(element.className).toBe('aaa')

    valueAtom.set('bbb')
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(false)
    expect(element.className).toBe('aaa')
  }))

test('model:field uses change and focus', () =>
  context.start(async () => {
    const field = reatomField('', {
      name: 'nameField',
      validateOnChange: true,
      validate: ({ value }) => (value.length < 3 ? 'too short' : undefined),
    })

    const input = instance(
      HTMLInputElement,
      <input model:field={field} attr:type="text" />,
    )

    mount(parent(), input)
    await wrap(sleep())

    expect(field.focus().touched).toBe(false)
    expect(input.value).toBe('')

    input.value = 'ab'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrap(sleep())

    expect(field()).toBe('ab')
    expect(input.value).toBe('ab')
    expect(field.validation().error).toBe('too short')

    input.dispatchEvent(new Event('focus', { bubbles: true }))
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    await wrap(sleep())

    expect(field.focus().touched).toBe(true)
    expect(field.elementRef()).toBe(input)
  }))

test('model:field binds checkbox checked', () =>
  context.start(async () => {
    const field = reatomField(false, 'agreeField')

    const input = instance(
      HTMLInputElement,
      <input model:field={field} attr:type="checkbox" />,
    )

    mount(parent(), input)
    await wrap(sleep())

    expect(input.checked).toBe(false)

    input.checked = true
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrap(sleep())

    expect(field()).toBe(true)
    expect(input.checked).toBe(true)
  }))

test('model:field inside a function child does not track the field value', () =>
  context.start(async () => {
    const field = reatomField('a', 'wrappedField')

    const container = (
      <div>{() => <input model:field={field} attr:type="text" />}</div>
    )
    mount(parent(), container)
    await wrap(sleep())
    const input = container.querySelector('input')!
    expect(input.value).toBe('a')

    // A tracked `field.value()` read in bindFieldModel would make the wrapper
    // computed depend on the value and recreate the input on every change.
    field.change('b')
    await wrap(sleep())
    expect(input.value).toBe('b')
    expect(container.querySelector('input')).toBe(input)
  }))

test('model:field composes with ref when ref comes after', () =>
  context.start(async () => {
    const field = reatomField('', 'nameField')
    let userRef: HTMLInputElement | null = null

    const input = instance(
      HTMLInputElement,
      <input
        model:field={field}
        ref={(el) => {
          userRef = el
          return () => {
            userRef = null
          }
        }}
        attr:type="text"
      />,
    )

    mount(parent(), input)
    await wrap(sleep())

    expect(field.elementRef()).toBe(input)
    expect(userRef).toBe(input)

    input.remove()
    await wrap(sleep())

    expect(field.elementRef()).toBe(undefined)
    expect(userRef).toBe(null)
  }))

test('model:field keeps working when undefined ref comes after', () =>
  context.start(async () => {
    const field = reatomField('', 'nameField')

    const input = instance(
      HTMLInputElement,
      <input model:field={field} ref={undefined} attr:type="text" />,
    )

    mount(parent(), input)
    await wrap(sleep())

    expect(field.elementRef()).toBe(input)

    input.remove()
    await wrap(sleep())

    expect(field.elementRef()).toBe(undefined)
  }))

test('model:field sets number type and uses valueAsNumber', () =>
  context.start(async () => {
    const field = reatomField(0, 'countField')

    const input = instance(HTMLInputElement, <input model:field={field} />)

    mount(parent(), input)
    await wrap(sleep())

    expect(input.type).toBe('number')
    expect(input.value).toBe('0')

    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await wrap(sleep())
    expect(field()).toBe(42)

    field.change(100)
    await wrap(sleep())
    expect(input.value).toBe('100')
  }))

test('model:field keeps text type for string field value', () =>
  context.start(async () => {
    const field = reatomField(0, {
      name: 'priceField',
      fromState: (state) => state.toFixed(2),
    })

    const input = instance(HTMLInputElement, <input model:field={field} />)

    mount(parent(), input)
    await wrap(sleep())

    expect(input.type).toBe('text')
    expect(input.value).toBe('0.00')
  }))

test('form model submits with preventDefault and state attrs', () =>
  context.start(async () => {
    let resolveSubmit!: () => void
    const submitStarted = vi.fn()
    const form = reatomForm(
      { email: 'user@example.com' },
      {
        name: 'testForm',
        onSubmit: async () => {
          submitStarted()
          await wrap(
            new Promise<void>((resolve) => {
              resolveSubmit = resolve
            }),
          )
        },
      },
    )

    const formElement = instance(
      HTMLFormElement,
      <form model={form}>
        <input model:field={form.fields.email} attr:type="email" />
        <button type="submit">Send</button>
      </form>,
    )

    mount(parent(), formElement)
    await wrap(sleep())

    expect(formElement.hasAttribute('data-submitting')).toBe(false)
    expect(formElement.classList.contains('is-submitting')).toBe(false)

    formElement.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
    await wrap(sleep())

    expect(submitStarted).toHaveBeenCalledOnce()
    expect(formElement.hasAttribute('data-submitting')).toBe(true)
    expect(formElement.classList.contains('is-submitting')).toBe(true)

    resolveSubmit()
    await wrap(sleep())

    expect(formElement.hasAttribute('data-submitting')).toBe(false)
    expect(formElement.hasAttribute('data-submitted')).toBe(true)
    expect(formElement.classList.contains('is-submitted')).toBe(true)
  }))

test('form model sets submit error attrs', () =>
  context.start(async () => {
    const form = reatomForm(
      { email: 'user@example.com' },
      {
        name: 'errorForm',
        onSubmit: async () => {
          throw new Error('fail')
        },
      },
    )

    const formElement = instance(HTMLFormElement, <form model={form} />)

    mount(parent(), formElement)
    await wrap(sleep())

    form.submit()
    await wrap(sleep())

    expect(formElement.hasAttribute('data-submit-error')).toBe(true)
    expect(formElement.classList.contains('has-submit-error')).toBe(true)
  }))

test('preserves atom and ref lifecycle when moved within DOM', () =>
  context.start(async () => {
    const valueAtom = atom('aaa')
    const mountRef = vi.fn()
    const unmountRef = vi.fn()
    const element = (
      <div
        class={valueAtom}
        ref={() => {
          mountRef()
          return unmountRef
        }}
      ></div>
    )

    mount(parent(), element)
    await wrap(sleep())
    expect(mountRef).toHaveBeenCalledOnce()

    parent().parentElement!.append(element)
    await wrap(sleep())
    valueAtom.set('bbb')
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(true)
    expect(element.className).toBe('bbb')
    expect(mountRef).toHaveBeenCalledOnce()
    expect(unmountRef).not.toHaveBeenCalled()

    element.remove()
    await wrap(sleep())
    expect(unmountRef).toHaveBeenCalledOnce()
  }))

test('mounts once when an element moves before observer delivery', () =>
  context.start(async () => {
    const mountRef = vi.fn()
    const element = <div ref={mountRef} />

    mount(parent(), element)
    parent().parentElement!.append(element)
    await wrap(sleep())

    expect(mountRef).toHaveBeenCalledOnce()
  }))

test('skips lifecycle for a node appended and removed in the same tick', () =>
  context.start(async () => {
    const mountRef = vi.fn()
    const unmountRef = vi.fn()
    const value = atom('aaa', 'value')
    const inner = (
      <span
        id={value}
        ref={() => {
          mountRef()
          return unmountRef
        }}
      />
    )
    const element = <div />

    mount(parent(), element)
    await wrap(sleep())

    element.append(inner)
    inner.remove()
    await wrap(sleep())

    // The node never really appeared: no subscription churn, no orphan ref
    // mount without a matching unmount.
    expect(mountRef).not.toHaveBeenCalled()
    expect(unmountRef).not.toHaveBeenCalled()
    expect(isConnected(value)).toBe(false)

    // The untouched node connects normally on a later append.
    element.append(inner)
    await wrap(sleep())
    expect(mountRef).toHaveBeenCalledOnce()
    expect(isConnected(value)).toBe(true)
  }))

test('atom child renders synchronously at build time', () =>
  context.start(async () => {
    const val = atom('eager', 'val')
    const element = <div>{val}</div>

    expect(element.textContent).toBe('eager')

    mount(parent(), element)
    await wrap(sleep())
    expect(element.textContent).toBe('eager')
  }))

test('nested atom children render synchronously at build time', () =>
  context.start(async () => {
    const leaf = atom('leaf', 'leaf')
    const middle = computed(() => <span>middle {leaf}</span>, 'middle')
    const top = computed(() => <div>top {middle}</div>, 'top')
    const element = <section>{top}</section>

    expect(element.textContent).toBe('top middle leaf')

    mount(parent(), element)
    await wrap(sleep())
    expect(element.textContent).toBe('top middle leaf')

    leaf.set('leaf!')
    await wrap(sleep())
    expect(element.textContent).toBe('top middle leaf!')
  }))

test('eagerly rendered atom child stays reactive after mount', () =>
  context.start(async () => {
    const val = atom('a', 'val')
    const element = <div>{val}</div>

    expect(element.textContent).toBe('a')

    mount(parent(), element)
    await wrap(sleep())

    val.set('b')
    await wrap(sleep())
    expect(element.textContent).toBe('b')
  }))

test('siblings connect when an earlier atom child changed before mount', () =>
  context.start(async () => {
    const first = atom<JSX.ElementChildren>(
      (<i>a</i>) as unknown as JSX.ElementChildren,
      'first',
    )
    const second = atom('x', 'second')
    const element = (
      <div>
        {first}
        <span>{second}</span>
      </div>
    )

    // Change the fragment state between build and mount: the subscription
    // connected during the mount walk emits synchronously and rewrites the
    // fragment content mid-walk. The walk must keep visiting the replacement
    // content and the following siblings.
    first.set((<b>b</b>) as unknown as JSX.ElementChildren)

    mount(parent(), element)
    await wrap(sleep())
    expect(element.querySelector('b')?.textContent).toBe('b')
    expect(element.querySelector('i')).toBe(null)

    second.set('y')
    await wrap(sleep())
    expect(element.textContent).toBe('by')
  }))

test('siblings connect when a primitive atom child upgraded before mount', () =>
  context.start(async () => {
    const first = atom<JSX.ElementChildren>('a', 'first')
    const second = atom('x', 'second')
    const element = (
      <div>
        {first}
        <span>{second}</span>
      </div>
    )

    // The primitive Text fast path upgrades via `replaceWith` when its state
    // stops being primitive, removing the very node the mount walk is
    // visiting. The walk must continue into the replacement fragment and the
    // following siblings.
    first.set((<b>b</b>) as unknown as JSX.ElementChildren)

    mount(parent(), element)
    await wrap(sleep())
    expect(element.querySelector('b')?.textContent).toBe('b')

    second.set('y')
    await wrap(sleep())
    expect(element.textContent).toBe('by')
  }))

test('atom child teardown drops reconnect after remove', () =>
  context.start(async () => {
    const val = atom('same', 'val')
    const element = <div>{val}</div>

    mount(parent(), element)
    await wrap(sleep())
    expect(element.textContent).toBe('same')

    element.remove()
    await wrap(sleep())
    parent().append(element)
    await wrap(sleep())
    expect(element.textContent).toBe('same')

    // Detach clears meta.subscribes so re-appended nodes stay inert —
    // recreate the element (or keep it inside a live parent) instead.
    val.set('updated')
    await wrap(sleep())
    expect(element.textContent).toBe('same')
  }))

test('atom child does not rebind after disconnect teardown', () =>
  context.start(async () => {
    const val = atom('before', 'val')
    const element = <div>{val}</div>

    mount(parent(), element)
    await wrap(sleep())
    expect(element.textContent).toBe('before')

    element.remove()
    await wrap(sleep())
    val.set('after')
    await wrap(sleep())
    expect(element.textContent).toBe('before')

    parent().append(element)
    await wrap(sleep())
    expect(element.textContent).toBe('before')
  }))

test('initial atom children cause no live insertions after mount', () =>
  context.start(async () => {
    const leaf = atom('leaf', 'leaf')
    const top = computed(() => <div>top {leaf}</div>, 'top')
    const element = <section>{top}</section>

    const target = parent()
    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    )
    observer.observe(target, { childList: true, subtree: true })

    mount(target, element)
    await wrap(sleep())

    mutations.push(...observer.takeRecords())
    observer.disconnect()

    const addedNodes = mutations.flatMap((mutation) => [...mutation.addedNodes])
    expect(addedNodes).toStrictEqual([element])
    expect(element.textContent).toBe('top leaf')
  }))

/**
 * @todo `second.subscribe` is called twice with the same DocumentFragment so
 *   the second time the children are deleted.
 */
test.skip('fragment as child in double atom', () =>
  context.start(async () => {
    const first = computed(() => <div>{second}</div>, 'first')
    const second = computed(() => <>test</>, 'second')
    const element = <div>{first}</div>

    mount(parent(), element)
    await wrap(sleep())

    expect(stripJsxCompilerProps(element.innerHTML)).toBe(
      '<!--first--><p><!--second--><!---->test<!----><!--second--></p><!--first-->',
    )
  }))
