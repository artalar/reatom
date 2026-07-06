import type { Admin } from '../../index'
import type { FilterMode } from '../../types'
import {
  buttonBase,
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
          gap: 1rem;
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
                margin: 0.4rem 0 0;
                color: ${colors.textMuted};
                line-height: 1.5;
              `}
            >
              Compose reusable tags, build nested expressions, and save them as
              show, hide, highlight, or exclude rules for different debugging
              workflows.
            </p>
          </div>
          <div
            css={`
              ${flex}
              ${gap(1)}
              ${flexWrap}
              justify-content: flex-end;

              @container admin-shell (max-width: 680px) {
                justify-content: flex-start;
              }
            `}
          >
            <div
              css={`
                color: ${colors.textSubtle};
                font-size: 0.74rem;
                align-self: center;
              `}
            >
              {() => `Draft nodes: ${draftExpression().children.length}`}
            </div>
            {MODES.map((mode) => (
              <button
                type="button"
                css={buttonGhost}
                on:click={() => {
                  const defaultName = `${mode.label} rule`
                  admin.filters.engine.addDraftConfig(defaultName, mode.value)
                }}
              >
                Save as {mode.label}
              </button>
            ))}
            <button
              type="button"
              css={buttonBase}
              on:click={() => engine.clearConfigs()}
            >
              Clear saved rules
            </button>
          </div>
        </div>
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
          `}
        >
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
                  No saved rules yet. Build a draft expression and save it in
                  one of the supported modes.
                </div>
              ) : (
                configs().map((config) => (
                  <FilterConfigCard admin={admin} config={config} />
                ))
              )
            }
          </section>

          <section
            css={`
              ${card}
              ${p(3)}
              display: grid;
              gap: 0.85rem;
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
                `}
              >
                Quick apply
              </h3>
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
                    css={buttonGhost}
                    on:click={() =>
                      engine.addConfig({
                        id: `config-${Date.now()}-${tag.id}`,
                        name: `Show ${tag.name}`,
                        expression: {
                          operator: 'AND',
                          children: [{ tagId: tag.id, negated: false }],
                        },
                        mode: 'show',
                      })
                    }
                  >
                    + {tag.name}
                  </button>
                ))
              }
            </div>
          </section>
        </div>

        <div
          css={`
            display: grid;
            gap: 1rem;
            align-content: start;
          `}
        >
          <ExpressionGroupEditor admin={admin} />
          <PredicateBuilder admin={admin} />
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
                  <span
                    css={`
                      ${buttonGhost}
                      display: inline-flex;
                      align-items: center;
                      background: ${tag.builtIn
                        ? colors.bgElevated
                        : colors.surfaceInteractive};
                      color: ${tag.builtIn ? colors.textMuted : colors.text};
                    `}
                  >
                    {tag.name}
                  </span>
                ))
              }
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
