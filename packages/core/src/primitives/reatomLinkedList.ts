import type { Action, Atom, Computed } from '../core'
import {
  _enqueue,
  action,
  atom,
  computed,
  isAtom,
  named,
  ReatomError,
} from '../core'
import { withChangeHook } from '../extensions/withChangeHook'
import { withFromJson } from '../extensions/withFromJson'
import { withToJson } from '../extensions/withToJson'
import { peek } from '../methods'
import type { Fn, Rec } from '../utils'
import { isObject } from '../utils'

type State<T> = T extends Atom<infer Value> ? Value : T

declare const LL_PREV: unique symbol
export type LL_PREV = typeof LL_PREV
declare const LL_NEXT: unique symbol
export type LL_NEXT = typeof LL_NEXT

export type LLNode<T extends Rec = Rec> = T & {
  [LL_PREV]: null | LLNode<T>
  [LL_NEXT]: null | LLNode<T>
}

export type LinkedListSymbols = {
  readonly LL_PREV: LL_PREV
  readonly LL_NEXT: LL_NEXT
}

type LLChanges<Node extends LLNode> =
  | { kind: 'create'; node: Node }
  | { kind: 'createMany'; nodes: Node[] }
  | { kind: 'remove'; node: Node }
  | { kind: 'removeMany'; nodes: Node[] }
  | { kind: 'swap'; a: Node; b: Node }
  | { kind: 'move'; node: Node; after: null | Node }
  | { kind: 'clear' }

export interface LinkedList<
  Node extends LLNode = LLNode,
> extends LinkedListSymbols {
  head: null | Node
  tail: null | Node
  size: number
  version: number
  changes: Array<LLChanges<Node>>
  /**
   * The nodes of the initial state in their initial order. Unlike the node
   * chain, this plain array is immune to the in-place pointer mutations
   * performed by list operations, so it stays pristine across the atom
   * lifetime and is used by `reset`. Empty for derived lists (`reatomMap`).
   */
  initNodes: Array<Node>
}

export interface LinkedListLikeAtom<T extends LinkedList = LinkedList>
  extends Atom<T>, LinkedListSymbols {
  array: Computed<Array<T extends LinkedList<infer LLNode> ? LLNode : never>>

  __reatomLinkedList: true
}

export interface LinkedListAtom<
  Params extends any[] = any[],
  Node extends Rec = Rec,
  Key extends keyof Node = never,
> extends LinkedListLikeAtom<LinkedList<LLNode<Node>>> {
  batch: Action<[cb: Fn]>

  create: Action<Params, LLNode<Node>>
  createMany: Action<[Array<Params>], Array<LLNode<Node>>>
  remove: Action<[LLNode<Node>], boolean>
  removeMany: Action<[Array<LLNode<Node>>], number>
  swap: Action<[a: LLNode<Node>, b: LLNode<Node>], void>
  move: Action<[node: LLNode<Node>, after: null | LLNode<Node>], void>
  clear: Action<[], void>

  /**
   * Restores the list to its initial nodes in their initial order — the state
   * captured at creation or at the last `initiateFromState` /
   * `initiateFromSnapshot` application. Node identity is preserved: the
   * original node objects are relinked, not recreated.
   */
  reset: Action<[], void>

  find: (cb: (node: LLNode<Node>) => boolean) => null | LLNode<Node>

  /**
   * This lazy map is useful for working with serializable identifier, but it is
   * not recommended to use it for large (thousands elements) lists
   */
  map: Key extends never ? never : Atom<Map<State<Node[Key]>, LLNode<Node>>>

  initiateFromState: (initState: Array<Node>) => LinkedList<LLNode<Node>>
  initiateFromSnapshot: (
    initSnapshot: Array<Params>,
  ) => LinkedList<LLNode<Node>>

  reatomMap: <T extends Rec>(
    cb: (node: LLNode<Node>) => T,
    options?:
      | string
      | {
          name?: string
          onCreate?: (node: LLNode<T>) => void
          onRemove?: (node: LLNode<T>, origin: LLNode<Node>) => void
          onSwap?: (payload: { a: LLNode<T>; b: LLNode<T> }) => void
          onMove?: (node: LLNode<T>) => void
          onClear?: (
            lastState: LinkedListDerivedState<LLNode<Node>, LLNode<T>>,
          ) => void
        },
  ) => LinkedListDerivedAtom<LLNode<Node>, LLNode<T>>

  // reatomFilter: (
  //   cb: (node: Node) => any,
  //   name?: string,
  // ) => Atom<ListType<Node>>

  // reatomReduce: <T>(
  //   options: {
  //     init: T
  //     add: (acc: T, node: LLNode<Node>) => T
  //     del: (acc: T, node: LLNode<Node>) => T
  //   },
  //   name?: string,
  // ) => Atom<T>
}

