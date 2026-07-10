import {
  atom,
  clearStack,
  computed,
  context,
  isConnected,
  reatomLinkedList,
  sleep,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { DEBUG, h, hf, instance, mount } from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const parent = atom(() => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)

  return main
}, 'parent')

const stripJsxCompilerProps = (value: string) =>
  value.replaceAll(/\s__(?:self|source)="[^"]*"/g, '')

test('linked list', () =>
  context.start(async () => {
    const list = reatomLinkedList((value: any) => atom(value))
    const jsxList = list.reatomMap((n) => <span>{n}</span>)
    const one = list.create(1)
    const two = list.create(2)

    mount(parent(), <div>{jsxList}</div>)

    await wrap(sleep())
    expect(parent().innerText).toBe('12')
    expect(isConnected(list)).toBe(true)
    expect(isConnected(jsxList)).toBe(true)
    expect(isConnected(one)).toBe(true)
    expect(isConnected(two)).toBe(true)
    expect(list.array()).toEqual([one, two])

    list.swap(one, two)
    await wrap(sleep())
    expect(list.array()).toEqual([two, one])
    expect(parent().innerText).toBe('21')

    list.remove(two)
    await wrap(sleep())
    expect(parent().innerText).toBe('1')
    expect(isConnected(one)).toBe(true)
    expect(isConnected(two)).toBe(false)

    list.create(<>3</>)
  }))

test('linked list with fragment', () =>
  context.start(async () => {
    const a = atom(true)
    const list = reatomLinkedList((value: string) => (
      <>
        <span>{value}</span>
        {computed(() => (a() ? <a /> : <br />), 'test')}
      </>
    ))
    list.create('1')

    const container = <div>{list}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!----><span>1</span><!--test--><a></a><!--test--><!----></div>',
    )

    a.set(false)
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!----><span>1</span><!--test--><br><!--test--><!----></div>',
    )

    const node = list.create('2')
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!----><span>1</span><!--test--><br><!--test--><!----><!----><span>2</span><!--test--><br><!--test--><!----></div>',
    )

    list.remove(node)
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.outerHTML)).toBe(
      '<div><!----><span>1</span><!--test--><br><!--test--><!----></div>',
    )
  }))

test('linked list createMany', () =>
  context.start(async () => {
    const list = reatomLinkedList((value: number) => <span>{value}</span>)

    const container = <div>{list}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe('')

    const nodes = list.createMany([[1], [2], [3]])
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>1</span><span>2</span><span>3</span>',
    )
    expect(list.array()).toEqual(nodes)

    list.createMany([[4], [5]])
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>',
    )
  }))

test('linked list move to head', () =>
  context.start(async () => {
    const list = reatomLinkedList((value: number) => <span>{value}</span>)
    const nodes = list.createMany([[1], [2], [3]])
    const [one, two, three] = nodes

    if (!one || !two || !three) {
      throw new Error('Expected linked list nodes to be created')
    }

    const container = <div>{list}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>1</span><span>2</span><span>3</span>',
    )

    list.move(three, null)
    await wrap(sleep())
    expect(list.array()).toEqual([three, one, two])
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>3</span><span>1</span><span>2</span>',
    )

    list.move(one, two)
    await wrap(sleep())
    expect(list.array()).toEqual([three, two, one])
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>3</span><span>2</span><span>1</span>',
    )
  }))

test('linked list removeMany', () =>
  context.start(async () => {
    const list = reatomLinkedList((value: number) => <span>{value}</span>)
    const [one, two, three, four] = list.createMany([[1], [2], [3], [4]])

    const container = <div>{list}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>1</span><span>2</span><span>3</span><span>4</span>',
    )

    list.removeMany([two!, four!])
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe(
      '<span>1</span><span>3</span>',
    )

    list.removeMany([one!, three!])
    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe('')
  }))

test('linked list createMany and removeMany with reatomMap', () =>
  context.start(async () => {
    const list = reatomLinkedList((value: number) => atom(value))
    const jsxList = list.reatomMap((n) => <span>{n}</span>)

    const container = <div>{jsxList}</div>
    mount(parent(), container)

    await wrap(sleep())
    expect(stripJsxCompilerProps(container.innerHTML)).toBe('')
    expect(isConnected(list)).toBe(true)
    expect(isConnected(jsxList)).toBe(true)

    const nodes = list.createMany([[1], [2], [3]])
    await wrap(sleep())
    expect(parent().innerText).toBe('123')
    expect(list.array()).toEqual(nodes)

    list.removeMany([nodes[0]!, nodes[2]!])
    await wrap(sleep())
    expect(parent().innerText).toBe('2')
    expect(list.array()).toEqual([nodes[1]])
  }))
