import type { Ext } from '@reatom/core'
import {
  abortVar,
  action,
  effect,
  isAbort,
  peek,
  withAbort,
  withConnectHook,
  wrap,
} from '@reatom/core'

import type { CollectionItemNode, CollectionModel } from './reatomCollection'

/** Any collection model, whatever its item payload and extra item state are. */
export type AnyCollectionModel = CollectionModel<any, any>

/**
 * Sorts items by the DOM position of their elements, returning the original
 * array when the order already matches.
 *
 * Vendored from `@ariakit/utils` `sortBasedOnDOMPosition` (MIT, © Ariakit
 * FZ-LLC). TODO move to `src/vendor/ariakit-utils/` once more features need the
 * DOM helpers.
 */
export const sortBasedOnDomPosition = <T>(
  items: Array<T>,
  getElement: (item: T) => Element | null | undefined,
): Array<T> => {
  const pairs = items.map((item, index) => [index, item] as const)
  let isOrderDifferent = false

  pairs.sort(([indexA, a], [indexB, b]) => {
    const elementA = getElement(a)
    const elementB = getElement(b)
    if (elementA === elementB) return 0
    if (!elementA) {
      if (indexA < indexB) isOrderDifferent = true
      return 1
    }
    if (!elementB) {
      if (indexA > indexB) isOrderDifferent = true
      return -1
    }
    if (
      elementB.compareDocumentPosition(elementA) &
      Node.DOCUMENT_POSITION_PRECEDING
    ) {
      if (indexA > indexB) isOrderDifferent = true
      return -1
    }
    if (indexA < indexB) isOrderDifferent = true
    return 1
  })

  return isOrderDifferent ? pairs.map(([, item]) => item) : items
}

/**
 * Reorders the collection so that its rendered items follow their DOM position.
 *
 * @remarks
 *   Ariakit keeps a second, DOM-sorted `renderedItems` array. Here the order of
 *   the collection itself is the single source of truth, so the sorted result
 *   is applied to the linked list with `move` calls inside one `batch`, which
 *   keeps item identity — and therefore every per item atom — intact.
 *
 *   Only rendered items participate. Items without elements cannot be placed by
 *   DOM position, so they keep their registration order after the sorted ones.
 * @returns Whether the order changed.
 */
export const applyDomOrder = (collection: AnyCollectionModel): boolean => {
  const items: Array<CollectionItemNode> = peek(collection.renderedItems)
  const sorted = sortBasedOnDomPosition(items, (item) => item.element())

  if (sorted === items) return false

  collection.batch(() => {
    let after: null | CollectionItemNode = null
    for (const node of sorted) {
      collection.move(node, after)
      after = node
    }
  })

  return true
}

export interface DomOrderOptions {
  /**
   * Also re-sort when an `IntersectionObserver` reports that the visibility of
   * an item changed, which is how virtualized and offscreen items end up in the
   * right place. Ignored when the environment has no `IntersectionObserver`.
   *
   * @default true
   */
  observeIntersection?: boolean
}

/**
 * Keeps a collection ordered by the DOM position of its rendered items.
 *
 * @remarks
 *   Registration order and DOM order differ whenever items mount out of order,
 *   are portaled, or are virtualized — see Ariakit's `collection-store.ts`
 *   `sortItems` and its `requestAnimationFrame` + `IntersectionObserver` pair,
 *   which this extension ports.
 *
 *   The Ariakit bookkeeping (`cancelAnimationFrame`, the `firstRun` flag on the
 *   private store, the "bail out if renderedItems haven't changed" guard)
 *   becomes: an `effect` that depends on the rendered items and their elements,
 *   a `sort` action that waits for the next frame so the browser has laid the
 *   new elements out, and `withConnectHook` for the lifetime. `withAbort()`
 *   replaces `cancelAnimationFrame` — a newer sort cancels the pending one —
 *   and sorting converges because `applyDomOrder` is a no-op once the order
 *   matches.
 *
 *   Layer 2: it needs a real DOM. In a non-DOM environment nothing happens and
 *   the collection keeps its registration order.
 * @example
 *   const collection = reatomCollection({ name: 'tabs' }).extend(
 *     withDomOrder(),
 *   )
 *
 *   // registered in mount order, sorted to DOM order on the next frame
 *   collection.renderItem({ id: 'second', element: second })
 *   collection.renderItem({ id: 'first', element: first })
 */
export const withDomOrder = <T extends AnyCollectionModel>({
  observeIntersection = true,
}: DomOrderOptions = {}): Ext<T, T> => {
  return (target) => {
    const sort = action(async () => {
      await wrap(
        typeof requestAnimationFrame === 'function'
          ? new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            )
          : Promise.resolve(),
      )
      applyDomOrder(target)
    }, `${target.name}.domOrder.sort`).extend(withAbort())

    const scheduleSort = () =>
      void sort().catch((error) => {
        if (!isAbort(error)) throw error
      })

    return target.extend(
      withConnectHook(() => {
        effect(() => {
          const elements = target
            .renderedItems()
            .map((item: CollectionItemNode) => item.element())
            .filter((element): element is HTMLElement => !!element)

          if (elements.length < 2) return

          scheduleSort()

          if (
            !observeIntersection ||
            typeof IntersectionObserver !== 'function'
          ) {
            return
          }

          // the observer reports the initial state right away, skip it
          let initial = true
          const last = elements.at(-1)
          let root = elements[0]?.parentElement
          while (root && last && !root.contains(last)) {
            root = root.parentElement
          }

          const observer = new IntersectionObserver(
            wrap(() => {
              if (initial) initial = false
              else scheduleSort()
            }),
            { root: root ?? elements[0]?.ownerDocument.body },
          )

          abortVar.subscribe(() => observer.disconnect())

          for (const element of elements) observer.observe(element)
        }, `${target.name}.domOrder`)
      }),
    )
  }
}
