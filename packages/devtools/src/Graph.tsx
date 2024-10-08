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
  Atom,
  parseAtoms,
  action,
} from '@reatom/framework'
import { h, hf, ctx } from '@reatom/jsx'
import { actionsStates, followingsMap, getColor, getId, history } from './Graph/utils'
import { reatomFilters } from './Graph/reatomFilters'
import { reatomInspector } from './Graph/reatomInspector'
import { reatomLines } from './Graph/reatomLines'
import { ObservableHQ } from './ObservableHQ'

type Props = {
  clientCtx: Ctx
  getColor: typeof getColor
  width: Atom<string>
  height: Atom<string>
}

export const Graph = ({ clientCtx, getColor, width, height }: Props) => {
  const name = '_ReatomDevtools.Graph'

  const list = reatomLinkedList(
    {
      key: 'id',
      create(ctx, patch: AtomCache) {
        followingsMap.add(patch)
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

        // TODO: reatomFilter
        const display = atom((ctx) => {
          const isVisible = ctx.spy(filters.list.array).every(({ search, type }) => {
            const _type = ctx.spy(type)

            if (_type === 'off') return true

            try {
              const result = new RegExp(`.*${ctx.spy(search)}.*`, 'i').test(name!)

              if (_type === 'match') return result

              return !result
            } catch (error) {
              return true
            }
          })

          if (!isVisible) return 'none'

          const search = ctx.spy(valuesSearch)
          if (search) {
            stringState ??= toStringKey(patch.state)
              .replace(/\[reatom .*?\]/g, `\n`)
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
              font-size: 16px;
              &::marker {
                content: '';
              }
            `}
          >
            <button
              title="Cause lines"
              aria-label="Draw a cause lines"
              on:click={handleClick}
              css:type={color}
              css={`
                border: none;
                background: none;
                font-size: 20px;
                padding: 5px;
                color: var(--type);
                margin-left: 10px;
              `}
            >
              ⛓
            </button>
            <button
              title="Inspector"
              aria-label="Open inspector"
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
                border: none;
                background: none;
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
            </button>
            {name}
            {atom((ctx) => (ctx.spy(filters.inlinePreview) ? <ObservableHQ snapshot={state} /> : <span />))}
          </li>
        )
      },
    },
    `${name}.list`,
  )

  const lines = reatomLines(`${name}.lines`)
  list.clear.onCall(lines.clear)

  const redrawLines = action((ctx) => lines.redraw(ctx, svg), `${name}.redrawLines`)

  const filters = reatomFilters(
    { list: list as unknown as LinkedListAtom, clearLines: lines.clear, redrawLines },
    `${name}.filters`,
  )
  const valuesSearch = atom((ctx) => {
    const search = ctx.spy(filters.valuesSearch)

    return search.length < 2 ? '' : search.toLocaleLowerCase()
  })

  const inspector = reatomInspector({ filters }, `${name}.inspector`)

  const listHeight = reatomResource(async (ctx) => {
    ctx.spy(list)
    ctx.spy(width)
    ctx.spy(height)
    parseAtoms(ctx, filters)
    await ctx.schedule(() => new Promise((r) => requestAnimationFrame(r)))
    return `${listEl.getBoundingClientRect().height}px`
  }, `${name}.listHeight`).pipe(withDataAtom('0px')).dataAtom

  const subscribe = () =>
    clientCtx.subscribe(async (logs) => {
      const insertStates = new Map<AtomCache, 0 | 1>()
      for (let i = 0; i < logs.length; i++) {
        const patch = logs[i]!
        insertStates.set(patch, 0)
        if (patch.proto.isAction) actionsStates.set(patch, patch.state.slice(0))
      }

      await null

      const exludes = ctx
        .get(filters.list.array)
        .filter(({ type }) => ctx.get(type) === 'exclude')
        .map(({ search }) => ctx.get(search))
      const isPass = (patch: AtomCache) =>
        exludes.every((search) => !new RegExp(`.*${search}.*`, 'i').test(patch.proto.name!))

      // fix the case when "cause" appears in the logs after it patch
      const insert = (patch: AtomCache) => {
        const cause = patch.cause!
        if (insertStates.get(cause) === 0) {
          if (cause.cause) insert(cause.cause)
          if (isPass(cause)) list.create(ctx, cause)
          insertStates.set(cause, 1)
        }
        if (insertStates.get(patch) === 0) {
          if (isPass(patch)) list.create(ctx, patch)
          insertStates.set(patch, 1)
        }
      }
      list.batch(ctx, () => {
        for (const patch of logs) {
          insert(patch)
        }
      })
    })

  const svg = (
    <svg:svg
      css:height={listHeight}
      css:pe={atom((ctx) => (ctx.spy(lines).size ? 'auto' : 'none'))}
      css={`
        position: absolute;
        width: calc(100% - 70px);
        height: var(--height);
        top: 0;
        left: 70px;
        pointer-events: var(--pe);
      `}
    >
      {lines}
    </svg:svg>
  ) as SVGElement

  const listEl = (
    <ul
      ref={subscribe}
      css={`
        padding: 0;
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
