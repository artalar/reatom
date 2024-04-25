import {
  atom,
  concurrent,
  LinkedListAtom,
  LLNode,
  Rec,
} from '@reatom/framework'
import { JSX } from '@reatom/jsx'
import { onEvent } from '@reatom/web'

export const lastDropTargetElement = atom(
  null as null | { element: JSX.Element; item: LLNode },
  'lastDropTargetElement',
)
lastDropTargetElement.onChange(
  concurrent((ctx, target) => {
    if (target) {
      onEvent(ctx, document, 'pointermove').then(() =>
        lastDropTargetElement(ctx, null),
      )
    }
  }),
)

export function Dragable<Tag extends keyof JSX.HTMLElementTags, T extends Rec>({
  as,
  list,
  item,
  followX = true,
  followY = true,
  children,
  css,
}: {
  as: Tag
  list: LinkedListAtom<any[], T>
  item: LLNode<T>
  followX?: boolean
  followY?: boolean
  children?: JSX.ElementChildren
  css?: string
} & JSX.HTMLElementTags[Tag]) {
  const Tag = as as 'div'
  const xStart = atom(0)
  const yStart = atom(0)
  const x = atom(0)
  const y = atom(0)
  const z = atom('unset')

  return (
    <Tag
      css={`
        translate: calc(var(--x) * 1px) calc(var(--y) * 1px);
        position: relative;
        z-index: var(--z);
        ${css}
      `}
      css:x={x}
      css:y={y}
      css:z={z}
      on:pointerdown={(ctx, e) => {
        xStart(ctx, e.clientX)
        yStart(ctx, e.clientY)
      }}
      on:pointerup={(ctx, e) => {
        xStart(ctx, 0)
        yStart(ctx, 0)
      }}
      on:pointermove={(ctx, e) => {
        if (ctx.get(xStart) || ctx.get(yStart)) {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.setPointerCapture(e.pointerId)
            z(ctx, (1e10).toString())
            // drop focus for interactive element if the drag was start by click on it
            e.currentTarget.focus()
          }
          if (followX) x(ctx, e.clientX - ctx.get(xStart))
          if (followY) y(ctx, e.clientY - ctx.get(yStart))
          // prevent selection
          e.preventDefault()
        }
      }}
      on:lostpointercapture={(ctx, e) => {
        xStart(ctx, 0)
        yStart(ctx, 0)
        x(ctx, 0)
        y(ctx, 0)
        z(ctx, 'unset')
        const element = document
          .elementsFromPoint(e.clientX, e.clientY)
          .find(
            (el) => el !== e.currentTarget && !e.currentTarget.contains(el),
          ) as JSX.Element
        if (element) {
          lastDropTargetElement(ctx, { item, element })
        }
      }}
      on:pointerover={(ctx, e) => {
        const last = ctx.get(lastDropTargetElement)

        if (
          last &&
          (last.element === e.currentTarget ||
            e.currentTarget.contains(last.element))
        ) {
          list.swap(ctx, item, last.item as LLNode<T>)
        }
      }}
    >
      {children}
    </Tag>
  )
}
