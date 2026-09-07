import type {
  Action,
  Atom,
  Computed,
  LinkedListAtom,
  LLNode,
  Rec,
} from '@reatom/core'
import { action, atom, computed, named, reatomLinkedList } from '@reatom/core'

/**
 * Registration payload of a collection item — plain data, never atoms.
 *
 * Ported from Ariakit's `CollectionStoreItem`
 * (`ariakit-components/src/collection/collection-store.ts`).
 */
export interface CollectionItemInit {
  /**
   * The non-empty id of the item. A stable id is generated from the collection
   * name when omitted, so ids stay the same between the server and the client
   * as long as the registration order matches.
   */
  id?: string
  /**
   * The item element. Usually set right after the registration from a `ref`,
   * see `collectionItemProps`.
   */
  element?: HTMLElement | null
}

/**
 * The atomized per item state every collection item carries.
 *
 * Ariakit stores items as plain objects inside two arrays (`items` and
 * `renderedItems`) and rewrites both arrays on every registration. Here each
 * item is a linked list node with its own atoms, so registering, rendering, or
 * moving an item touches only that item.
 */
export interface CollectionItemModel {
  /** The stable item id. Immutable for the lifetime of the item. */
  id: string
  /** The item unit name prefix, e.g. `select.items#apple`. */
  name: string
  /** The item element handle. Layer 1 never touches the DOM through it. */
  element: Atom<HTMLElement | null>
  /**
   * How many live `registerItem` calls reference this item. The item leaves the
   * collection when it drops to zero.
   */
  registrations: Atom<number>
  /** How many live `renderItem` calls reference this item. */
  renders: Atom<number>
  /** Whether the item is currently rendered, i.e. present in the DOM. */
  rendered: Computed<boolean>
}

/** A collection item as it is stored in the linked list. */
export type CollectionItemNode<Extra extends Rec = {}> = LLNode<
  CollectionItemModel & Extra
>

/** Anything that can address an item: its id, its node, or nothing. */
export type CollectionItemTarget<Extra extends Rec = {}> =
  | string
  | CollectionItemNode<Extra>
  | null
  | undefined

export interface CollectionOptions<
  Init extends CollectionItemInit = CollectionItemInit,
  Extra extends Rec = {},
> {
  /**
   * Atomizes extra per item state from the registration payload. This is the
   * extension point every dependent model uses: `composite` adds `disabled` and
   * `rowId`, `tab` adds the panel id, and so on. Name the extra units after
   * `item.name`, and do not reuse the names of the base fields — they would
   * shadow the item identity the collection relies on.
   *
   * @example
   *   reatomCollection({
   *     create: (init: { id?: string; disabled?: boolean }, item) => ({
   *       disabled: atom(init.disabled ?? false, `${item.name}.disabled`),
   *     }),
   *   })
   */
  create?: (init: Init, item: CollectionItemModel) => Extra
  /**
   * Applies a repeated registration payload to an already registered item.
   * Replaces Ariakit's `{ ...prevItem, ...item }` merge — the `element` is
   * always merged, everything else is up to this callback.
   */
  update?: (init: Init, item: CollectionItemNode<Extra>) => void
  /** Items to register upfront, in order. Explicit ids must be unique. */
  items?: Array<Init>
  /** The model name, used as the prefix of every unit name. */
  name?: string
}

export interface CollectionModel<
  Init extends CollectionItemInit = CollectionItemInit,
  Extra extends Rec = {},
