import {
  atom,
  clearStack,
  context,
  type Fn,
  isConnected,
  reatomLinkedList,
  sleep,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test, vi } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { DEBUG, h, hf, instance, type JSX, mount } from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const createContainer = () => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)
  return main
}

test('$spread update disconnects atoms from the previous spread record', () =>
  context.start(async () => {
    const firstClass = atom('first', 'firstClass')
    const secondClass = atom('second', 'secondClass')
    const spread = atom({ class: firstClass }, 'spread')

    const element = <div $spread={spread} />

    mount(createContainer(), element)
    await wrap(sleep())
    expect(element.className).toBe('first')
    expect(isConnected(firstClass)).toBe(true)

    spread.set({ class: secondClass })
    await wrap(sleep())
    expect(element.className).toBe('second')
    expect(isConnected(secondClass)).toBe(true)

    expect(isConnected(firstClass)).toBe(false)
  }))

test('$spread update does not accumulate event listeners', () =>
  context.start(async () => {
    const handler = vi.fn()
    const spread = atom({ 'on:click': handler as Fn }, 'spread')

    const element = <div $spread={spread} />

    mount(createContainer(), element)
    await wrap(sleep())

    spread.set({ 'on:click': handler })
    await wrap(sleep())

    element.dispatchEvent(new MouseEvent('click'))
    expect(handler).toHaveBeenCalledTimes(1)
  }))

test('unmount cleans up nodes removed in the same tick', () =>
  context.start(async () => {
    const value = atom('aaa', 'value')

    const inner = instance(HTMLElement, (<span id={value} />) as any)
    const element = <div>{inner}</div>

    const { unmount } = mount(createContainer(), element)
    await wrap(sleep())
    expect(isConnected(value)).toBe(true)

    inner.remove()
    unmount()
    await wrap(sleep())

    expect(isConnected(value)).toBe(false)
  }))

test('atom child update after detach does not leak replaced content subscriptions', () =>
  context.start(async () => {
    const innerValue = atom('aaa', 'innerValue')
    const outer = atom<JSX.Element>(
      (<span id={innerValue} />) as unknown as JSX.Element,
      'outer',
    )

    const element = <div>{outer}</div>

    mount(createContainer(), element)
    await wrap(sleep())
    expect(isConnected(innerValue)).toBe(true)
    expect(isConnected(outer)).toBe(true)

    element.remove()
    outer.set((<b />) as unknown as JSX.Element)
    await wrap(sleep())
    await wrap(sleep())

    expect(isConnected(outer)).toBe(false)
    expect(isConnected(innerValue)).toBe(false)
  }))

test('TEXT atom child disconnects when parent element removed', () =>
  context.start(async () => {
    const label = atom('hello', 'label')
    const row = (
      <tr>
        <td>
          <a>{label}</a>
        </td>
      </tr>
    )

    const container = <tbody>{row}</tbody>
    mount(createContainer(), container)
    await wrap(sleep())

    expect(isConnected(label)).toBe(true)
    const a = container.querySelector('a')!
    expect(a.firstChild?.nodeType).toBe(3)

    row.remove()
    await wrap(sleep())

    expect(isConnected(label)).toBe(false)
  }))

test('TEXT atom child disconnects on linked-list clear', () =>
  context.start(async () => {
    const list = reatomLinkedList(
      (id: number, label: string) => ({
        id,
        label: atom(label, ''),
      }),
      'list',
    )
    const jsxList = list.reatomMap(
      (row) => (
        <tr>
          <td>{row.label}</td>
        </tr>
      ),
      'views',
    )

    const container = <tbody>{jsxList}</tbody>
    mount(createContainer(), container)
    await wrap(sleep())

    const nodes = list.createMany([
      [1, 'a'],
      [2, 'b'],
      [3, 'c'],
    ])
    await wrap(sleep())

    for (const n of nodes) {
      expect(isConnected(n.label)).toBe(true)
    }
    expect(container.querySelectorAll('tr').length).toBe(3)
    const td = container.querySelector('td')!
    expect(td.childNodes.length).toBe(1)
    expect(td.firstChild?.nodeType).toBe(3)

    list.clear()
    await wrap(sleep())
    await wrap(sleep())

    expect(container.querySelectorAll('tr').length).toBe(0)
    for (const n of nodes) {
      expect(isConnected(n.label)).toBe(false)
    }
  }))

test('linked-list clear drops element meta.subscribes (no render-frame pin)', () =>
  context.start(async () => {
    const list = reatomLinkedList(
      (id: number, label: string) => ({
        id,
        label: atom(label, ''),
        selected: atom(false, ''),
      }),
      'list',
    )
    const jsxList = list.reatomMap(
      (row) => (
        <tr class={() => (row.selected() ? 'danger' : undefined)}>
          <td>
            <a on:click={() => row.selected.set(true)}>{row.label}</a>
          </td>
        </tr>
      ),
      'views',
    )

    const container = <tbody>{jsxList}</tbody>
    mount(createContainer(), container)
    await wrap(sleep())

    list.createMany([
      [1, 'a'],
      [2, 'b'],
    ])
    await wrap(sleep())

    const row = container.querySelector('tr') as any
    expect(row).toBeTruthy()
    const metaKey = Object.getOwnPropertySymbols(row).find((s) => {
      const m = row[s]
      return m && Array.isArray(m.subscribes) && Array.isArray(m.unsubscribes)
    })!
    expect(row[metaKey].subscribes.length).toBeGreaterThan(0)
    expect(row[metaKey].unsubscribes.length).toBeGreaterThan(0)

    list.clear()
    await wrap(sleep())
    await wrap(sleep())

    // Teardown must clear both live unsubscribes and reconnect thunks so
    // bind()/render closures cannot pin a reatomMap frame state after clear.
    expect(row[metaKey].unsubscribes).toEqual([])
    expect(row[metaKey].subscribes).toEqual([])
  }))
