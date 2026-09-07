import type { Action, AtomLike } from '../core'
import { isAction, ReatomError } from '../core'
import { wrap } from '../methods'
import type { OverloadParameters } from '../utils'
import { isObject, noop, type Unsubscribe } from '../utils'
import { withInitHook } from './withInit'

export interface MCPToolAnnotations {
  readOnlyHint?: boolean
}

/**
 * Minimal client object passed by WebMCP to a tool execution callback.
 *
 * @see https://github.com/webmachinelearning/webmcp
 */
export interface MCPModelContextClient {
  requestUserInteraction<Result>(
    callback: () => Result | Promise<Result>,
  ): Promise<Result>
}

export interface MCPModelContextTool<
  Input extends object = Record<string, unknown>,
  Payload = unknown,
> {
  name: string
  description: string
  inputSchema?: object
  execute: (input: Input, client: MCPModelContextClient) => Payload | Promise<Payload>
  annotations?: MCPToolAnnotations
}

export interface MCPModelContextOptions {
  tools?: Array<MCPModelContextTool>
}

export interface MCPModelContext {
  provideContext(options?: MCPModelContextOptions): void
  registerTool<Input extends object = Record<string, unknown>, Payload = unknown>(
    tool: MCPModelContextTool<Input, Payload>,
  ): void
  unregisterTool(name: string): void
}

/**
 * Configuration for `withMCP`.
 *
 * @template Target - Atom or action being exposed as a WebMCP tool
 * @template Input - Tool input object expected from an agent
 */
export interface WithMCPOptions<
  Target extends AtomLike,
  Input extends object = Record<string, unknown>,
> {
  name?: string
  /**
   * Optional natural language description for agent planning.
   *
   * Defaults to a generated generic description with the target name.
   */
  description?: string
  /**
   * Optional JSON Schema for the tool input.
   *
   * Agents rely on this schema to build valid calls, choose appropriate tools,
   * and reduce malformed arguments. In practice, this is one of the most
   * important fields for predictable tool execution.
   */
  inputSchema?: object
  annotations?: MCPToolAnnotations
  /**
   * Optional static context override.
   *
   * When omitted, registration tries `navigator.modelContext`.
   */
  modelContext?: MCPModelContext
  /**
   * Whether to register immediately during extension application.
   *
   * Default is `false`. This option applies to actions.
   */
  autoRegister?: boolean
  /**
   * Optional input-to-target args mapper.
   *
   * Defaults:
   *
   * - action: call target with `input` as first argument
   * - atom: call target with no arguments (read current state)
   */
  params?: (
    input: Input,
    client: MCPModelContextClient,
    target: Target,
  ) => OverloadParameters<Target>
}

export interface RegisterMCPOptions {
  modelContext?: MCPModelContext
}

/**
 * Extension methods added by `withMCP`.
 */
export interface MCPExt {
  /**
   * Register a WebMCP tool for this target and return cleanup.
   */
  registerMCP: (options?: RegisterMCPOptions) => Unsubscribe
}

export interface WithMCPExt<Target extends AtomLike = AtomLike> {
  <T extends Target>(target: T): T extends Action ? MCPExt : T
}

const isMCPModelContext = (candidate: unknown): candidate is MCPModelContext => {
  if (!isObject(candidate)) return false

  const provideContext = Reflect.get(candidate, 'provideContext')
  const registerTool = Reflect.get(candidate, 'registerTool')
  const unregisterTool = Reflect.get(candidate, 'unregisterTool')

  return (
    typeof provideContext === 'function' &&
    typeof registerTool === 'function' &&
    typeof unregisterTool === 'function'
  )
}

export const getMCPModelContext = (): undefined | MCPModelContext => {
  if (typeof navigator === 'undefined') return undefined

  const candidate = Reflect.get(navigator, 'modelContext')
  return isMCPModelContext(candidate) ? candidate : undefined
}

const DEFAULT_DESCRIPTION_PREFIX = 'Use this tool to interact with'

const getDefaultDescription = (target: AtomLike): string =>
  `${DEFAULT_DESCRIPTION_PREFIX} "${target.name}".`

