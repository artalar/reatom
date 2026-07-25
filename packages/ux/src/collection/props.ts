import type { Computed, Rec } from '@reatom/core'
import { computed, wrap } from '@reatom/core'

import type { CollectionItemNode } from './reatomCollection'

/**
 * Props of a collection item element.
 *
 * The collection itself contributes no ARIA — Ariakit's `Collection` and
 * `CollectionItem` render plain elements, and the roles come from the widget
 * built on top (`composite`, `tab`, `select`, ...). What is genuinely shared is
 * the element handle wiring, so that is all this record carries.
 */
export interface CollectionItemProps {
  /** The item id, also used by `aria-activedescendant` consumers. */
  id: string
  /** Stores the element in the item model; pass `null` on unmount. */
  ref: (element: HTMLElement | null) => void
}

/**
 * Reactive prop record for a collection item element.
 *
 * @remarks
 *   The record is a `computed`, so it is memoized, lazy, traceable by name, and
 *   directly spreadable: `<div $spread={props} />` in `@reatom/jsx`,
 *   `{...props()}` in React, `v-bind` in Vue. The `ref` callback is `wrap`ped
 *   so the element write is attributed to the DOM event that caused it.
 * @example
 *   const collection = reatomCollection({ name: 'files' })
 *   const item = collection.renderItem({ id: 'readme' })
 *   const props = collectionItemProps(item)
 *
 *   props() // { id: 'readme', ref: [Function] }
 *   props().ref(element) // item.element() === element
 */
export const collectionItemProps = <Extra extends Rec = {}>(
  item: CollectionItemNode<Extra>,
  name: string = `${item.name}.props`,
): Computed<CollectionItemProps> =>
  computed(
    () => ({
      id: item.id,
      ref: wrap((element: HTMLElement | null) => {
        item.element.set(element)
      }),
    }),
    name,
  )
