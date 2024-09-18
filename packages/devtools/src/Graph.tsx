import { Action, atom, AtomCache, Ctx, type Rec } from '@reatom/core'
import { h, hf, mount, ctx } from '@reatom/jsx'
import { reatomLinkedList, reatomString } from '@reatom/primitives'
import { withLocalStorage } from '@reatom/persist-web-storage'
import { reatomZod } from '@reatom/npm-zod'
import { z } from 'zod'
import { parseAtoms } from '@reatom/lens'

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

const isPrivate = (name?: string) => name!.startsWith('_') || /\._/.test(name!)

const idxMap = new WeakMap<AtomCache, string>()
let idx = 0
const getId = (node: AtomCache) => {
  let id = idxMap.get(node)
  if (!id) {
    idxMap.set(node, (id = `${node.proto.name}-${++idx}`))
  }
  return id
}

const touched = new WeakSet<AtomCache>()

const Filters = z.array(
  z.object({
    // name: z.string().readonly(),
    search: z.string(),
    active: z.boolean(),
  }),
)

export const Graph = ({ clientCtx }: { clientCtx: Ctx }) => {
  const name = '_ReatomDevtools.Graph'
  const showPrivate = atom(false, `${name}.showPrivate`).pipe(withLocalStorage(`${name}.showPrivate`))

  const FILTERS_SNAPSHOT_NAME = `${name}.filters`
  const snapshot = localStorage.getItem(FILTERS_SNAPSHOT_NAME)
  const filters = reatomZod(Filters, {
    initState: JSON.parse(snapshot || '[]'),
    sync: (ctx) => {
      lines.clear(ctx)
      ctx.schedule(() => {
        localStorage.setItem(FILTERS_SNAPSHOT_NAME, JSON.stringify(parseAtoms(ctx, filters)))
      })
    },
    name: `${name}.filters`,
  })
  const newFilter = reatomString('', `${name}.newFilter`)

  const list = reatomLinkedList((ctx, patch: AtomCache) => {
    const { isAction, name } = patch.proto
    const color = isAction
      ? name!.endsWith('.onFulfill')
        ? '#e6ab73'
        : name!.endsWith('.onReject')
        ? '#e67373'
        : '#ffff80'
      : '#151134'

    return (
      <li
        css={`
          display: var(--display);
          cursor: pointer;
          &::marker {
            content: '⏺';
            color: var(--bg);
          }
        `}
        css:bg={color}
        css:display={atom((ctx) => {
          if (isPrivate(name) && !ctx.spy(showPrivate)) return 'none'
          return ctx
            .spy(filters.array)
            .every(({ search, active }) => !ctx.spy(active) || name!.includes(ctx.spy(search)))
            ? 'list-item'
            : 'none'
        })}
        id={getId(patch)}
        data-name={name}
        on:click={(ctx) => lines.create(ctx, patch)}
      >
        {name}
      </li>
    )
  }, `${name}.list`)

  const lines = reatomLinkedList((ctx, patch: AtomCache) => {
    const containerRec = svg.getBoundingClientRect()
    const shift = 5 + svg.childElementCount * 30
    let points = ''
    let target: null | AtomCache = patch
    while (target && target.cause) {
      const targetRec = document.getElementById(getId(target))?.getBoundingClientRect()
      const causeRec = document.getElementById(getId((target = target.cause!)))?.getBoundingClientRect()

      if (!touched.has(target /* (cause) */) && target.proto.name !== 'root') {
        console.error(`Invalid cause! (${target.proto.name})`)
      }

      if (!targetRec || !causeRec) continue

      const targetX = shift + targetRec.x - containerRec.x
      const targetY = targetRec.y - containerRec.y + targetRec.height / 2

      const causeX = shift + causeRec.x - containerRec.x
      const causeY = causeRec.y - containerRec.y + causeRec.height / 2

      points += `${targetX - 10},${targetY} ${targetX},${targetY} `
      points += `${causeX},${causeY} ${causeX - 10},${causeY} `
    }

    console.log(points)

    return (
      <svg:polyline
        stroke={`hsla(${200 + 50 * svg.childElementCount}deg 20% 40% / 0.7)`}
        points={points}
        fill="none"
        stroke-width={3}
      />
    )
  })

  showPrivate.onChange(lines.clear)

  const subscribe = () =>
    clientCtx.subscribe(async (logs) => {
      await null
      list.batch(ctx, () => {
        for (const patch of logs) {
          touched.add(patch)
          list.create(ctx, patch)
        }
      })
    })

  const svg = (
    <svg:svg
      css={`
        position: absolute;
        pointer-events: none;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
      `}
    >
      {lines}
    </svg:svg>
  )

  return (
    <section
      css={`
        font-family: monospace;
        position: relative;
      `}
    >
      {svg}
      <fieldset
        css={`
          display: flex;
          gap: 20px;
          margin-left: 20px;
          position: sticky;
          top: 0;
          border: none;
          background: var(--devtools-bg);

          &:before {
            content: '';
            position: absolute;
            top: -30px;
            left: 0;
            width: 100%;
            height: 30px;
            background: var(--devtools-bg);
          }
        `}
      >
        <legend>actions</legend>
        <div
          css={`
            width: 150px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          `}
        >
          <button
            css={`
              background: none;
              border: none;
              cursor: pointer;
            `}
            on:click={(ctx) => list.clear(ctx)}
          >
            clear all logs
          </button>
          <label>
            <input model:checked={showPrivate} />
            show private
          </label>
        </div>
        <fieldset
          css={`
            flex-grow: 1;
            display: flex;
            gap: 20px;
            padding-top: 10px;
          `}
        >
          <legend>filters</legend>
          <form
            css={`
              display: inline-flex;
              align-items: center;
            `}
            on:submit={(ctx, e) => {
              e.preventDefault()
              filters.create(ctx, { search: ctx.get(newFilter), active: true })
              newFilter.reset(ctx)
            }}
          >
            <input model:value={newFilter} />
            <button>add</button>
          </form>
          <div
            css={`
              display: flex;
            `}
          >
            {filters.reatomMap((ctx, filter) => (
              <div
                css={`
                  display: flex;
                  align-items: center;
                  margin-right: 20px;
                `}
              >
                <input model:checked={filter.active} />
                <input placeholder="RegExp" model:value={filter.search} />
                <button on:click={(ctx) => filters.remove(ctx, filter)}>x</button>
              </div>
            ))}
          </div>
        </fieldset>
      </fieldset>
      <ul ref={subscribe}>{list}</ul>
    </section>
  )
}
