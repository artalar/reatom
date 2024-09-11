import { Action, atom, AtomCache, Ctx, type Rec } from '@reatom/core'
import { h, hf, mount, ctx } from '@reatom/jsx'
import { reatomLinkedList } from '@reatom/primitives'
import { reaction } from '@reatom/framework'

interface DevtoolsMeta {
  x: number
  y: number
  textX: number
  textY: number
  color: string
  index: number
  version: number
}
interface AtomCacheWithGraph extends AtomCache {
  devtools: DevtoolsMeta
}

const isPatchWithGraph = (patch: null | AtomCache): patch is AtomCacheWithGraph => {
  return !!patch && 'devtools' in patch
}

const forEachCause = (cause: AtomCacheWithGraph, cb: (cause: AtomCacheWithGraph) => void) => {
  cb(cause)
  if (isPatchWithGraph(cause?.cause)) forEachCause(cause.cause, cb)
}

export const Graph = ({ clientCtx }: { clientCtx: Ctx }) => {
  const name = '_Graph'
  const r = 10
  const stroke = r / 2
  const xGap = r * 2
  const yGap = r * 3
  const x = xGap
  let y = yGap
  let index = 0
  let version = 0
  const width = atom(400, `${name}.width`)
  const filter = atom('', `${name}.filter`)

  const un = clientCtx.subscribe(async (logs) => {
    await null
    list.batch(ctx, () => {
      for (const patch of logs) {
        if (isPatchWithGraph(patch)) console.error('DOUBLE')
        const { isAction, name } = patch.proto

        // if (name!.startsWith('_') || name!.includes('._')) continue

        const textX = x + r * 1.5
        const textY = y + r / 2
        const color = isAction ? (name!.endsWith('.onFulfill') ? '#E6DC73' : '#ffff80') : '#151134'
        const pathDevtools = Object.assign(patch, { devtools: { x, y, textX, textY, color, index, version } })

        y += yGap
        index++

        pathDevtools

        list.create(ctx, pathDevtools)
      }
    })
  })

  const list = reatomLinkedList((ctx, patch: AtomCacheWithGraph) => {
    const { cause, devtools } = patch
    const { x, y, textX, textY, color, index } = devtools
    let line

    if (cause && isPatchWithGraph(cause) && cause.devtools.version === version) {
      var causeIdx = cause.devtools.index
      const lineX = Math.floor(x + r)
      const lineCauseY = causeIdx * yGap + yGap
      const linePatchY = index * yGap + yGap
      const shiftX = xGap + r + (index - causeIdx) * (stroke + 1)
      const shiftY = Math.floor(lineCauseY + (linePatchY - lineCauseY) / 2)

      const newWidth = Math.max(ctx.get(width), shiftX + xGap * 2)
      if (ctx.get(width) !== newWidth) width(ctx, newWidth)

      const start = `${lineX},${lineCauseY}`
      const middle = `${shiftX},${shiftY}`
      const end = `${lineX},${linePatchY}`

      line = (
        <svg:polyline
          css={`
            stroke: var(${'--hoverHighlight' + causeIdx}, var(${'--clickHighlight' + causeIdx}, rgba(0, 0, 0, 0.1)));
          `}
          on:pointerenter={(ctx, e) =>
            forEachCause(cause, ({ devtools: { index } }) =>
              ref.style.setProperty('--hoverHighlight' + index, 'rgba(0, 0, 0, 0.8)'),
            )
          }
          on:pointerleave={(ctx, e) =>
            forEachCause(cause, ({ devtools: { index } }) => ref.style.removeProperty('--hoverHighlight' + index))
          }
          on:click={() =>
            forEachCause(cause, ({ devtools: { index } }) =>
              ref.style.setProperty('--clickHighlight' + index, 'rgba(0, 0, 0, 0.8)'),
            )
          }
          points={`${start} ${middle} ${end}`}
          fill="none"
          stroke-width={stroke}
        />
      )
    }

    const jsx = (
      <svg:g
        css={`
          cursor: pointer;
          opacity: var(--opacity);
        `}
        css:opacity={atom((ctx) =>
          patch.proto.name?.toLocaleLowerCase().includes(ctx.spy(filter).toLocaleLowerCase()) ? '1' : '0.4',
        )}
        on:click={() => ref.style.setProperty('--clickHighlight' + index, 'rgba(0, 0, 0, 0.8)')}
      >
        <svg:circle
          on:pointerenter={(ctx, e) => ref.style.setProperty('--hoverHighlight' + index, 'rgba(0, 0, 0, 0.8)')}
          on:pointerleave={(ctx, e) => ref.style.removeProperty('--hoverHighlight' + index)}
          cx={x}
          cy={y}
          r={r}
          fill={color}
        />
        <svg:text
          css={`
            font-family: monospace;
            color: black;
            font-size: ${r * 1.5}px;
          `}
          on:pointerenter={(ctx, e) => ref.style.setProperty('--hoverHighlight' + index, 'rgba(0, 0, 0, 0.8)')}
          on:pointerleave={(ctx, e) => ref.style.removeProperty('--hoverHighlight' + index)}
          x={textX}
          y={textY}
          font-size={r.toString()}
          fill="gray"
        >
          {patch.proto.name}
        </svg:text>
        {line}
      </svg:g>
    )

    return jsx
  })

  const ref = (
    <svg:svg
      ref={() => () => un()}
      width={atom((ctx) => `${ctx.spy(width)}px`)}
      height={atom((ctx) => `${ctx.spy(list).size * yGap + 2 * yGap}px`)}
      on:click={(ctx, e) => {
        if (e.target === e.currentTarget) {
          // TODO is there another way to reset the style?
          // @ts-expect-error
          ref.style = {}
        }
      }}
    >
      {list}
    </svg:svg>
  )

  return (
    <>
      <button
        css={`
          display: block;
          margin-left: ${xGap / 2}px;
          padding: 0;
          border: none;
          background: none;
          color: #7f7f7f;
          cursor: pointer;
          font-size: 1em;
        `}
        on:click={(ctx) => {
          y = yGap
          index = 0
          version++
          width(ctx, 400)
          filter(ctx, '')
          list.clear(ctx)
        }}
      >
        clear
      </button>
      <input
        css={`
          display: block;
          margin: ${xGap / 2}px 0 0 ${xGap / 2}px;
          background: none;
          border: 1px solid gray;
        `}
        placeholder="filter"
        model:value={filter}
      />
      {ref}
    </>
  )
}
