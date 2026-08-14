import { expect, test, vi } from 'test'

import { sleep, wrap } from '..'
import { atom, computed, EXTENSIONS, notify, withActions } from '../core'
import { connectLogger, log } from './connectLogger'
import { getStackTrace } from './getStackTrace'

// prevent tests flickering
let normalizeFrameIds = (stack: string) => {
  let nextId = 1
  let idMap = new Map<string, number>()
  return stack.replace(/\[#(\d+)\]/g, (_, raw) => {
    let mapped = idMap.get(raw)
    if (mapped === undefined) idMap.set(raw, (mapped = nextId++))
    return `[#${mapped}]`
  })
}

test('calc deps graph', async () => {
  const counter = atom(0, 'counter').extend(
    withActions((target) => ({
      inc: () => target.set((s) => s + 1),
    })),
  )
  const doubled = computed(() => counter() * 2, 'doubled')
  const isEven = computed(() => counter() % 2 === 0, 'isEven')

  let stack = ''
  computed(() => {
    ;`Count: ${counter()}, Doubled: ${doubled()}, Is Even: ${isEven()}`
    stack = normalizeFrameIds(getStackTrace())
  }, 'effect').subscribe()

  // prettier-ignore
  expect(stack).toBe(
    `
─effect[#1]
 ├─ counter[#2]
 ├─ doubled[#3]
 │  └─ counter[#2]
 └─ isEven[#4]
    └─ counter[#2]`.slice(1),
  )

  counter.inc()
  await wrap(sleep())

  // prettier-ignore
  expect(stack).toBe(
`
─effect[#1]
 ├─ counter[#2]
 │  └─ counter.inc[#3]
 ├─ doubled[#4]
 │  └─ counter[#2]
 └─ isEven[#5]
    └─ counter[#2]`.slice(1),
)
})

test('BFS log simplification', () => {
  const a = atom(0, 'a')
  const b = computed(() => a(), 'b')
  const c = computed(() => b(), 'c')
  const d = computed(() => b() + c(), 'd')

  let stack = ''
  computed(() => {
    d()
    stack = normalizeFrameIds(getStackTrace())
  }, 'effect').subscribe()

  a.set(1)
  notify()

  // prettier-ignore
  expect(stack).toBe(
    // there should be NO ` ─ a` after the second `b`
    `
─effect[#1]
 └─ d[#2]
    ├─ b[#3]
    │  └─ a[#4]
    └─ c[#5]
       └─ b[#3]`.slice(1),
  )
})

test('connectLogger match', () => {
  const consoleSpy = vi
    .spyOn(console, 'groupCollapsed')
    .mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})

  connectLogger({
    match: (name) => name === 'allowed',
  })

  const allowed = atom(0, 'allowed')
  const blocked = atom(0, 'blocked')

  // remove the logger middleware to not interact with other tests
  EXTENSIONS.pop()

  allowed.subscribe(() => {})
  blocked.subscribe(() => {})

  allowed.set(1)
  blocked.set(1)
  notify()

  const logs = (consoleSpy.mock.calls as unknown[][]).map((call) => call[0])
  expect(logs.some((log) => String(log).includes('allowed'))).toBe(true)
  expect(logs.some((log) => String(log).includes('blocked'))).toBe(false)

  vi.restoreAllMocks()
})

test('log.state logs only when data changes', () => {
  vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  connectLogger()
  // remove the logger middleware to not interact with other tests
  EXTENSIONS.pop()
  log('test')
  notify()
  consoleSpy.mockClear()

  log.state('testKey', 1)
  notify()
  // one for the timestamp and one for the log
  expect(consoleSpy).toHaveBeenCalledTimes(1)

  log.state('testKey', 1)
  notify()
  expect(consoleSpy).toHaveBeenCalledTimes(1)

  log.state('testKey', 2)
  notify()
  expect(consoleSpy).toHaveBeenCalledTimes(2)

  log.state('testKey', 2)
  notify()
  expect(consoleSpy).toHaveBeenCalledTimes(2)

  log.state('differentKey', { value: 1 })
  notify()
  expect(consoleSpy).toHaveBeenCalledTimes(3)

  vi.restoreAllMocks()
})

test('log.label uses the label as the logger title', () => {
  const groupSpy = vi
    .spyOn(console, 'groupCollapsed')
    .mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  connectLogger()
  // remove the logger middleware to not interact with other tests
  EXTENSIONS.pop()

  const payload = { ok: true }
  const result = log.label('fetch payload', payload, 42)
  notify()

  expect(result).toEqual([payload, 42])

  const titles = (groupSpy.mock.calls as unknown[][]).map((call) => call[0])
  expect(titles.some((title) => String(title).includes('fetch payload'))).toBe(
    true,
  )
  expect(titles.some((title) => String(title).includes('LOG.label'))).toBe(
    false,
  )
  expect(
    (consoleSpy.mock.calls as unknown[][]).some((call) => call[0] === payload),
  ).toBe(true)

  vi.restoreAllMocks()
})

test('log.label formats the group title in the browser', () => {
  const globals = globalThis as typeof globalThis & {
    window?: object
    document?: object
  }
  const hadWindow = 'window' in globals
  const hadDocument = 'document' in globals
  const prevWindow = globals.window
  const prevDocument = globals.document
  globals.window = prevWindow ?? {}
  globals.document = prevDocument ?? {}

  const groupSpy = vi
    .spyOn(console, 'groupCollapsed')
    .mockImplementation(() => {})
  vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})

  connectLogger()
  EXTENSIONS.pop()

  log.label('fetch payload', 1)
  notify()

  const labelCall = (groupSpy.mock.calls as unknown[][]).find(
    (call) => call[0] === '%c%s' && String(call[2]).includes('fetch payload'),
  )
  expect(labelCall).toBeTruthy()
  expect(String(labelCall?.[1]).includes('background:')).toBe(true)
  expect(String(labelCall?.[2]).includes('LOG.label')).toBe(false)

  vi.restoreAllMocks()
  if (hadWindow) globals.window = prevWindow
  else Reflect.deleteProperty(globals, 'window')
  if (hadDocument) globals.document = prevDocument
  else Reflect.deleteProperty(globals, 'document')
})