// TODO rename to `DerivedLinkedList`
export interface LinkedListDerivedState<
  Node extends LLNode,
  T extends LLNode,
> extends LinkedList<T> {
  map: WeakMap<Node, T>
}

export interface LinkedListDerivedAtom<Node extends LLNode, T extends LLNode>
  extends Computed<LinkedListDerivedState<Node, T>>, LinkedListSymbols {
  array: Computed<Array<T extends LinkedList<infer LLNode> ? LLNode : never>>

  __reatomLinkedList: true
}

const addLL = <Node extends LLNode>(
  _state: LinkedList<Node>,
  _node: Node | Omit<Node, keyof LLNode>,
  _after: null | Node,
) => {
  const state: LinkedList = _state as any
  const node: LLNode = _node as any
  const after: null | LLNode = _after as any
  const LL_PREV: LL_PREV = state.LL_PREV as any
  const LL_NEXT: LL_NEXT = state.LL_NEXT as any

  if (node === after) return

  if (after) {
    const nextNode = after[LL_NEXT]
    node[LL_PREV] = after
    node[LL_NEXT] = nextNode
    after[LL_NEXT] = node
    if (nextNode) {
      nextNode[LL_PREV] = node
    }
    if (state.tail === after) {
      state.tail = node
    }
  } else {
    node[LL_PREV] = null
    node[LL_NEXT] = state.head
    if (state.head) {
      state.head[LL_PREV] = node
    }
    if (!state.tail) {
      state.tail = node
    }
    state.head = node
  }
  state.size++
}

const removeLL = <Node extends LLNode>(
  _state: LinkedList<Node>,
  _node: Node,
) => {
  const state: LinkedList = _state as any
  const node: LLNode = _node as any
  const LL_PREV: LL_PREV = state.LL_PREV as any
  const LL_NEXT: LL_NEXT = state.LL_NEXT as any

  if (state.head === node) {
    state.head = node[LL_NEXT]
  } else if (node[LL_PREV] !== null) {
    node[LL_PREV][LL_NEXT] = node[LL_NEXT]
  }

  if (state.tail === node) {
    state.tail = node[LL_PREV]
  } else if (node[LL_NEXT] !== null) {
    node[LL_NEXT][LL_PREV] = node[LL_PREV]
  }

  node[LL_PREV] = null
  node[LL_NEXT] = null

  state.size--
}

const swapLL = <Node extends LLNode>(
  _state: LinkedList<Node>,
  _a: Node,
  _b: Node,
): void => {
  const state: LinkedList = _state as any
  const a: LLNode = _a as any
  const b: LLNode = _b as any
  const LL_PREV: LL_PREV = state.LL_PREV as any
  const LL_NEXT: LL_NEXT = state.LL_NEXT as any

  if (a === b) return

  if (state.head === b) return swapLL(state, b, a)

  const prevA = a[LL_PREV]
  const nextA = a[LL_NEXT]
  const prevB = b[LL_PREV]
  const nextB = b[LL_NEXT]

  if (nextA === b) {
    a[LL_NEXT] = nextB
    b[LL_PREV] = prevA
    b[LL_NEXT] = a
    a[LL_PREV] = b

    if (nextB) nextB[LL_PREV] = a
    if (prevA) prevA[LL_NEXT] = b
  } else if (nextB === a) {
    b[LL_NEXT] = nextA
    a[LL_PREV] = prevB
    a[LL_NEXT] = b
    b[LL_PREV] = a

    if (nextA) nextA[LL_PREV] = b
    if (prevB) prevB[LL_NEXT] = a
  } else {
    if (prevA) prevA[LL_NEXT] = b
    if (nextA) nextA[LL_PREV] = b
    if (prevB) prevB[LL_NEXT] = a
    if (nextB) nextB[LL_PREV] = a

    a[LL_PREV] = prevB
    a[LL_NEXT] = nextB
    b[LL_PREV] = prevA
    b[LL_NEXT] = nextA
  }

  if (state.head === a) {
    state.head = b
  } else if (state.head === b) {
    state.head = a
  }

  if (state.tail === a) {
    state.tail = b
  } else if (state.tail === b) {
    state.tail = a
  }
}

