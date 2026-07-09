import type { Admin } from '../../index'
import {
  buttonGhost,
  colors,
  flex,
  flexWrap,
  focusVisible,
  gap,
  inputLike,
  px,
  py,
} from '../styles'

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
    admin.filters.tags.tags().find((tag) => tag.builtIn && tag.name === name)
      ?.id

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
        gap: 0.4rem;
        ${px(2)}
        padding-block: 0.5rem;

        @container admin-shell (max-width: 680px) {
          padding-inline: 0.55rem;
          padding-block: 0.4rem;
          gap: 0.35rem;
        }
      `}
    >
      <div
        css={`
          display: flex;
          flex-wrap: nowrap;
          gap: 0.4rem;
          align-items: center;
          min-width: 0;

          @container admin-shell (max-width: 420px) {
            flex-wrap: wrap;
          }
        `}
      >
        <input
          type="search"
          placeholder="Search frames, params, payloads, and state..."
          model:value={search.searchQuery}
          data-testid="filter-search-input"
          css={`
            flex: 1 1 10rem;
            min-width: 0;
            ${px(2)} ${py(1)}
            ${inputLike}
            min-height: 1.85rem;
            font-size: 0.78rem;
            ${focusVisible}

            @container admin-shell (max-width: 420px) {
              flex: 1 1 100%;
            }
          `}
        />
        <select
          model:value={search.searchTarget}
          css={`
            flex: 0 0 auto;
            width: auto;
            min-width: 4.5rem;
            ${px(1)} ${py(1)}
            ${inputLike}
            min-height: 1.85rem;
            font-size: 0.78rem;
            ${focusVisible}

            @container admin-shell (max-width: 420px) {
              flex: 1 1 auto;
            }
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
            flex: 0 0 auto;
            min-height: 1.85rem;
            padding-inline: 0.55rem;
            padding-block: 0.25rem;
            font-size: 0.72rem;
            white-space: nowrap;
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
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 0.65rem;
          align-items: center;
          justify-content: space-between;
          min-width: 0;
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(1)}
            ${flexWrap}
            min-width: 0;
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
                min-height: 1.55rem;
                padding-inline: 0.45rem;
                padding-block: 0.2rem;
                font-size: 0.7rem;
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
            font-size: 0.68rem;
            white-space: nowrap;
            flex-shrink: 0;
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
