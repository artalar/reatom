import {
  addCallHook,
  atom,
  clearStack,
  computed,
  context,
  sleep,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test, vi } from 'vitest'

import {
  DEBUG,
  ErrorBoundary,
  // eslint-disable-next-line unused-imports/no-unused-imports
  h,
  jsxError,
  type JsxErrorPayload,
  mount,
} from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const parent = atom(() => {
  const main = document.createElement('main')
  document.body.appendChild(main)
  return main
}, 'parent')

test('hybrid default: keeps stale DOM, reports jsxError, sets data-reatom-error', () =>
  context.start(async () => {
    const reports: JsxErrorPayload[] = []
    const unhook = addCallHook(jsxError, (payload) => {
      reports.push(payload)
    })

    const flag = atom(false, 'flag')
    const view = computed(() => {
      if (flag()) throw new Error('boom')
      return 'ok'
    }, 'view')

    const element = <div>{view}</div>
    const { unmount } = mount(parent(), element)
    await wrap(sleep())

    expect(element.textContent).toBe('ok')
    expect(reports).toEqual([])

    flag.set(true)
    await wrap(sleep())

    expect(element.textContent).toBe('ok')
    expect(element.hasAttribute('data-reatom-error')).toBe(true)
    expect(reports).toHaveLength(1)
    expect(reports[0]!.phase).toBe('children')
    expect((reports[0]!.error as Error).message).toBe('boom')

    flag.set(false)
    await wrap(sleep())

    expect(element.textContent).toBe('ok')
    expect(element.hasAttribute('data-reatom-error')).toBe(false)

    unhook()
    unmount()
  }))

test('ErrorBoundary catches lazy child construction error and supports retry', () =>
  context.start(async () => {
    const shouldThrow = atom(true, 'shouldThrow')
    const onError = vi.fn()

    const element = (
      <ErrorBoundary
        fallback={(error, retry) => (
          <div id="fallback">
            {(error as Error).message}
            <button id="retry" on:click={retry}>
              retry
            </button>
          </div>
        )}
        onError={onError}
      >
        {() => {
          if (shouldThrow()) throw new Error('construct')
          return <span id="ok">ok</span>
        }}
      </ErrorBoundary>
    )

    const host = <div>{element}</div>
    const { unmount } = mount(parent(), host)
    await wrap(sleep())

    expect(element.nodeName).toBe('SPAN')
    expect(element.style.display).toBe('contents')
    expect(host.querySelector('#fallback')?.textContent).toContain('construct')
    expect(host.querySelector('#ok')).toBeNull()
    expect(onError).toHaveBeenCalledTimes(1)

    shouldThrow.set(false)
    host.querySelector('#retry')!.dispatchEvent(new Event('click'))
    await wrap(sleep())

    expect(host.querySelector('#ok')?.textContent).toBe('ok')
    expect(host.querySelector('#fallback')).toBeNull()

    unmount()
  }))

test('ErrorBoundary catches reactive child update errors', () =>
  context.start(async () => {
    const flag = atom(false, 'flag')
    const view = computed(() => {
      if (flag()) throw new Error('update')
      return <span id="ok">ok</span>
    }, 'view')

    const host = (
      <div>
        <ErrorBoundary
          fallback={(error) => (
            <div id="fallback">{(error as Error).message}</div>
          )}
        >
          {() => <div>{view}</div>}
        </ErrorBoundary>
      </div>
    )

    const { unmount } = mount(parent(), host)
    await wrap(sleep())
    expect(host.querySelector('#ok')?.textContent).toBe('ok')

    flag.set(true)
    await wrap(sleep())

    expect(host.querySelector('#fallback')?.textContent).toBe('update')
    expect(host.querySelector('#ok')).toBeNull()

    unmount()
  }))

test('ErrorBoundary pending fallback recovers when promise settles', () =>
  context.start(async () => {
    let resolve!: (value: string) => void
    const promise = new Promise<string>((res) => {
      resolve = res
    })
    const ready = atom(false, 'ready')
    const view = computed(() => {
      if (!ready()) throw promise
      return <span id="ok">done</span>
    }, 'view')

    const host = (
      <div>
        <ErrorBoundary
          pending={<div id="pending">loading</div>}
          fallback={() => <div id="fallback">err</div>}
        >
          {() => <div>{view}</div>}
        </ErrorBoundary>
      </div>
    )

    const { unmount } = mount(parent(), host)
    await wrap(sleep())
    expect(host.querySelector('#pending')?.textContent).toBe('loading')

    ready.set(true)
    resolve('x')
    await wrap(sleep())
    await wrap(sleep())

    expect(host.querySelector('#ok')?.textContent).toBe('done')
    expect(host.querySelector('#pending')).toBeNull()

    unmount()
  }))