/**
 * Extend atoms and actions with WebMCP tool registration.
 *
 * This extension maps Reatom entities to the WebMCP draft shape
 * (`navigator.modelContext.registerTool`) so browser agents can invoke
 * application behavior through typed tools.
 *
 * - **Actions**: represent executable behavior.
 * - **Atoms**: represent readable application state snapshots and are
 *   registered automatically on first init via `withInitHook`.
 *
 * By default, action tools call the target with `input` as a single argument,
 * while atom tools return current state by calling the target without
 * arguments.
 *
 * Registration for actions is intentionally explicit through `registerMCP()` so
 * scope can be controlled by the app:
 *
 * - runtime: register in a root route/layout
 * - tests: register at test start and cleanup with returned unsubscribe
 *
 * Tool callbacks are wrapped at registration time with Reatom `wrap`, so calls
 * from agents run inside the reactive context captured by the registration
 * scope.
 *
 * @see https://github.com/webmachinelearning/webmcp
 * @see https://modelcontextprotocol.io/specification/latest
 *
 * @example
 *   // Marketplace: list of goods atom with explicit MCP options.
 *   const goodsAtom = atom(
 *     [
 *       { id: 'sku-1', title: 'Laptop', price: 1200 },
 *       { id: 'sku-2', title: 'Keyboard', price: 120 },
 *     ],
 *     'marketplace.goods',
 *   ).extend(
 *     withMCP({
 *       name: 'list-goods',
 *       description: 'List currently available goods in the marketplace.',
 *       annotations: { readOnlyHint: true },
 *     }),
 *   )
 *   // Registered automatically on first read.
 *   goodsAtom()
 *
 * @example
 *   // Marketplace: search atom without explicit withMCP options.
 *   const searchAtom = atom('', 'marketplace.search').extend(withMCP({}))
 *   // Registered automatically on first read.
 *   searchAtom()
 *
 * @example
 *   // Marketplace: addToCard action with only description and inputSchema.
 *   const cartAtom = atom<Array<{ goodsId: string; quantity: number }>>([], 'cart')
 *   const addToCard = action(
 *     (input: { goodsId: string; quantity: number }) => {
 *       cartAtom.set((state) => [...state, input])
 *       return { ok: true }
 *     },
 *     'addToCard',
 *   ).extend(
 *     withMCP({
 *       description: 'Add a goods item to the shopping card.',
 *       inputSchema: {
 *         type: 'object',
 *         properties: {
 *           goodsId: { type: 'string' },
 *           quantity: { type: 'number', minimum: 1 },
 *         },
 *         required: ['goodsId', 'quantity'],
 *       },
 *     }),
 *   )
 *
 *   const unregister = addToCard.registerMCP()
 *   // Later cleanup:
 *   unregister()
 */
export function withMCP<
  Target extends AtomLike = AtomLike,
  Input extends object = Record<string, unknown>,
>(options: WithMCPOptions<Target, Input>): WithMCPExt<Target> {
  return (<T extends Target>(target: T) => {
    const {
      name = target.name,
      description,
      inputSchema,
      annotations,
      modelContext,
      autoRegister = false,
      params,
    } = options

    if (description !== undefined && typeof description !== 'string') {
      throw new ReatomError('withMCP: `description` should be a string')
    }

    if (params !== undefined && typeof params !== 'function') {
      throw new ReatomError('withMCP: `params` should be a function')
    }

    const resolveModelContext = (): undefined | MCPModelContext =>
      modelContext ?? getMCPModelContext()

    const toolDescription = description ?? getDefaultDescription(target)
    const toolName = name

    const registerTool = (registrationModelContext: MCPModelContext) => {
      const execute = wrap((input: Input, client: MCPModelContextClient) => {
        if (params) {
          return target(...params(input, client, target))
        }
        if (isAction(target)) {
          return target(input)
        }
        return target()
      })

      registrationModelContext.registerTool({
        name: toolName,
        description: toolDescription,
        inputSchema,
        execute,
        annotations,
      } satisfies MCPModelContextTool<Input, Awaited<ReturnType<Target>>>)

      return () => registrationModelContext.unregisterTool(toolName)
    }

    if (isAction(target)) {
      const registerMCP = (
        registrationOptions: RegisterMCPOptions = {},
      ): Unsubscribe => {
        const registrationModelContext =
          registrationOptions.modelContext ?? resolveModelContext()

        if (registrationModelContext === undefined) return noop

        return registerTool(registrationModelContext)
      }

      if (autoRegister) {
        registerMCP()
      }

      return {
        registerMCP,
      } as T extends Action ? MCPExt : T
    }

    return target.extend(
      withInitHook(() => {
        const registrationModelContext = resolveModelContext()
        if (registrationModelContext === undefined) return
        registerTool(registrationModelContext)
      }),
    ) as T extends Action ? MCPExt : T
  }) as WithMCPExt<Target>
}
