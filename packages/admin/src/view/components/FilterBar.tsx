import type { Admin } from '../../index'
import { buttonGhost, colors, flex, flexWrap, gap, inputLike, px, py } from '../styles'

export interface FilterBarProps {
  admin: Admin
}

const TARGETS: Array<{
  value: 'name' | 'state' | 'params' | 'payload' | 'all'
  label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'name', label: 'Name' },
  { value: 'state', label: 'State' },
  { value: 'params', label: 'Params' },
  { value: 'payload', label: 'Payload' },
]

export const FilterBar = ({ admin }: FilterBarProps) => {
  const search = admin.filters.search
  const builtInTagId = (name: string) =>
    admin.filters.tags.tags().find((tag) => tag.builtIn && tag.name === name)?.id

  const toggleQuickRule = (tagName: string, mode: 'show' | 'hide') => {
    const tagId = builtInTagId(tagName)
    if (!tagId) return

    const existing = admin.filters.engine.configs().find((config) => {
      if (config.name !== `Quick ${tagName}`) return false
      return config.expression.children.some(
        (child) => 'tagId' in child && child.tagId === tagId,
      )
    })

    if (existing) {
      admin.filters.engine.removeConfig(existing.id)
      return
    }

    admin.filters.engine.addConfig({
      id: `quick-${tagName}-${Date.now()}`,
      name: `Quick ${tagName}`,
      expression: {
        operator: 'AND',
        children: [{ tagId, negated: false }],
      },
      mode,
    })
  }

  const hasQuickRule = (tagName: string): boolean => {
    const tagId = builtInTagId(tagName)
    if (!tagId) return false

    return admin.filters.engine.configs().some((config) => {
      if (config.name !== `Quick ${tagName}`) return false
      return config.expression.children.some(
        (child) => 'tagId' in child && child.tagId === tagId,
      )
    })
  }

  return (
    <div
      data-reatom-name="FilterBar"
      css={`
        display: grid;
        gap: 0.75rem;
        ${px(2)}
        padding-block: 0.875rem;

        @container admin-shell (max-width: 680px) {
          padding-inline: 0.75rem;
          padding-block: 0.65rem;
          gap: 0.55rem;
        }
      `}
    >
      <div
        css={`
          display: grid;
          grid-template-columns: minmax(18rem, 1fr) minmax(8rem, auto) auto;
          gap: 0.75rem;
          align-items: center;

          @media (max-width: 880px) {
            grid-template-columns: minmax(14rem, 1fr) minmax(8rem, auto);
          }

          @media (max-width: 640px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <input
          type="search"
          placeholder="Search frames, params, payloads, and state..."
          model:value={search.searchQuery}
          data-testid="filter-search-input"
          css={`
            width: 100%;
            min-width: 0;
            min-height: 2.5rem;
            ${px(2)} ${py(1)}
            ${inputLike}
          `}
        />
        <select
          model:value={search.searchTarget}
          css={`
            width: 100%;
            min-height: 2.5rem;
            ${px(2)} ${py(1)}
            ${inputLike}
          `}
        >
          {TARGETS.map((t) => (
            <option value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          css={`
            ${buttonGhost}
            min-height: 2.5rem;
            white-space: nowrap;

            @media (max-width: 880px) {
              grid-column: 1 / -1;
              justify-self: start;
            }
          `}
          on:click={() => {
            admin.filters.search.searchQuery.set('')
            admin.filters.engine.clearConfigs()
          }}
        >
          Reset
        </button>
      </div>

      <div
        css={`
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.75rem 1rem;
          align-items: center;

          @media (max-width: 760px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(1)}
            ${flexWrap}
          `}
        >
          {[
            { label: 'Errors', tagName: 'error', mode: 'show' as const },
            { label: 'Actions', tagName: 'action', mode: 'show' as const },
            { label: 'State only', tagName: 'reactive', mode: 'show' as const },
          ].map((quickRule) => (
            <button
              type="button"
              aria-pressed={() => hasQuickRule(quickRule.tagName)}
              css={`
                ${buttonGhost}
                border-color: ${() =>
                  hasQuickRule(quickRule.tagName)
                    ? colors.accent
                    : colors.borderStrong};
                background: ${() =>
                  hasQuickRule(quickRule.tagName)
                    ? colors.accentSoft
                    : 'transparent'};
                color: ${() =>
                  hasQuickRule(quickRule.tagName)
                    ? colors.text
                    : colors.textMuted};
              `}
              on:click={() =>
                toggleQuickRule(quickRule.tagName, quickRule.mode)
              }
            >
              {quickRule.label}
            </button>
          ))}
        </div>

        <div
          css={`
            color: ${colors.textSubtle};
            font-size: 0.72rem;
            justify-self: end;
            text-align: right;

            @media (max-width: 760px) {
              justify-self: start;
              text-align: left;
            }
          `}
        >
          {() =>
            `${search.resultCount()} result(s) · ${admin.filters.engine.configs().length} active rule(s)`
          }
        </div>
      </div>
    </div>
  )
}