> extends LinkedListAtom<[init?: Init], CollectionItemModel & Extra, 'id'> {
  /**
   * All registered items in collection order — Ariakit's `items` state.
   * Inherited from `reatomLinkedList`.
   */
  array: Computed<Array<CollectionItemNode<Extra>>>
  /** Ids of all registered items, in collection order. */
  ids: Computed<Array<string>>
  /**
   * Items that are currently rendered, in collection order — Ariakit's
   * `renderedItems` state. The array reference is kept while the rendered set
   * and its order do not change, which is what makes `withDomOrder` converge.
   */
  renderedItems: Computed<Array<CollectionItemNode<Extra>>>
  /**
   * Registers an item and returns its node. Registering an already registered
   * id returns the same node and only bumps its reference count, so a
   * re-registration during a mount/unmount race cannot duplicate an item.
   */
  registerItem: Action<[init?: Init], CollectionItemNode<Extra>>
  /**
   * Drops one registration of an item. Returns `true` when the item left the
   * collection, `false` when it is still referenced, unknown, or already
   * removed — unknown ids are normal during mount/unmount races and never
   * throw.
   */
  unregisterItem: Action<[target?: CollectionItemTarget<Extra>], boolean>
  /**
   * Registers an item and marks it as rendered — Ariakit's `renderItem`. Call
   * it when the element is in the DOM, and pass the `element` so that
   * `withDomOrder` can sort by DOM position.
   */
  renderItem: Action<[init?: Init], CollectionItemNode<Extra>>
  /**
   * Undoes a single `renderItem`: drops one render reference and one
   * registration reference. Returns `false` without changing the item when no
   * matching render reference exists.
   */
  unrenderItem: Action<[target?: CollectionItemTarget<Extra>], boolean>
  /**
   * Gets an item by its id, or `null` for an unknown, empty, or nullish id.
   *
   * Ariakit's `item(id)` with the same never-throw contract.
   */
  item: (id?: string | null) => CollectionItemNode<Extra> | null
}

const keepReference = <T>(prev: Array<T>, next: Array<T>): Array<T> =>
  prev.length === next.length && prev.every((value, i) => value === next[i])
    ? prev
    : next

/**
 * Creates a collection model: an ordered, reactive registry of items with
 * stable per item identity and state.
 *
 * @remarks
 *   Ported from Ariakit's `createCollectionStore`. Three Ariakit mechanics are
 *   gone: the `__unstablePrivateStore` + `batch` pair (Reatom coalesces
 *   notifications natively, so N registrations in one tick emit one update),
 *   the whole-array rewrite per registration (items are linked list nodes with
 *   their own atoms), and the `items` / `renderedItems` array duplication
 *   (rendering is a per item reference count, and DOM order is applied to the
 *   list itself by `withDomOrder`).
 *
 *   The model _is_ the linked list, so `array`, `map`, `find`, `move`, `swap`,
 *   and `batch` come from `reatomLinkedList`. Prefer `registerItem` over the
 *   raw `create` action: it deduplicates by id and keeps the reference counts
 *   consistent. Do not register items inside `batch()` — the id lookup reads
 *   the list, which is mid-flight during batching; `batch()` is for bulk
 *   imports and reordering.
 * @example
 *   // Plain collection
 *   const collection = reatomCollection({ name: 'files' })
 *   const readme = collection.renderItem({ id: 'readme' })
 *   collection.ids() // ['readme']
 *   collection.item('readme') === readme // true
 *   collection.unrenderItem(readme)
 *   collection.ids() // []
 *
 * @example
 *   // Atomized per item state, the base for `composite` and friends
 *   const composite = reatomCollection({
 *     create: (init: { id?: string; disabled?: boolean }, item) => ({
 *       disabled: atom(init.disabled ?? false, `${item.name}.disabled`),
 *     }),
 *     name: 'composite',
 *   })
 *
 *   const apple = composite.registerItem({ id: 'apple', disabled: true })
 *   apple.disabled() // true
 *   apple.disabled.set(false)
 */
export const reatomCollection = <
  Init extends CollectionItemInit = CollectionItemInit,
  Extra extends Rec = {},
