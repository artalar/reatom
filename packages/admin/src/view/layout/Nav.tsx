import { urlAtom } from '@reatom/core'

import type { Admin } from '../../index'
import { badge, buttonGhost, colors, compactOnlyShell, flex, gap, hideInCompactShell, px, py } from '../styles'

export interface NavProps {
  admin: Admin
}

const TAB_PATHS = [
  { path: '/', label: 'Activity', icon: '📋' },
  { path: '/timeline', label: 'Timeline', icon: '📊' },
  { path: '/graph', label: 'Graph', icon: '🔗' },
  { path: '/filters', label: 'Filters', icon: '🧪' },
] as const

export const Nav = ({ admin }: NavProps) => {
  const summary = () => admin.view.summary()

  return (
    <nav
      css={`
        flex-shrink: 0;
        ${flex}
        ${gap(1)}
        ${px(2)}
        ${py(1)}
        background: ${colors.bgElevated};
        border-top: 1px solid ${colors.border};
        justify-content: space-between;
        align-items: center;
        min-height: 0;

        @container admin-shell (max-width: 680px) {
          flex-direction: column;
          align-items: stretch;
          gap: 0.55rem;
          padding-inline: 0.75rem;
          padding-block: 0.55rem;
        }
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(1)}
          min-width: 0;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;

          @container admin-shell (max-width: 680px) {
            justify-content: space-between;
            overflow-x: visible;
          }
        `}
      >
        {TAB_PATHS.map((tab) => {
          const isActive = () =>
            urlAtom().pathname === tab.path ||
            (tab.path === '/' && urlAtom().pathname === '/')
          return (
            <button
              type="button"
              aria-label={tab.label}
              css={`
                ${buttonGhost}
                ${flex}
                ${gap(1)}
                flex: 1 1 auto;
                justify-content: center;
                min-width: 0;
                background: ${() =>
                  isActive() ? colors.highlight : 'transparent'};
                color: ${() => (isActive() ? colors.text : colors.textMuted)};
                border-color: ${() =>
                  isActive() ? colors.accent : colors.borderStrong};

                @container admin-shell (max-width: 680px) {
                  flex-direction: column;
                  gap: 0.2rem;
                  padding-inline: 0.35rem;
                  padding-block: 0.45rem;
                  font-size: 0.68rem;
                }
              `}
              on:click={() => urlAtom.go(tab.path)}
            >
              <span aria-hidden="true">{tab.icon}</span>
              <span
                css={`
                  @container admin-shell (max-width: 680px) {
                    font-size: 0.62rem;
                  }
                `}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      <div
        css={`
          ${flex}
          ${gap(1)}
          flex-wrap: wrap;
          justify-content: flex-end;
          min-width: 0;

          @container admin-shell (max-width: 680px) {
            justify-content: flex-start;
          }
        `}
      >
        {() => {
          const currentSummary = summary()
          return (
            <>
              <span
                css={`
                  ${badge}
                  background: ${colors.bg};
                  color: ${colors.textMuted};
                `}
              >
                {currentSummary.source === 'replay' ? 'Replay' : 'Live'}
              </span>
              <span
                css={`
                  ${hideInCompactShell}
                  ${badge}
                  background: ${colors.bg};
                  color: ${colors.textMuted};
                `}
              >
                {currentSummary.visibleFrames}/{currentSummary.totalFrames} visible
              </span>
              <span
                css={`
                  ${compactOnlyShell}
                  ${badge}
                  background: ${colors.bg};
                  color: ${colors.textMuted};
                  font-variant-numeric: tabular-nums;
                `}
              >
                {currentSummary.visibleFrames}/{currentSummary.totalFrames}
              </span>
              {currentSummary.errorFrames > 0 && (
                <span
                  css={`
                    ${badge}
                    background: ${colors.errorSoft};
                    border-color: ${colors.error};
                    color: ${colors.error};
                  `}
                >
                  {currentSummary.errorFrames} error
                  {currentSummary.errorFrames === 1 ? '' : 's'}
                </span>
              )}
              {currentSummary.highlightedFrames > 0 && (
                <span
                  css={`
                    ${badge}
                    background: ${colors.accentSoft};
                    border-color: ${colors.accent};
                    color: ${colors.accent};
                  `}
                >
                  {currentSummary.highlightedFrames} highlighted
                </span>
              )}
            </>
          )
        }}
      </div>
    </nav>
  )
}