test('reparented child is adopted by the new ErrorBoundary', () =>
  context.start(async () => {
    const flag = atom(false, 'flag')
    const view = computed(() => {
      if (flag()) throw new Error('moved')
      return <span id="child">child</span>
    }, 'view')

    const childHost = <div id="child-host">{view}</div>

    const boundaryB = (
      <ErrorBoundary fallback={() => <div id="fallback-b">B</div>}>
        {() => <div id="slot-b" />}
      </ErrorBoundary>
    )

    const root = (
      <div>
        {childHost}
        <div id="wrap-b">{boundaryB}</div>
      </div>
    )

    const { unmount } = mount(parent(), root)
    await wrap(sleep())

    const slotB = root.querySelector('#slot-b')!
    slotB.append(childHost)

    flag.set(true)
    await wrap(sleep())

    expect(root.querySelector('#fallback-b')?.textContent).toBe('B')

    unmount()
  }))

test('on: handler reports to jsxError and rethrows', () =>
  context.start(async () => {
    const reports: JsxErrorPayload[] = []
    const unhook = addCallHook(jsxError, (payload) => {
      reports.push(payload)
    })

    const button = (
      <button
        on:click={() => {
          throw new Error('click')
        }}
      >
        go
      </button>
    )

    const { unmount } = mount(parent(), button)
    await wrap(sleep())

    // Browsers do not surface listener throws to dispatchEvent; they become
    // window errors. We still rethrow inside the listener after reporting.
    const windowErrors: unknown[] = []
    const onWindowError = (event: ErrorEvent) => {
      windowErrors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onWindowError)
    button.dispatchEvent(new Event('click'))
    window.removeEventListener('error', onWindowError)
    await wrap(sleep())

    expect(reports).toHaveLength(1)
    expect(reports[0]!.phase).toBe('event')
    expect((reports[0]!.error as Error).message).toBe('click')
    expect(windowErrors).toHaveLength(1)

    unhook()
    unmount()
  }))

test('throwing ref mount does not break sibling subscriptions', () =>
  context.start(async () => {
    const value = atom('a', 'value')
    const sibling = <span id="sibling">{value}</span>
    const broken = (
      <div
        id="broken"
        ref={() => {
          throw new Error('ref')
        }}
      />
    )

    const host = (
      <div>
        {broken}
        {sibling}
      </div>
    )

    const reports: JsxErrorPayload[] = []
    const unhook = addCallHook(jsxError, (payload) => {
      reports.push(payload)
    })

    const { unmount } = mount(parent(), host)
    await wrap(sleep())

    expect(reports.some((r) => r.phase === 'ref')).toBe(true)
    expect(sibling.textContent).toBe('a')

    value.set('b')
    await wrap(sleep())
    expect(sibling.textContent).toBe('b')

    unhook()
    unmount()
  }))

test('reactive prop error keeps last good value and reports', () =>
  context.start(async () => {
    const flag = atom(false, 'flag')
    const id = computed(() => {
      if (flag()) throw new Error('prop')
      return 'ok-id'
    }, 'id')

    const reports: JsxErrorPayload[] = []
    const unhook = addCallHook(jsxError, (payload) => {
      reports.push(payload)
    })

    const element = <div id={id} />
    const { unmount } = mount(parent(), element)
    await wrap(sleep())
    expect(element.id).toBe('ok-id')

    flag.set(true)
    await wrap(sleep())

    expect(element.id).toBe('ok-id')
    expect(reports.some((r) => r.phase === 'prop')).toBe(true)
    expect(element.hasAttribute('data-reatom-error')).toBe(true)

    flag.set(false)
    await wrap(sleep())

    expect(element.id).toBe('ok-id')
    expect(element.hasAttribute('data-reatom-error')).toBe(false)

    unhook()
    unmount()
  }))