const moveLL = <Node extends LLNode>(
  state: LinkedList<Node>,
  node: Node,
  after: null | Node,
) => {
  removeLL(state, node)
  addLL(state, node, after)
}

const clearLL = <Node extends LLNode>(state: LinkedList<Node>) => {
  const LL_PREV: LL_PREV = state.LL_PREV as any
  const LL_NEXT: LL_NEXT = state.LL_NEXT as any
  let node: null | LLNode = state.head
  state.head = null
  state.tail = null
  state.size = 0
  while (node) {
    const next = node[LL_NEXT]
    node[LL_PREV] = null
    node[LL_NEXT] = null
    node = next
  }
}

export const toArray = <T extends Rec>(
  { head, LL_NEXT }: LinkedList<LLNode<T>>,
  prev?: Array<LLNode<T>>,
): Array<LLNode<T>> => {
  let arr: Array<LLNode<T>> = []
  let i = 0
  while (head) {
    if (prev !== undefined && prev[i] !== head) prev = undefined
    arr.push(head)
    head = head[LL_NEXT as LL_NEXT]
    i++
  }
  return arr.length === prev?.length ? prev : arr
}

/**
 * Creates a reactive linked list for collections where inserts, removals, and
 * reordering are part of the main workflow.
 *
 * @remarks
 *   Each item becomes a node with hidden prev/next links, so you can `move` or
 *   `swap` existing items without rebuilding the whole collection. You can
 *   start from existing nodes, a node factory, or a config with `initState` /
 *   `initSnapshot`. Use `array()` when rendering with normal array helpers,
 *   `key` when you need lookup by a stable id, and `batch()` when importing or
 *   reordering many nodes at once.
 * @example
 *   // Build a reorderable upload queue
 *   const uploads = reatomLinkedList(
 *     {
 *       create: (fileName: string) => ({
 *         fileName,
 *         progress: atom(0),
 *       }),
 *       key: 'fileName',
 *     },
 *     'uploads',
 *   )
 *
 *   uploads.create('cover.png')
 *   const hero = uploads.create('hero.png')
 *
 *   uploads.move(hero, null)
 *   uploads.map().get('cover.png')?.progress.set(100)
 *
 *   uploads.array().map((upload) => ({
 *     fileName: upload.fileName,
 *     progress: upload.progress(),
 *   }))
 *   // [
 *   //   { fileName: 'hero.png', progress: 0 },
 *   //   { fileName: 'cover.png', progress: 100 },
 *   // ]
 *
 * @example
 *   // Keep derived row state in sync with the source order
 *   const backlog = reatomLinkedList(
 *     (title: string) => ({ title }),
 *     'backlog',
 *   )
 *   const rows = backlog.reatomMap(
 *     (task) => ({
 *       title: task.title,
 *       expanded: atom(false),
 *     }),
 *     'backlogRows',
 *   )
 *
 *   const docsTask = backlog.create('Write docs')
 *   backlog.create('Ship release')
 *
 *   rows.array()[0].expanded.set(true)
 *   backlog.remove(docsTask)
 *
 *   rows.array().map((row) => ({
 *     title: row.title,
 *     expanded: row.expanded(),
 *   }))
 *   // [{ title: 'Ship release', expanded: false }]
 */
export function reatomLinkedList<
  Node extends Rec,
  Params extends any[] = [Node],
  Key extends keyof Node = never,
>(initState: Array<Node>, name?: string): LinkedListAtom<Params, Node, Key>

export function reatomLinkedList<
  Params extends any[],
  Node extends Rec,
  Key extends keyof Node = never,
>(
  initState: (...params: Params) => Node,
  name?: string,
): LinkedListAtom<Params, Node, Key>

export function reatomLinkedList<
  Params extends any[],
  Node extends Rec,
  Key extends keyof Node = never,
>(
  initState: {
    create: (...params: Params) => Node
    initState?: Array<Node>
    key?: Key
  },
  name?: string,
): LinkedListAtom<Params, Node, Key>

