import {
  action,
  atom,
  type AtomState,
  isAtom,
  named,
  withParams,
} from '../core'
import { withCallHook } from '../extensions'
import {
  type LinkedList,
  type LinkedListAtom,
  type LLNode,
  reatomLinkedList,
} from '../primitives'
import { isShallowEqual } from '../utils'
import type { FieldAtom } from './reatomField'
import {
  type FieldsAtomize,
  type FieldsAtomizeInitState,
  type OnFieldCreatedAction,
  reatomFieldsAtomize,
} from './reatomFieldsAtomize'
import {
  type BaseFieldExt,
  type BaseFieldExtOptions,
  withBaseField,
} from './withBaseField'

export type FieldArrayLLNode<Node> = LLNode<FieldsAtomize<Node>>
export type FieldArrayState<Node> = LinkedList<FieldArrayLLNode<Node>>

/**
 * Configuration options for {@link reatomFieldArray}. Extends
 * {@link BaseFieldExtOptions} with array-specific settings.
 *
 * @example
 *   // Validation on change
 *   const emails = reatomFieldArray([''], {
 *     validateOnChange: true,
 *     validate: z.array(z.string().email()),
 *   })
 *
 * @example
 *   // Validation on blur with error preservation
 *   const tags = reatomFieldArray(['tag1'], {
 *     validateOnBlur: true,
 *     keepErrorOnChange: true,
 *     validate: ({ value }) =>
 *       value.length >= 2 || 'At least 2 tags required',
 *   })
 *
 * @example
 *   // Custom element creation with validation
 *   const contacts = reatomFieldArray(['alice@example.com'], {
 *     create: (email) => ({ email, verified: false }),
 *     validate: z.array(z.any()).min(1, 'At least one contact required'),
 *   })
 *
 * @template Param - The type of parameters used to create new elements
 * @template Node - The field structure of each element
 */
export type FieldArrayOptions<
  Param,
  Node extends FieldsAtomizeInitState,
> = Omit<
  BaseFieldExtOptions<
    FieldArrayState<Node>,
    FieldArrayLLNode<Node>[],
    [initState: FieldArrayInitState<Param>[]],
    FieldArrayLLNode<Node>[]
  >,
  'getValue' | 'getNormalizedState' | 'initStateAtom'
> & {
  /**
   * Factory function to transform input parameters into field element
   * structure. If not provided, the parameter is used directly as the element.
   *
   * @example
   *   const todos = reatomFieldArray([], {
   *     create: (text: string) => ({
   *       text,
   *       completed: false,
   *       createdAt: new Date(),
   *     }),
   *   })
   *   todos.create('Buy milk')
   *
   * @example
   *   // Using `name` to create properly named extended fields
   *   const permissions = reatomFieldArray([], {
   *     create: (resource: string, name) => ({
   *       resource,
   *       access: reatomEnum(
   *         ['read', 'write', 'admin'],
   *         `${name}.access`,
   *       ).extend(withField()),
   *     }),
   *   })
   *
   * @param param - The input parameter passed to `create()` method
   * @param name - Auto-generated debug name for the element (e.g.,
   *   `"fieldArray.item"`)
   * @returns The field structure for the new element
   */
  create?: (param: Param, name: string) => Node
  /** Debug name for the atom */
  name?: string
}

type FieldArrayInitState<T> = {
  [K in keyof T]: [T[K]] extends FieldArrayAtom<infer Param, infer _Node>
    ? Param[]
    : FieldArrayInitState<T[K]>
}

/**
 * Reactive atom for managing dynamic arrays of form fields. Combines
 * {@link LinkedListAtom} with {@link BaseFieldExt} to provide efficient list
 * operations (add, remove, reorder) alongside form state tracking (dirty,
 * validation, reset).
 *
 * @template Param - The type of parameters used to create new field elements
 * @template Node - The structure of each field element (must extend
 *   {@link FieldsAtomizeInitState})
 */
export type FieldArrayAtom<
  Param = any,
  Node extends FieldsAtomizeInitState = FieldsAtomizeInitState,
> = LinkedListAtom<[FieldArrayInitState<Param>], FieldsAtomize<Node>> &
  BaseFieldExt<
    FieldArrayState<Node>,
    [initState: FieldArrayInitState<Param>[]]
  > & {
    experimental_onFieldCreated: OnFieldCreatedAction
  }

