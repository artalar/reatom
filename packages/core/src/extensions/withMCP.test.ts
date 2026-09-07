import { expect, test, vi } from 'test'

import { action, atom } from '../core'
import type {
  MCPModelContext,
  MCPModelContextClient,
  MCPModelContextTool,
} from './withMCP'
import { withMCP } from './withMCP'

const client: MCPModelContextClient = {
  requestUserInteraction: async (callback) => await callback(),
}

const createModelContext = () => {
  const tools = new Map<string, MCPModelContextTool>()

  const modelContext: MCPModelContext = {
    provideContext(options = {}) {
      tools.clear()
      for (const tool of options.tools ?? []) {
        tools.set(tool.name, tool)
      }
    },
    registerTool(tool) {
      if (tools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered`)
      }
      tools.set(tool.name, tool)
    },
    unregisterTool(name) {
      tools.delete(name)
    },
  }

  return {
    modelContext,
    tools,
    registerToolSpy: vi.spyOn(modelContext, 'registerTool'),
    unregisterToolSpy: vi.spyOn(modelContext, 'unregisterTool'),
  }
}

test('withMCP registers tool and bridges execution to action', async () => {
  const { modelContext, tools, registerToolSpy, unregisterToolSpy } =
    createModelContext()

  const add = action((left: number, right: number) => left + right, 'add').extend(
    withMCP({
      description: 'Add two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          left: { type: 'number' },
          right: { type: 'number' },
        },
        required: ['left', 'right'],
      },
      modelContext,
      params: ({ left, right }: { left: number; right: number }) => [
        left,
        right,
      ],
    }),
  )

  const unregister = add.registerMCP()
  expect(registerToolSpy).toBeCalledTimes(1)
  const tool = tools.get('add')
  expect(tool).toBeTruthy()

  const payload = await tool!.execute({ left: 2, right: 3 }, client)
  expect(payload).toBe(5)

  unregister()
  expect(unregisterToolSpy).toBeCalledTimes(1)
  expect(unregisterToolSpy).toBeCalledWith('add')
})

test('withMCP leaves duplicate registration handling to caller', () => {
  const { modelContext, registerToolSpy, unregisterToolSpy } = createModelContext()

  const ping = action(() => 'pong', 'ping').extend(
    withMCP({
      modelContext,
    }),
  )

  const unregister = ping.registerMCP()

  expect(registerToolSpy).toBeCalledTimes(1)
  expect(() => ping.registerMCP()).toThrow('already registered')

  unregister()
  expect(unregisterToolSpy).toBeCalledTimes(1)
  expect(unregisterToolSpy).toBeCalledWith('ping')
})

test('withMCP can auto-register tool on extension setup', () => {
  const { modelContext, registerToolSpy } = createModelContext()

  const ping = action(() => 'pong', 'ping').extend(
    withMCP({
      autoRegister: true,
      modelContext,
    }),
  )

  expect(registerToolSpy).toBeCalledTimes(1)
  expect(typeof ping.registerMCP).toBe('function')
})

test('withMCP registration without modelContext returns noop unsubscribe', () => {
  const ping = action(() => 'pong', 'ping').extend(withMCP({}))

  const unregister = ping.registerMCP()
  expect(() => unregister()).not.toThrow()
})

test('withMCP default action params forward input as first argument', async () => {
  const { modelContext, tools } = createModelContext()

  const echo = action(
    (input: { text: string }) => input.text,
    'echo',
  ).extend(withMCP({ modelContext }))

  const unregister = echo.registerMCP()
  const tool = tools.get('echo')
  expect(tool).toBeTruthy()
  const result = await tool!.execute({ text: 'hello' }, client)

  expect(result).toBe('hello')
  unregister()
})

test('withMCP supports atoms as state-reading tools', async () => {
  const { modelContext, tools, registerToolSpy } = createModelContext()

  const user = atom({ id: 'u1', role: 'admin' }, 'user').extend(
    withMCP({
      modelContext,
      annotations: { readOnlyHint: true },
    }),
  )

  expect('registerMCP' in user).toBe(false)
  user()
  await Promise.resolve()

  expect(registerToolSpy).toBeCalledTimes(1)
  const tool = tools.get('user')
  expect(tool).toBeTruthy()
  const state = await tool!.execute({}, client)

  expect(state).toEqual({ id: 'u1', role: 'admin' })
})

test('withMCP description has meaningful defaults for actions and atoms', async () => {
  const { modelContext, tools } = createModelContext()

  const doSome = action(() => 'ok', 'doSome').extend(withMCP({ modelContext }))
  const stateAtom = atom({ ok: true }, 'stateAtom').extend(
    withMCP({ modelContext }),
  )

  const unregisterAction = doSome.registerMCP()
  stateAtom()
  await Promise.resolve()

  const actionToolDescription = tools.get('doSome')?.description
  const atomToolDescription = tools.get('stateAtom')?.description

  expect(actionToolDescription).toBe('Use this tool to interact with "doSome".')
  expect(atomToolDescription).toBe(
    'Use this tool to interact with "stateAtom".',
  )

  unregisterAction()
})

test('withMCP allows register-time modelContext override', async () => {
  const { modelContext, tools } = createModelContext()

  const ping = action(() => 'pong', 'ping').extend(withMCP({}))

  const unregister = ping.registerMCP({ modelContext })
  const tool = tools.get('ping')

  expect(tool).toBeTruthy()
  expect(await tool!.execute({}, client)).toBe('pong')

  unregister()
})
