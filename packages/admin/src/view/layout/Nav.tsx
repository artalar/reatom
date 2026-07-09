import { urlAtom } from '@reatom/core'

import type { Admin } from '../../index'
import {
  badge,
  buttonGhost,
  colors,
  flex,
  gap,
  px,
  py,
} from '../styles'

export interface NavProps {
  admin: Admin
}

type TabPath = '/' | '/timeline' | '/graph' | '/filters'

const TAB_PATHS: Array<{ path: TabPath; label: string }> = [
  { path: '/', label: 'Activity' },
  { path: '/timeline', label: 'Timeline' },
  { path: '/graph', label: 'Graph' },
  { path: '/filters', label: 'Filters' },
]

function TabIcon({ path }: { path: TabPath }) {
  if (path === '/') {
    return (
      <svg:svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <svg:path
          d="M2.5 3.5h9M2.5 7h9M2.5 10.5h6"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg:svg>
    )
  }

  if (path === '/timeline') {
    return (
      <svg:svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <svg:path
          d="M3 11V7.5M7 11V3.5M11 11V6"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
        />
      </svg:svg>
    )
  }

  if (path === '/graph') {
    return (
      <svg:svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
      >
        <svg:circle
          cx="3.5"
          cy="3.5"
          r="1.6"
          stroke="currentColor"
          stroke-width="1.2"
        />
        <svg:circle
          cx="10.5"
          cy="3.5"
          r="1.6"
          stroke="currentColor"
          stroke-width="1.2"
        />
        <svg:circle
          cx="7"
          cy="10.5"
          r="1.6"
          stroke="currentColor"
          stroke-width="1.2"
        />
        <svg:path
          d="M4.8 4.2L6.2 9.2M9.2 4.2L7.8 9.2"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg:svg>
    )
  }

  return (
    <svg:svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <svg:path
        d="M2.5 3.5h9L8.2 7.6V11l-2.4-1.2V7.6L2.5 3.5Z"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
    </svg:svg>
  )
}

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
          gap: 0.45rem;
          padding-inline: 0.75rem;
          padding-block: 0.45rem;
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
                align-items: center;
                min-width: 0;
                min-height: 1.85rem;
                padding-inline: 0.55rem;
                padding-block: 0.3rem;
                font-size: 0.72rem;
                background: ${() =>
                  isActive() ? colors.highlight : 'transparent'};
                color: ${() => (isActive() ? colors.text : colors.textMuted)};
                border-color: ${() =>
                  isActive() ? colors.accent : colors.borderStrong};

                @container admin-shell (max-width: 680px) {
                  flex-direction: column;
                  gap: 0.15rem;
                  padding-inline: 0.3rem;
                  padding-block: 0.35rem;
                  font-size: 0.62rem;
                }
              `}
              on:click={() => urlAtom.go(tab.path)}
            >
              <TabIcon path={tab.path} />
              <span>{tab.label}</span>
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
          align-items: center;

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
            </>
          )
        }}
      </div>
    </nav>
  )
}