/**
 * Extracts the type of a single element from a {@link FieldArrayAtom}.
 *
 * @example
 *   const usersArray = reatomFieldArray([{ name: 'Alice', age: 30 }])
 *   type UserItem = FieldArrayItem<typeof usersArray>
 *   // UserItem = { name: FieldAtom<string>, age: FieldAtom<number> }
 *
 * @template T - The {@link FieldArrayAtom} type to extract the item from
 */
export type FieldArrayItem<T> =
  T extends FieldArrayAtom<infer _Param, infer _Node>
    ? AtomState<T['array']>[number]
    : never

/**
 * Type guard to check if an atom is a {@link FieldArrayAtom}.
 *
 * @example
 *   if (isFieldArrayAtom(field)) {
 *     field.create({ name: '', age: 0 })
 *   }
 *
 * @param atom - The atom to check
 * @returns `true` if the atom is a {@link FieldArrayAtom}, `false` otherwise
 */
export const isFieldArrayAtom = (atom: any): atom is FieldArrayAtom => {
  return isAtom(atom) && 'experimental_onFieldCreated' in atom
}

/**
 * Creates a {@link FieldArrayAtom} from an array of initial values with
 * heterogeneous types. Each element's type is inferred and preserved, allowing
 * mixed-type arrays.
 *
 * @example
 *   const mixedArray = reatomFieldArray([
 *     { type: 'text', value: 'hello' },
 *     { type: 'number', value: 42 },
 *   ])
 *
 * @param initState - Array of initial values to populate the field array
 * @param name - Optional debug name for the atom
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<Params extends any[]>(
  initState: Params extends FieldsAtomizeInitState[] ? Params : never,
  name?: string,
): FieldArrayAtom<Params[number], Params[number]>

/**
 * Creates a {@link FieldArrayAtom} from an array of initial values with a
 * uniform type.
 *
 * @example
 *   const usersArray = reatomFieldArray(
 *     [
 *       { name: 'Alice', age: 30 },
 *       { name: 'Bob', age: 25 },
 *     ],
 *     'usersArray',
 *   )
 *   usersArray.create({ name: '', age: 0 })
 *
 * @param initState - Array of initial values with the same type
 * @param name - Optional debug name for the atom
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<Param extends FieldsAtomizeInitState>(
  initState: Param[],
  name?: string,
): FieldArrayAtom<Param, Param>

/**
 * Creates a {@link FieldArrayAtom} with a factory function for custom element
 * creation. Use this when you need to transform input parameters into a
 * different field structure.
 *
 * @example
 *   const todosArray = reatomFieldArray(
 *     (text: string) => ({ text, completed: false, createdAt: new Date() }),
 *     'todosArray',
 *   )
 *   todosArray.create('Buy milk')
 *
 * @example
 *   // Using `name` to create properly named extended fields
 *   const permissions = reatomFieldArray([], {
 *     create: (resource: string, name) => ({
 *       resource,
 *       access: reatomEnum(
 *         ['read', 'write', 'admin'],
 *         `${name}.access`,
 *       ).extend(withField()),
 *     }),
 *   })
 *
 * @param create - Factory function that receives a parameter and returns the
 *   field structure
 * @param name - Optional debug name for the atom
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<Param, Node extends FieldsAtomizeInitState>(
  create: (param: Param, name: string) => Node,
  name?: string,
): FieldArrayAtom<Param, Node>

/**
 * Creates a {@link FieldArrayAtom} using an options object.
 *
 * @deprecated Use `reatomFieldArray(initState, options)` or
 *   `reatomFieldArray(create, name)` overloads instead
 * @param options - Configuration object with `create` factory and optional
 *   `initState`
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<
  Param,
  Node extends FieldsAtomizeInitState,
>(options: {
  create: (param: Param, name: string) => Node
  initState?: Param[]
  name?: string
}): FieldArrayAtom<Param, Node>

/**
 * Creates a {@link FieldArrayAtom} from heterogeneous initial values with
 * additional options. Provides full control over field creation, validation,
 * and dirty state tracking.
 *
 * @example
 *   const itemsArray = reatomFieldArray([{ sku: 'A1', quantity: 2 }], {
 *     create: (item) => ({ ...item, validated: false }),
 *     validate: ({ state }) =>
 *       !state.length ? 'At least one item required' : undefined,
 *   })
 *
 * @param initState - Array of initial values with heterogeneous types
 * @param options - Configuration options including custom `create` factory and
 *   validation
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<Params extends any[]>(
  initState: Params extends FieldsAtomizeInitState[] ? Params : never,
  options: FieldArrayOptions<Params[number], Params[number]>,
): FieldArrayAtom<Params[number], Params[number]>

/**
 * Creates a {@link FieldArrayAtom} from uniform initial values with additional
 * options. Allows custom field creation via `options.create` to transform
 * initial values into a different structure.
 *
 * @example
 *   const contactsArray = reatomFieldArray(
 *     ['alice@example.com', 'bob@example.com'],
 *     {
 *       create: (email) => ({ email, verified: false }),
 *       validate: ({ state }) =>
 *         state.length > 10 ? 'Too many contacts' : undefined,
 *     },
 *   )
 *
 * @param initState - Array of initial values with uniform type
 * @param options - Configuration options including custom `create` factory and
 *   validation
 * @returns A {@link FieldArrayAtom} managing the array of fields
 */
