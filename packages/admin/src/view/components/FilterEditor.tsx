import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import type { FilterMode } from '../../types'
import {
  buttonGhost,
  card,
  colors,
  flex,
  flexWrap,
  gap,
  hideInCompactShell,
  p,
  panelTitle,
} from '../styles'
import { ExpressionGroupEditor } from './ExpressionGroupEditor'
import { FilterConfigCard } from './FilterConfigCard'
import { PredicateBuilder } from './PredicateBuilder'

export interface FilterEditorProps {
  admin: Admin
}

const MODES: Array<{ value: FilterMode; label: string }> = [
  { value: 'show', label: 'Show only' },
  { value: 'hide', label: 'Hide' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'exclude', label: 'Exclude' },
]

export const FilterEditor = ({ admin }: FilterEditorProps) => {
  const engine = admin.filters.engine
  const tags = admin.filters.tags
  const configs = () => engine.configs()
  const draftExpression = () => admin.filters.expression.expression()
  const draftNodeCount = () => draftExpression().children.length
  const confirmClear = atom(false, '_Admin.view.filterEditor.confirmClear')

  let confirmTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleConfirmRevert = () => {
    if (confirmTimer !== null) clearTimeout(confirmTimer)
    confirmTimer = setTimeout(() => {
      confirmClear.set(false)
      confirmTimer = null
    }, 3000)
  }

  const appendTagReference = (tagId: string) => {
    const expression = draftExpression()
    admin.filters.expression.setExpression({
      ...expression,
      children: [...expression.children, { tagId, negated: false }],
    })
  }

  return (
    <div
      data-reatom-name="FilterWorkbench"
      css={`
        display: grid;
        ${gap(2)}
        align-content: start;
        align-items: start;
      `}
    >
      <section
        data-reatom-name="FilterEditor"
        css={`
          ${card}
          ${p(3)}
          display: grid;
          gap: 0.75rem;
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(2)}
            ${flexWrap}
            justify-content: space-between;
            align-items: flex-start;
          `}
        >
          <div>
            <h3
              css={`
                ${panelTitle}
              `}
            >
              Filter studio
            </h3>
            <p
              css={`
                ${hideInCompactShell}
                margin: 0.35rem 0 0;
                color: ${colors.textMuted};
                line-height: 1.45;
                font-size: 0.8rem;
              `}
            >
              Compose reusable tags, build nested expressions, and save them as
              show, hide, highlight, or exclude rules.
            </p>
          </div>
          <button
            type="button"
            css={`
              ${buttonGhost}
              font-size: 0.72rem;
              border-color: ${() =>
                confirmClear() ? colors.error : colors.border};
              color: ${() =>
                confirmClear() ? colors.error : colors.textMuted};
              background: ${() =>
                confirmClear() ? colors.errorSoft : 'transparent'};
            `}
            on:click={() => {
              if (confirmClear()) {
                if (confirmTimer !== null) clearTimeout(confirmTimer)
                confirmClear.set(false)
                engine.clearConfigs()
                return
              }
              confirmClear.set(true)
              scheduleConfirmRevert()
            }}
          >
            {() =>
              confirmClear() ? 'Confirm clear' : 'Clear saved rules'
            }
          </button>
        </div>
      </section>

      <section
        css={`
          display: grid;
          gap: 0.85rem;
          align-content: start;
        `}
      >
        <h3
          css={`
            ${panelTitle}
          `}
        >
          Saved rules
        </h3>
        {() =>
          configs().length === 0 ? (
            <div
              css={`
                color: ${colors.textSubtle};
                font-size: 0.8rem;
              `}
            >
              No saved rules yet. Build a draft expression and save it below.
            </div>
          ) : (
            configs().map((config) => (
              <FilterConfigCard admin={admin} config={config} />
            ))
          )
        }
      </section>

      <div
        css={`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
          gap: 1rem;
          align-items: start;
        `}
      >
        <div
          css={`
            display: grid;
            gap: 1rem;
            align-content: start;
          `}
        >
          <ExpressionGroupEditor admin={admin} />

          <section
            css={`
              ${card}
              ${p(3)}
              display: grid;
              gap: 0.75rem;
            `}
          >
            <div
              css={`
                ${flex}
                ${gap(1)}
                ${flexWrap}
                justify-content: space-between;
                align-items: center;
              `}
            >
              <h3
                css={`
                  ${panelTitle}
                  font-size: 0.9rem;
                `}
              >
                Save draft as rule
              </h3>
              <div
                css={`
                  color: ${colors.textSubtle};
                  font-size: 0.72rem;
                `}
              >
                {() => `Draft nodes: ${draftNodeCount()}`}
              </div>
            </div>
            <div
              css={`
                ${flex}
                ${gap(1)}
                ${flexWrap}
              `}
            >
              {MODES.map((mode) => (
                <button
                  type="button"
                  prop:disabled={() => draftNodeCount() === 0}
                  css={`
                    ${buttonGhost}
                    opacity: ${() => (draftNodeCount() === 0 ? 0.45 : 1)};
                    cursor: ${() =>
                      draftNodeCount() === 0 ? 'not-allowed' : 'pointer'};
                  `}
                  on:click={() => {
                    if (draftNodeCount() === 0) return
                    const defaultName = `${mode.label} rule`
                    admin.filters.engine.addDraftConfig(defaultName, mode.value)
                  }}
                >
                  Save as {mode.label}
                </button>
              ))}
              <button
                type="button"
                css={buttonGhost}
                on:click={() =>
                  admin.filters.expression.setExpression({
                    operator: 'AND',
                    children: [],
                  })
                }
              >
                Reset draft expression
              </button>
            </div>
          </section>

          <section
            css={`
              ${card}
              ${p(3)}
              display: grid;
              gap: 0.75rem;
            `}
          >
            <h3
              css={`
                ${panelTitle}
                font-size: 0.9rem;
              `}
            >
              Available tags
            </h3>
            <div
              css={`
                ${flex}
                ${gap(1)}
                ${flexWrap}
              `}
            >
              {() =>
                tags.tags().map((tag) => (
                  <button
                    type="button"
                    aria-label={`Add ${tag.name} tag to draft expression`}
                    css={`
                      ${buttonGhost}
                      display: inline-flex;
                      align-items: center;
                      background: ${tag.builtIn
                        ? colors.bgElevated
                        : colors.surfaceInteractive};
                      color: ${tag.builtIn ? colors.textMuted : colors.text};
                      font-size: 0.72rem;
                    `}
                    on:click={() => appendTagReference(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))
              }
            </div>
          </section>
        </div>

        <PredicateBuilder admin={admin} />
      </div>
    </div>
  )
}
