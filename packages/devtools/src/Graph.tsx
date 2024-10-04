import {
  __root,
  atom,
  AtomCache,
  Ctx,
  toStringKey,
  LinkedListAtom,
  reatomLinkedList,
  reatomResource,
  withDataAtom,
} from '@reatom/framework'
import { h, hf, ctx } from '@reatom/jsx'
import { actionsStates, followingsMap, getColor, getId, history } from './Graph/utils'
import { reatomFilters } from './Graph/reatomFilters'
import { reatomInspector } from './Graph/reatomInspector'
import { reatomLines } from './Graph/reatomLines'

type Props = {
  clientCtx: Ctx
  getColor: typeof getColor
}

export const Graph = ({ clientCtx, getColor }: Props) => {
  const name = '_ReatomDevtools.Graph'

  const list = reatomLinkedList((ctx, patch: AtomCache) => {
    const { isAction, name } = patch.proto
    let { state } = patch
    if (isAction) {
      state = actionsStates.get(patch)
      if (state.length === 1) state = state[0]
    } else {
      history.add(patch)
    }
    const id = getId(patch)
    const color = getColor(patch)

    let stringState: string

    const display = atom((ctx) => {
      const isVisible = ctx.spy(filters.list.array).every(({ search, active }) => {
        if (!ctx.spy(active)) return true

        try {
          return new RegExp(`.*${ctx.spy(search)}.*`).test(name!)
        } catch (error) {
          return true
        }
      })

      if (!isVisible) return 'none'

      const search = ctx.spy(valuesSearch)
      if (search) {
        stringState ??= toStringKey(patch.state)
          .replace(/\[.*?\]/g, `\n`)
          .toLowerCase()

        if (!stringState.includes(search)) return 'none'
      }

      return 'list-item'
    }, `${name}._display`)

    const handleClick = (ctx: Ctx) => {
      lines.highlight(ctx, { svg, patch })
    }

    return (
      <li
        id={id}
        data-name={name}
        on:mouseleave={(ctx, e) => {
          inspector.hide(ctx, e.relatedTarget)
        }}
        css:display={display}
        css={`
          padding: 5px;
          display: var(--display);
          cursor: pointer;
          &::marker {
            content: '';
          }
        `}
      >
        <span
          on:click={handleClick}
          css:type={color}
          css={`
            font-size: 20px;
            padding: 5px;
            color: var(--type);
          `}
        >
          ⛓
        </span>
        <span
          on:mouseenter={(ctx: Ctx) => {
            if (ctx.get(filters.hoverPreview)) {
              inspector.open(ctx, patch)
            }
          }}
          on:click={(ctx, e) => {
            inspector.fix(ctx, patch, e.currentTarget)
          }}
          css:type={color}
          css={`
            font-size: 20px;
            padding: 5px;
            color: var(--type);

            &:after {
              position: absolute;
              left: 40px;
              width: 100px;
              height: 70px;
              margin-top: -20px;
              clip-path: polygon(0 30%, 100% 0, 100% 100%, 0 70%);
            }
            &:hover&:after {
              content: '';
            }
          `}
        >
          🗐
        </span>
        {name}
      </li>
    )
  }, `${name}.list`)

  const lines = reatomLines(`${name}.lines`)

  const filters = reatomFilters(
    { list: list as unknown as LinkedListAtom, lines: lines as unknown as LinkedListAtom },
    `${name}.filters`,
  )
  const valuesSearch = atom((ctx) => {
    const search = ctx.spy(filters.valuesSearch)

    return search.length < 2 ? '' : search.toLocaleLowerCase()
  })

  const inspector = reatomInspector({ filters }, `${name}.inspector`)

  const listHeight = reatomResource(async (ctx) => {
    ctx.spy(list)
    await ctx.schedule(() => new Promise((r) => requestAnimationFrame(r)))
    return `${listEl.clientHeight}px`
  }, `${name}.listHeight`).pipe(withDataAtom('0px')).dataAtom

  const subscribe = () =>
    clientCtx.subscribe(async (logs) => {
      for (let i = 0; i < logs.length; i++) {
        const patch = logs[i]!
        if (patch.proto.isAction) actionsStates.set(patch, patch.state.slice(0))
      }
      await null
      list.batch(ctx, () => {
        for (const patch of logs) {
          followingsMap.add(patch)
          list.create(ctx, patch)
        }
      })
    })

  const svg = (
    <svg:svg
      css:height={listHeight}
      css={`
        position: absolute;
        pointer-events: none;
        width: 100%;
        height: var(--height);
        top: 0;
        left: 0;
      `}
    >
      {lines}
    </svg:svg>
  ) as SVGElement

  const listEl = (
    <ul
      ref={subscribe}
      css={`
        padding-inline-start: 10px;
      `}
    >
      {list}
    </ul>
  )

  const container = (
    <section
      css={`
        max-height: 100%;
        display: flex;
        flex-direction: column;
        font-family: monospace;
        position: relative;
        padding-left: var(--lines);
      `}
    >
      {filters.element}
      {inspector.element}
      <div
        css={`
          overflow: auto;
          position: relative;
          margin-top: 2px;
        `}
      >
        {svg}
        {listEl}
      </div>
    </section>
  )

  return container
}
