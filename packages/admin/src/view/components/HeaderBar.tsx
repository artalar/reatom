import type { Admin } from '../../index'
import { formatDateTime } from '../format'
import {
  badge,
  buttonGhost,
  colors,
  flex,
  focusVisible,
  gap,
} from '../styles'
import { SessionControls } from './SessionControls'
import { SummaryCards } from './SummaryCards'

/** Clears the fixed corner resize grip painted over the docked shell. */
const RESIZE_GRIP_CLEARANCE = '2rem'

export interface HeaderBarProps {
  admin: Admin
  onMinimize?: () => void
}

export const HeaderBar = ({ admin, onMinimize }: HeaderBarProps) => {
  const session = () => admin.store.currentSession()
  const source = () => admin.store.source()

  return (
    <header
      data-reatom-name="HeaderBar"
      css={`
        display: grid;
        gap: 0.3rem;
        padding-block: 0.3rem;
        padding-inline: ${RESIZE_GRIP_CLEARANCE} 0.4rem;
        background: ${colors.bgElevated};
        border-radius: 8px;
        border: 1px solid ${colors.border};
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(1)}
          align-items: center;
          justify-content: space-between;
          min-width: 0;
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(1)}
            align-items: center;
            min-width: 0;
            flex: 1 1 auto;
            overflow: hidden;
          `}
        >
          <span
            css={`
              font-size: 0.74rem;
              font-weight: 700;
              letter-spacing: 0.01em;
              color: ${colors.text};
              white-space: nowrap;
              flex-shrink: 0;
            `}
          >
            Reatom Admin
          </span>

          {() => {
            const currentSource = source()
            const isReplay = currentSource === 'replay'
            return (
              <span
                css={`
                  ${badge}
                  flex-shrink: 0;
                  background: ${isReplay
                    ? colors.warningSoft
                    : colors.accentSoft};
                  border-color: ${isReplay ? colors.warning : colors.accent};
                  color: ${isReplay ? colors.warning : colors.accent};
                `}
              >
                {isReplay ? 'Replay' : 'Live'}
              </span>
            )
          }}

          <span
            data-testid="header-session-meta"
            css={`
              color: ${colors.textSubtle};
              font-size: 0.64rem;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              min-width: 0;
            `}
          >
            {() => {
              const currentSession = session()
              return `Session ${currentSession.id} · ${formatDateTime(currentSession.startedAt)}`
            }}
          </span>
        </div>

        {onMinimize ? (
          <button
            type="button"
            aria-label="Minimize devtools"
            css={`
              ${buttonGhost}
              width: 1.6rem;
              height: 1.6rem;
              min-height: 1.6rem;
              padding: 0;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              color: ${colors.textMuted};
              ${focusVisible}
            `}
            on:click={() => onMinimize()}
          >
            <svg:svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <svg:path
                d="M2.5 6h7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg:svg>
          </button>
        ) : null}
      </div>

      <SessionControls admin={admin} />

      <SummaryCards admin={admin} />
    </header>
  )
}
