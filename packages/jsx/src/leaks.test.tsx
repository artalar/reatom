import {
  atom,
  clearStack,
  context,
  type Fn,
  isConnected,
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