>(
  options: CollectionOptions<Init, Extra> = {},
): CollectionModel<Init, Extra> => {
  const {
    create,
    update,
    items: initItems,
    name = named('collection'),
  } = options

  const initialIds = new Set<string>()
  for (const init of initItems ?? []) {
    if (init.id === undefined) continue
    if (init.id === '') {
      throw new TypeError('Collection item id cannot be empty')
    }
    if (initialIds.has(init.id)) {
      throw new TypeError(`Duplicate initial collection item id "${init.id}"`)
    }
    initialIds.add(init.id)
  }

  let initialIdSeed = 0
  const initSnapshot = initItems?.map((init): [init?: Init] => {
    if (init.id !== undefined) return [init]

    let id: string
    do id = `${name}-${++initialIdSeed}`
    while (initialIds.has(id))
    initialIds.add(id)

    return [{ ...init, id } as Init]
  })

  const idSeed = atom(initialIdSeed, `${name}._idSeed`)

  const createItem = (init: Init = {} as Init): CollectionItemModel & Extra => {
    if (init.id === '') {
      throw new TypeError('Collection item id cannot be empty')
    }
    const id = init.id ?? createGeneratedId()
    const itemName = `${name}#${id}`
    const renders = atom(0, `${itemName}.renders`)
    const item: CollectionItemModel = {
      id,
      name: itemName,
      element: atom<HTMLElement | null>(
        init.element ?? null,
        `${itemName}.element`,
      ),
      registrations: atom(1, `${itemName}.registrations`),
      renders,
      rendered: computed(() => renders() > 0, `${itemName}.rendered`),
    }

    const extra = create?.(init, item)
    if (extra) {
      for (const key in extra) {
        if (key in item) {
          throw new TypeError(
            `Collection item field "${key}" cannot be replaced`,
          )
        }
      }
      Object.assign(item, extra)
    }

    return item as CollectionItemModel & Extra
  }

  const list = reatomLinkedList(
    {
      create: createItem,
      initSnapshot,
      key: 'id' as const,
    },
    name,
  )

  // the linked list key map, with the `id` key resolved to `string`
  const itemsMap = list.map as unknown as Atom<
    Map<string, CollectionItemNode<Extra>>
  >

  const item = (id?: string | null): CollectionItemNode<Extra> | null =>
    id ? (itemsMap().get(id) ?? null) : null

  const createGeneratedId = (): string => {
    let id: string
    do id = `${name}-${idSeed.set((seed) => seed + 1)}`
    while (item(id))
    return id
  }

  const resolve = (
    target?: CollectionItemTarget<Extra>,
  ): CollectionItemNode<Extra> | null => {
    if (target == null || typeof target === 'string') return item(target)
    // a node of an already removed item is not a member anymore
    return item(target.id) === target ? target : null
  }

  const registerItem = action((init?: Init): CollectionItemNode<Extra> => {
    if (init?.id === undefined) {
      init = { ...init, id: createGeneratedId() } as Init
    }
    const registered = item(init.id)

    if (!registered) return list.create(init)

    registered.registrations.set((count) => count + 1)

    if (init.element !== undefined) registered.element.set(init.element)
    update?.(init, registered)

    return registered
  }, `${name}.registerItem`)

  const unregisterItem = action(
    (target?: CollectionItemTarget<Extra>): boolean => {
      const node = resolve(target)
      if (!node) return false
      if (node.registrations.set((count) => count - 1) > 0) return false
      node.renders.set(0)
      return list.remove(node)
    },
    `${name}.unregisterItem`,
  )

  const renderItem = action((init?: Init): CollectionItemNode<Extra> => {
    const node = registerItem(init)
    node.renders.set((count) => count + 1)
    return node
  }, `${name}.renderItem`)

  const unrenderItem = action(
    (target?: CollectionItemTarget<Extra>): boolean => {
      const node = resolve(target)
      if (!node) return false
      if (node.renders() === 0) return false
      node.renders.set((count) => count - 1)
      return unregisterItem(node)
    },
    `${name}.unrenderItem`,
  )

  const ids = computed(
    (prev: Array<string> = []) =>
      keepReference(
        prev,
        list.array().map((node) => node.id),
      ),
    `${name}.ids`,
  )

  const renderedItems = computed(
    (prev: Array<CollectionItemNode<Extra>> = []) =>
      keepReference(
        prev,
        list.array().filter((node) => node.rendered()),
      ),
    `${name}.renderedItems`,
  )

  return list.extend(() => ({
    ids,
    renderedItems,
    item,
    registerItem,
    unregisterItem,
    renderItem,
    unrenderItem,
  })) as CollectionModel<Init, Extra>
}
