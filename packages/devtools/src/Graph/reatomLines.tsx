import { action, Action, atom, AtomCache, Ctx, type Rec } from '@reatom/framework'
import { h, hf } from '@reatom/jsx'
import { followingsMap, getId, getStartCause, highlighted } from './utils'
import { reatomLinkedList } from '@reatom/primitives'

interface Params {
  patch: AtomCache
  svg: SVGElement
}

export const reatomLines = (name: string) => {
  const lines = reatomLinkedList(
    {
      // key: 'id',
      create(ctx, { svg, patch }: Params) {
        const n = svg.childElementCount
        const containerRec = svg.getBoundingClientRect()
        let points = ''

        const calc = (to: AtomCache, from: AtomCache): null | AtomCache => {
          const toRec = document.getElementById(getId(to))?.getBoundingClientRect()
          const fromEl = document.getElementById(getId(from))
          const fromRec = fromEl?.getBoundingClientRect()

          if (!toRec || !fromRec) {
            return from
          }

          // @ts-expect-error
          if (highlighted.has(to) || fromEl?.computedStyleMap().get('display')?.value === 'none') {
            return from.cause && calc(to, from.cause)
          }

          const toX = 60 + toRec.x + -containerRec.x
          const toY = toRec.y + toRec.height / 2 - containerRec.y

          const fromX = 60 + fromRec.x + -containerRec.x
          const fromY = fromRec.y + fromRec.height / 2 - containerRec.y

          const middleX = toX + (toY - fromY) / 10
          const middleY = fromY + (toY - fromY) / 2

          points += `${toX},${toY} ${middleX},${middleY} ${fromX},${fromY} `

          highlighted.add(to)
          highlighted.add(from)

          return from
        }

        let target: null | AtomCache = patch
        while (target && target.cause) {
          target = calc(target, target.cause!)

          if (!target?.cause?.cause) break
        }

        const followings = followingsMap.get(patch) ?? []

        // for (const target of [patch, ...followings]) {
        //   calc(target, patch)
        // }

        return (
          <svg:polyline
            stroke={`hsla(${200 + 50 * n}deg 20% 40% / 0.5)`}
            points={points}
            fill="none"
            stroke-width={3}
            css={`
              &:hover {
                /* TODO doesn't work coz the svg pointer-event */
                stroke-width: 6;
              }
            `}
          />
        )
      },
    },
    name,
  )

  const highlight = action((ctx, { svg, patch }: Params) => {
    // const patch = getStartCause(patch)
    if (!highlighted.has(patch)) lines.create(ctx, { svg, patch })
  })

  return Object.assign(lines, { highlight })
}
