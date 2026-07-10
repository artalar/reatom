import { atom, context, isConnected, sleep, wrap } from '@reatom/core'
import { expect, test } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { h, instance, mount } from '.'

const parent = atom(() => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)

  return main
}, 'parent')

test('mount returns unmount function that removes element from DOM', () =>
  context.start(async () => {
    const element = <div>Hello</div>

    const { unmount } = mount(parent(), element)
    await wrap(sleep())

    expect(parent().contains(element)).toBe(true)

    unmount()
    expect(parent().contains(element)).toBe(false)
  }))

test('unmount function disconnects atom subscriptions', () =>
  context.start(async () => {
    const valueAtom = atom('aaa')
    const element = <div class={valueAtom}></div>

    const { unmount } = mount(parent(), element)
    await wrap(sleep())

    expect(isConnected(valueAtom)).toBe(true)
    expect(element.className).toBe('aaa')

    unmount()

    expect(isConnected(valueAtom)).toBe(false)

    valueAtom.set('bbb')
    await wrap(sleep())

    expect(element.className).toBe('aaa')
  }))

test('unmount function calls ref unmount callbacks', () =>
  context.start(async () => {
    let mountedRef: HTMLElement | null = null
    let unmountedRef: HTMLElement | null = null

    const element = (
      <div
        ref={(el) => {
          mountedRef = el
          return () => {
            unmountedRef = el
          }
        }}
      />
    )

    const { unmount } = mount(parent(), element)
    await wrap(sleep())

    expect(mountedRef).toBe(element)
    expect(unmountedRef).toBe(null)

    unmount()

    expect(unmountedRef).toBe(element)
  }))

test('unmount cleanup order matches automatic removal order', () =>
  context.start(async () => {
    const manualOrder: number[] = []
    const automaticOrder: number[] = []

    const createRef = (index: number, order: number[]) => {
      return () => {
        return () => {
          order.push(index)
        }
      }
    }

    const manualComponent = (
      <div ref={createRef(0, manualOrder)}>
        <div ref={createRef(1, manualOrder)}>
          <div ref={createRef(2, manualOrder)}></div>
        </div>
      </div>
    )

    const automaticComponent = (
      <div ref={createRef(0, automaticOrder)}>
        <div ref={createRef(1, automaticOrder)}>
          <div ref={createRef(2, automaticOrder)}></div>
        </div>
      </div>
    )

    const { unmount } = mount(parent(), manualComponent)
    mount(parent(), automaticComponent)
    await wrap(sleep())

    unmount()
    automaticComponent.remove()
    await wrap(sleep())

    expect(manualOrder).toStrictEqual(automaticOrder)
  }))