export function reatomFieldArray<Param, Node extends FieldsAtomizeInitState>(
  initState: Param[],
  options: FieldArrayOptions<Param, Node>,
): FieldArrayAtom<Param, Node>

export function reatomFieldArray<Param, Node extends FieldsAtomizeInitState>(
  optionsOrInitState:
    | Param[]
    | ((params: Param, name: string) => Node)
    | FieldArrayOptions<Param, Node>,
  nameOrOptions?: string | FieldArrayOptions<Param, Node>,
): FieldArrayAtom<Param, Node> {
  interface This extends FieldArrayAtom<Param, Node> {}

  const {
    create = (param: Param) => param as unknown as Node,
    initState = [],
    isDirty = (
      newState: FieldArrayLLNode<Node>[],
      prevState: FieldArrayLLNode<Node>[],
    ) => !isShallowEqual(newState, prevState),
    name: optionsName,
    ...restOptions
  } = typeof optionsOrInitState === 'function'
    ? { create: optionsOrInitState }
    : Array.isArray(optionsOrInitState)
      ? typeof nameOrOptions === 'object'
        ? { ...nameOrOptions, initState: optionsOrInitState }
        : { initState: optionsOrInitState }
      : { ...optionsOrInitState }

  const name =
    (typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions?.name) ||
    optionsName ||
    named('fieldArray')

  const onFieldCreated: OnFieldCreatedAction = action(
    (field: FieldAtom) => field,
    `${name}.onFieldCreated`,
  )

  let currentInitSnapshot = initState as FieldArrayInitState<Param>[]

  const initStateAtom: This['initState'] = atom(
    () => fieldArrayAtom(),
    `${name}.initState`,
  ).extend(
    withParams((initState: FieldArrayInitState<Param>[]) => {
      currentInitSnapshot = initState
      return fieldArrayAtom.initiateFromSnapshot(initState.map((v) => [v]))
    }),
  )

  const fieldArrayAtom = reatomLinkedList(
    {
      create: (param) => {
        const factoryName = `${name}.item`
        const model = reatomFieldsAtomize(
          create(param, factoryName),
          factoryName,
        )
        model.experimental_onFieldCreated?.extend(withCallHook(onFieldCreated))

        return model.fields
      },
      initSnapshot: initState.map(
        (state) => [state] as [FieldArrayInitState<Param>],
      ),
    },
    name,
  ).extend(
    withBaseField({
      initStateAtom,
      getNormalizedState: (state) => {
        // TODO decouple into a function (including a reatomForm one)
        const elements = []
        let head = state.head
        while (head) {
          elements.push(head)
          head = head[state.LL_NEXT]
        }
        // TODO: reatomLinkedLost does not support the same elements in two or more difference linked lists so we need to limit size of the array there
        return elements.slice(0, state.size)
      },
      getValue: (): FieldArrayLLNode<Node>[] => fieldArrayAtom.array(),
      isDirty,
      ...restOptions,
    }),
  )

  const baseReset = fieldArrayAtom.reset

  return Object.assign(fieldArrayAtom, {
    experimental_onFieldCreated: onFieldCreated,
    reset: action(
      (...args: [] | [initState: FieldArrayInitState<Param>[]]) =>
        baseReset(...(args.length ? args : [currentInitSnapshot])),
      `${name}._reset`,
    ),
  })
}

/** @deprecated Use reatomFieldArray instead */
export const experimental_fieldArray = reatomFieldArray

/** @deprecated Renamed. Use FieldArrayItem instead */
export type ArrayFieldItem<T> = FieldArrayItem<T>
