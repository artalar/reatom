import { Action, atom, AtomCache, Ctx, type Rec } from '@reatom/core'
import { h, hf, mount, ctx, JSX } from '@reatom/jsx'
import { followingsMap, getId, highlighted } from './utils'

export const Line = ({ svg, patch }: { svg: SVGElement; patch: AtomCache }) => {
  const containerRec = svg.getBoundingClientRect()
  const n = svg.childElementCount
  const shift = -(10 + n * 10)
  let points = ''   

  const calc = (target: AtomCache, cause: AtomCache) => {
    const targetRec = document.getElementById(getId(target))?.getBoundingClientRect()
    const causeRec = document.getElementById(getId(cause))?.getBoundingClientRect()

    if (!targetRec || !causeRec) return

    const targetX = shift + targetRec.x - containerRec.x
    const targetY = targetRec.y - containerRec.y + targetRec.height / 2

    const causeX = shift + causeRec.x - containerRec.x
    const causeY = causeRec.y - containerRec.y + causeRec.height / 2

    points += `${targetX},${targetY} ${targetX + n * 10},${targetY} ${targetX},${targetY} `
    points += `${causeX},${causeY} ${causeX + n * 10},${causeY} ${causeX},${causeY} `

    highlighted.add(target)
    highlighted.add(cause)
  }

  let target: null | AtomCache = patch
  while (target && target.cause) {
    calc(target, (target = target.cause!))

    if (!target.cause?.cause) break
  }

  for (const target of followingsMap.get(patch) ?? []) {
    calc(target, patch)
  }

  return <svg:polyline stroke={`hsla(${200 + 50 * n}deg 20% 40% / 0.7)`} points={points} fill="none" stroke-width={3} />
}