export function reatomLinkedList<
  Params extends any[],
  Node extends Rec,
  Key extends keyof Node = never,
>(
  initState: {
    create?: (...params: Params) => Node
    initState: Array<Node>
    key?: Key
  },
  name?: string,
): LinkedListAtom<Params, Node, Key>

export function reatomLinkedList<
  Params extends any[],
  Node extends Rec,
  Key extends keyof Node = never,
>(
  initSnapshot: {
    create: (...params: Params) => Node
    initSnapshot?: Array<Params>
    key?: Key
  },
  name?: string,
): LinkedListAtom<Params, Node, Key>

export function reatomLinkedList<
  Params extends any[],
  Node extends Rec,
  Key extends keyof Node = never,
>(
  options:
    | Array<Node>
    | ((...params: Params) => Node)
    | {
        create?: (...params: Params) => Node
        initState?: Array<Node>
        key?: Key
      }
    | {
        create: (...params: Params) => Node
        initSnapshot?: Array<Params>
        key?: Key
      },
  name: string = named('linkedListAtom'),
): LinkedListAtom<Params, Node, Key> {
  const LL_PREV: LL_PREV = Symbol('Reatom linked list prev') as any
  const LL_NEXT: LL_NEXT = Symbol('Reatom linked list next') as any

  const {
    create: userCreate = (...params: Params) => params[0],
    key = undefined,
    ...restOptions
  } = typeof options === 'function'
    ? {
        create: options,
      }
    : Array.isArray(options)
      ? {
          create: (...params: Params) => params[0],
          initState: options,
        }
      : options

  const _name = name

  const isInList = (node: Node): boolean => {
    if (!node || !(LL_PREV in node) || !(LL_NEXT in node)) return false

    return (
      node[LL_PREV] !== null ||
      node[LL_NEXT] !== null ||
      (STATE!.head === node && STATE!.tail === node)
    )
  }

  const throwModel = (node: Node) => {
    if (isInList(node))
      throw new ReatomError('The data is already in a linked list.')
  }

  const hasOurKeys = (node: Node): boolean =>
    !!node && LL_PREV in node && LL_NEXT in node

  const throwNotModel = (node: Node) => {
    if (!hasOurKeys(node))
      throw new ReatomError('The passed data is not a linked list node.')
  }

  // for batching
  let STATE: null | LinkedList<LLNode<Node>> = null

  const linkedList = atom(() => {
    try {
      if ('initState' in restOptions)
        return createLinkedListFromState(restOptions.initState ?? [])
      else if ('initSnapshot' in restOptions)
        return createLinkedListFromSnapshot(restOptions.initSnapshot ?? [])
      else return createLinkedListFromState([])
    } finally {
      STATE = null
    }
  }, name)

  const createLinkedListFromState = (
    initState: Node[],
  ): LinkedList<LLNode<Node>> => {
    const state = {
      LL_PREV,
      LL_NEXT,
      size: 0,
      version: 1,
      changes: [],
      head: null,
      tail: null,
      initNodes: [],
    } as LinkedList<LLNode<Node>>

    for (const node of initState) {
      throwModel(node)
      addLL(state, node, state.tail)
    }

    state.initNodes = toArray(state)

    return state
  }

  const createLinkedListFromSnapshot = (
    initSnapshot: Params[],
  ): LinkedList<LLNode<Node>> => {
    const initState = initSnapshot.map((params) => userCreate(...params))
    const state = {
      LL_PREV,
      LL_NEXT,
      size: 0,
      version: 1,
      changes: [],
      head: null,
      tail: null,
      initNodes: [],
    } as LinkedList<LLNode<Node>>

    for (const node of initState) {
      throwModel(node)
      addLL(state, node, state.tail)
    }

    state.initNodes = toArray(state)

    return state
  }

  const batchFn = <T>(cb: Fn): T => {
    if (STATE) return cb()

    let result: T

    linkedList.set(
      ({ head, tail, size, version, LL_PREV, LL_NEXT, initNodes }) => {
        STATE = {
          LL_PREV,
          LL_NEXT,
          size,
          version: version + 1,
          changes: [],
          head,
          tail,
          initNodes,
        }

        try {
          result = cb()

          return STATE
        } finally {
          STATE = null
        }
      },
    )

    return result!
  }

  const batch = action(batchFn, `${name}._batch`)

  const addNode = (params: Params): LLNode<Node> => {
    const node = userCreate(...params) as LLNode<Node>

    if (!isObject(node) && typeof node !== 'function')
      throw new ReatomError(
        `reatomLinkedList can operate only with objects or functions, received "${node}".`,
      )

    throwModel(node)

    addLL(STATE!, node, STATE!.tail)

    return node
  }

  const delNode = (node: LLNode<Node>): boolean => {
    throwNotModel(node)

    if (
      node[LL_PREV] === null &&
      node[LL_NEXT] === null &&
      STATE!.tail !== node
    )
      return false

    removeLL(STATE!, node)

    return true
  }

  const create = action((...params: Params): LLNode<Node> => {
    return batchFn(() => {
      const node = addNode(params)
      STATE!.changes.push({ kind: 'create', node })
      return node
    })
  }, `${name}.create`)

  const createMany = action(
    (paramsArray: Array<Params>): Array<LLNode<Node>> => {
      return batchFn(() => {
        const nodes: Array<LLNode<Node>> = []

        for (const params of paramsArray) {
          nodes.push(addNode(params))
        }

        STATE!.changes.push({ kind: 'createMany', nodes })

        return nodes
      })
    },
    `${name}.createMany`,
  )

  const remove = action((node: LLNode<Node>): boolean => {
    return batchFn(() => {
      const result = delNode(node)
      if (result) STATE!.changes.push({ kind: 'remove', node })
      return result
    })
  }, `${name}.remove`)

  const removeMany = action((nodes: Array<LLNode<Node>>): number => {
    return batchFn(() => {
      const removedNodes: Array<LLNode<Node>> = []

      for (const node of nodes) {
        if (delNode(node)) {
          removedNodes.push(node)
        }
      }

      if (removedNodes.length > 0) {
        STATE!.changes.push({ kind: 'removeMany', nodes: removedNodes })
      }

      return removedNodes.length
    })
  }, `${name}.removeMany`)

  const swap = action((a: LLNode<Node>, b: LLNode<Node>): void => {
    return batchFn(() => {
      throwNotModel(a)
      throwNotModel(b)

      if (a === b) return

      swapLL(STATE!, a, b)

      STATE!.changes.push({ kind: 'swap', a, b })
    })
  }, `${name}.swap`)

  const move = action(
    (node: LLNode<Node>, after: null | LLNode<Node>): void => {
      return batchFn(() => {
        throwNotModel(node)

        moveLL(STATE!, node, after)

        STATE!.changes.push({ kind: 'move', node, after })
      })
    },
    `${name}.move`,
  )

  const clear = action((): void => {
    return batchFn(() => {
      clearLL(STATE!)

      STATE!.changes.push({ kind: 'clear' })
    })
  }, `${name}.clear`)

  const isPristine = (state: LinkedList<LLNode<Node>>): boolean => {
    if (state.size !== state.initNodes.length) return false
    let head: null | LLNode<Node> = state.head
    for (const node of state.initNodes) {
      if (head !== node) return false
      head = head[LL_NEXT]
    }
    return head === null
  }

  const reset = action((): void => {
    if (isPristine(STATE ?? linkedList())) return

    return batchFn(() => {
      const state = STATE!
      const { initNodes } = state

      clearLL(state)
      state.changes.push({ kind: 'clear' })

      if (initNodes.length) {
        for (const node of initNodes) {
          throwModel(node)
          addLL(state, node, state.tail)
        }
        state.changes.push({ kind: 'createMany', nodes: initNodes.slice() })
      }
    })
  }, `${name}.reset`)

  const find = (cb: (node: LLNode<Node>) => boolean): null | LLNode<Node> => {
    for (let { head } = linkedList(); head; head = head[LL_NEXT]) {
      if (cb(head)) return head
    }
    return null
  }

  const array: LinkedListAtom<Params, Node, Key>['array'] = computed(
    (state: Array<LLNode<Node>> = []) => toArray(linkedList(), state),
    `${name}.array`,
  )

  const map = key
    ? (computed(
        () =>
          new Map(
            // use array as it already memoized and simplifies the order tracking
            array().map((node) => {
              const keyValue = node[key]
              return [isAtom(keyValue) ? keyValue() : keyValue, node] as const
            }),
          ),
      ) as LinkedListAtom<Params, Node, Key>['map'])
    : (undefined as never)

  const reatomMap = <T extends Rec>(
    cb: (node: LLNode<Node>) => T,
    options:
      | string
      | {
          name?: string
          onCreate?: (node: LLNode<T>) => void
          onRemove?: (node: LLNode<T>, origin: LLNode<Node>) => void
          onSwap?: (payload: { a: LLNode<T>; b: LLNode<T> }) => void
          onMove?: (node: LLNode<T>) => void
          onClear?: (
            lastState: LinkedListDerivedState<LLNode<Node>, LLNode<T>>,
          ) => void
        } = {},
  ): LinkedListDerivedAtom<LLNode<Node>, LLNode<T>> => {
    const mapLL_PREV: LL_PREV = Symbol('Reatom linked list prev') as any
    const mapLL_NEXT: LL_NEXT = Symbol('Reatom linked list next') as any

    const { name = named(`${_name}.reatomMap`), ...hooks } =
      typeof options === 'string' ? { name: options } : options

    type State = LinkedListDerivedState<LLNode<Node>, LLNode<T>>

    const mapList = computed((mapList?: State): State => {
      if (STATE) {
        throw new ReatomError(
          `Can't compute the map of the linked list inside the batching.`,
        )
      }

      const ll = linkedList()

      if (
        !mapList ||
        /* some update was missed */ ll.version - 1 > mapList.version
      ) {
        if (mapList) hooks.onClear?.(mapList)

        mapList = {
          LL_PREV: mapLL_PREV,
          LL_NEXT: mapLL_NEXT,
          size: ll.size,
          version: ll.version,
          changes: [],
          head: null,
          tail: null,
          initNodes: [],
          map: new WeakMap(),
        }

        for (let head = ll.head; head; head = head[LL_NEXT]) {
          const node = peek(cb, head) as LLNode<T>
          addLL(mapList, node, mapList.tail)
          mapList.map.set(head, node)
          hooks.onCreate?.(node)
        }
        // cover extra size changes from `addLL`
        mapList.size = ll.size
      } else {
        mapList = {
          LL_PREV: mapLL_PREV,
          LL_NEXT: mapLL_NEXT,
          head: mapList.head,
          tail: mapList.tail,
          size: mapList.size,
          version: ll.version,
          changes: [],
          initNodes: [],
          map: mapList.map,
        }

        for (const change of ll.changes) {
          switch (change.kind) {
            case 'create': {
              const node = peek(cb, change.node) as LLNode<T>
              addLL(mapList, node, mapList.tail)
              mapList.map.set(change.node, node)
              mapList.changes.push({ kind: 'create', node })
              hooks.onCreate?.(node)
              break
            }
            case 'createMany': {
              const nodes: Array<LLNode<T>> = []
              for (const originNode of change.nodes) {
                const node = peek(cb, originNode) as LLNode<T>
                addLL(mapList, node, mapList.tail)
                mapList.map.set(originNode, node)
                nodes.push(node)
                hooks.onCreate?.(node)
              }
              mapList.changes.push({ kind: 'createMany', nodes })
              break
            }
            case 'remove': {
              const node = mapList.map.get(change.node)!
              removeLL(mapList, node)
              mapList.map.delete(change.node)
              mapList.changes.push({ kind: 'remove', node })
              hooks.onRemove?.(node, change.node)
              break
            }
            case 'removeMany': {
              const nodes: Array<LLNode<T>> = []
              for (const originNode of change.nodes) {
                const node = mapList.map.get(originNode)!
                removeLL(mapList, node)
                mapList.map.delete(originNode)
                nodes.push(node)
                hooks.onRemove?.(node, originNode)
              }
              mapList.changes.push({ kind: 'removeMany', nodes })
              break
            }
            case 'swap': {
              const a = mapList.map.get(change.a)!
              const b = mapList.map.get(change.b)!
              swapLL(mapList, a, b)
              mapList.changes.push({ kind: 'swap', a, b })
              hooks.onSwap?.({ a, b })
              break
            }
            case 'move': {
              const node = mapList.map.get(change.node)!
              const after = change.after ? mapList.map.get(change.after)! : null
              moveLL(mapList, node, after)
              mapList.changes.push({ kind: 'move', node, after })
              hooks.onMove?.(node)
              break
            }
            case 'clear': {
              hooks.onClear?.(mapList)
              clearLL(mapList)
              mapList.map = new WeakMap()
              mapList.changes.push({ kind: 'clear' })
              break
            }
            default: {
              const kind: never = change
              const error = new Error(`Unhandled linked list change "${kind}"`)
              throw error
            }
          }
        }
      }

      if (mapList.size !== ll.size)
        throw new ReatomError(
          "Inconsistent linked list, is's a bug, please report an issue",
        )

      return mapList
    }, name)

    // @ts-ignore
    const array: LinkedListDerivedAtom<LLNode<Node>, LLNode<T>>['array'] =
      computed(
        (state: Array<LLNode<T>> = []) => toArray(mapList(), state),
        `${name}.array`,
      )

    return Object.assign(mapList, {
      LL_PREV: mapLL_PREV,
      LL_NEXT: mapLL_NEXT,
      array,
      __reatomLinkedList: true as const,
    }) as LinkedListDerivedAtom<LLNode<Node>, LLNode<T>>
  }

  // TODO there is a bug with `del` logic
  // const reatomReduce = <T>(
  //   {
  //     init,
  //     add,
  //     del,
  //   }: {
  //     init: T
  //     add: (ctx: CtxSpy, acc: T, node: LLNode<Node>) => T
  //     del: (acc: T, node: LLNode<Node>) => T
  //   },
  //   name = named(`${_name}.reatomReduce`),
  // ): Atom<T> => {
  //   const acc = atom(init, `${name}._acc`)
  //   const controllers = reatomMap(
  //     (node) =>
  //       atom(
  //         (ctx) => {
  //           acc((state) =>
  //             add(
  //               ctx,
  //               /* is the first calc */ ctx.cause.listeners.size
  //                 ? del(state, node)
  //                 : state,
  //               node,
  //             ),
  //           )
  //         },
  //         named(`${name}._controllers`),
  //       ).extend(
  //         (target) => ({
  //           unsubscribe: ctx.subscribe(target, noop),
  //         }),
  //       ),
  //     {
  //       name: `${name}._controllers`,
  //       onRemove(node, origin) {
  //         acc((state) => del(state, origin))
  //         node.unsubscribe()
  //       },
  //       onClear(mapList) {
  //         for (let head = mapList.head; head; head = head[LL_NEXT]) {
  //           head.unsubscribe()
  //         }
  //         acc(() => init)
  //       },
  //     },
  //   )

  //   onDisconnect(controllers, (ctx) => {
  //     for (let head = ctx.get(controllers).head; head; head = head[LL_NEXT]) {
  //       head.unsubscribe()
  //     }
  //   })

  //   return atom((ctx) => {
  //     ctx.spy(controllers)
  //     return ctx.spy(acc)
  //   }, name)
  // }

  return linkedList.extend(
    () => ({
      LL_PREV,
      LL_NEXT,
      batch,
      create,
      createMany,
      remove,
      removeMany,
      swap,
      move,
      clear,
      reset,

      find,

      array,
      map,
      initiateFromState: createLinkedListFromState,
      initiateFromSnapshot: createLinkedListFromSnapshot,

      reatomMap,
      // reatomFilter,
      // reatomReduce,

      __reatomLinkedList: true as const,
    }),
    withChangeHook((_, prev) => {
      if (prev) {
        _enqueue(() => {
          prev.changes = []
        }, 'cleanup')
      }
    }),
    withFromJson((snapshot) => {
      if (!Array.isArray(snapshot)) {
        throw new ReatomError('Linked list snapshot should be an array.')
      }

      return createLinkedListFromSnapshot(
        snapshot.map((value) => [value] as Params),
      )
    }),
    withToJson((state) => toArray(state)),
  ) as LinkedListAtom<Params, Node, Key>
}

/**
 * Checks whether a value is a linked list atom or a linked-list derivative
 * created by `reatomLinkedList`.
 *
 * @example
 *   // Enable drag-and-drop only for linked lists
 *   const canReorder = (value: unknown) =>
 *     isLinkedListAtom(value) && value().size > 1
 */
export const isLinkedListAtom = (thing: any): thing is LinkedListLikeAtom =>
  thing?.__reatomLinkedList === true
