import { parseAtoms, assign, LinkedListAtom, reatomString, Action } from '@reatom/framework'
import { h, hf } from '@reatom/jsx'
import { reatomZod } from '@reatom/npm-zod'
import { z } from 'zod'

const Filters = z.object({
  hoverPreview: z.boolean(),
  inlinePreview: z.boolean(),
  valuesSearch: z.string(),
  list: z.array(
    z.object({
      name: z.string().readonly(),
      search: z.string(),
      include: z.boolean().readonly(),
      active: z.boolean(),
      readonly: z.boolean().readonly(),
    }),
  ),
})
type Filters = z.infer<typeof Filters>

const initState: Filters = {
  hoverPreview: true,
  inlinePreview: false,
  valuesSearch: '',
  list: [{ name: 'private', search: `(^_)|(\._)`, include: false, active: true, readonly: true }],
}

const initSnapshot = JSON.stringify(initState)
const version = 'v12'

export const reatomFilters = (
  {
    list,
    clearLines,
    redrawLines,
  }: { list: LinkedListAtom; clearLines: Action<[], void>; redrawLines: Action<[], void> },
  name: string,
) => {
  const KEY = name + version

  try {
    var snapshot: undefined | Filters = Filters.parse(JSON.parse(localStorage.getItem(KEY) || initSnapshot))
  } catch {}

  const filters = reatomZod(Filters, {
    initState: snapshot || initState,
    sync: (ctx) => {
      redrawLines(ctx)
      ctx.schedule(() => {
        localStorage.setItem(KEY, JSON.stringify(parseAtoms(ctx, filters)))
      })
    },
    name: `${name}.filters`,
  })

  const include = reatomString('', `${name}.include`)
  const exclude = reatomString('', `${name}.exclude`)

  return assign(filters, {
    element: (
      <div>
        <fieldset
          css={`
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-top: 10px;
            margin: 0 20px;
          `}
        >
          <legend>filters</legend>
          <form
            on:submit={(ctx, e) => {
              e.preventDefault()
              const name = ctx.get(include)
              filters.list.create(ctx, {
                name,
                search: name.toLocaleLowerCase(),
                include: true,
                active: true,
                readonly: false,
              })
              include.reset(ctx)
            }}
            css={`
              display: inline-flex;
              align-items: center;
            `}
          >
            <input
              model:value={include}
              placeholder="New filter"
              css={`
                width: 142px;
              `}
            />
            <button
              css={`
                width: 70px;
              `}
            >
              include
            </button>
          </form>
          <form
            on:submit={(ctx, e) => {
              e.preventDefault()
              const name = ctx.get(exclude)
              filters.list.create(ctx, {
                name,
                search: name.toLocaleLowerCase(),
                include: false,
                active: true,
                readonly: false,
              })
              exclude.reset(ctx)
            }}
            css={`
              display: inline-flex;
              align-items: center;
            `}
          >
            <input
              model:value={exclude}
              placeholder="New filter"
              css={`
                width: 142px;
              `}
            />
            <button
              css={`
                width: 70px;
              `}
            >
              exclude
            </button>
          </form>
          <div
            css={`
              display: flex;
              flex-direction: column;
              gap: 5px;
            `}
          >
            {filters.list.reatomMap((ctx, filter) => (
              <div
                css={`
                  display: flex;
                  align-items: center;
                  gap: 5px;
                `}
              >
                <label
                  css={`
                    display: flex;
                    align-items: center;
                    gap: 5px;
                  `}
                >
                  <input model:checked={filter.active} />
                  {filter.name} ({filter.include ? 'include' : 'exclude'}):
                </label>
                <input placeholder="RegExp" model:value={filter.search} readonly={filter.readonly} />
                <button disabled={filter.readonly} on:click={(ctx) => filters.list.remove(ctx, filter)}>
                  x
                </button>
              </div>
            ))}
          </div>
          <input
            model:value={filters.valuesSearch}
            placeholder={'Search in states'}
            type="search"
            css={`
              width: 200px;
            `}
          />
        </fieldset>
        <fieldset
          css={`
            display: flex;
            gap: 10px;
            margin: 0 20px;
            top: 0;
          `}
        >
          <legend>actions</legend>
          <div
            css={`
              width: 150px;
              display: flex;
              align-items: flex-start;
              gap: 14px;
            `}
          >
            <button
              on:click={clearLines}
              css={`
                background: none;
                border: none;
                cursor: pointer;
                flex-shrink: 0;
              `}
            >
              clear lines
            </button>
            <button
              on:click={list.clear}
              css={`
                background: none;
                border: none;
                cursor: pointer;
                flex-shrink: 0;
              `}
            >
              clear logs
            </button>
            <label
              css={`
                flex-shrink: 0;
                display: flex;
                align-items: center;
              `}
            >
              <input model:checked={filters.inlinePreview} />
              inline preview
            </label>
            <label
              css={`
                flex-shrink: 0;
                display: flex;
                align-items: center;
              `}
            >
              <input model:checked={filters.hoverPreview} />
              hover preview
            </label>
          </div>
        </fieldset>
      </div>
    ),
  })
}
