import type { Admin } from '../../index'
import { formatDateTime } from '../format'
import {
  badge,
  card,
  colors,
  compactPanelPadding,
  flex,
  flexWrap,
  gap,
  hideInCompactShell,
  p,
  panelTitle,
} from '../styles'
import { SessionControls } from './SessionControls'
import { SummaryCards } from './SummaryCards'

export interface HeaderBarProps {
  admin: Admin
}

export const HeaderBar = ({ admin }: HeaderBarProps) => {
  const session = () => admin.store.currentSession()
  const source = () => admin.store.source()
  const paused = () => admin.reporter.paused()

  return (
    <header
      css={`
        ${card}
        ${p(3)}
        ${compactPanelPadding}
        display: grid;
        gap: 1rem;

        @container admin-shell (max-width: 680px) {
          gap: 0.65rem;
        }
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
          {() => {
            const currentSource = source()
            const isReplay = currentSource === 'replay'
            return (
              <div
                css={`
                  ${badge}
                  width: fit-content;
                  background: ${isReplay
                    ? colors.warningSoft
                    : colors.accentSoft};
                  border-color: ${isReplay ? colors.warning : colors.accent};
                  color: ${isReplay ? colors.warning : colors.accent};
                `}
              >
                {isReplay ? 'Replay analysis' : 'Live devtools'}
              </div>
            )
          }}
          <h1
            css={`
              ${panelTitle}
              margin-top: 0.75rem;
              font-size: 1.25rem;

              @container admin-shell (max-width: 680px) {
                margin-top: 0.45rem;
                font-size: 1.05rem;
              }
            `}
          >
            Reatom Admin
          </h1>
          <p
            css={`
              ${hideInCompactShell}
              margin: 0.4rem 0 0;
              color: ${colors.textMuted};
              line-height: 1.5;
              max-width: 48rem;
            `}
          >
            Inspect activity streams, isolate noisy transitions, understand
            causal chains, and preserve complex debugging sessions without a
            backend.
          </p>
        </div>

        <div
          css={`
            display: grid;
            gap: 0.6rem;
            justify-items: end;

            @container admin-shell (max-width: 680px) {
              justify-items: start;
              gap: 0.35rem;
            }
          `}
        >
          {() => {
            const isPaused = paused()
            return (
              <div
                css={`
                  ${badge}
                  background: ${isPaused
                    ? colors.warningSoft
                    : colors.successSoft};
                  border-color: ${isPaused ? colors.warning : colors.success};
                  color: ${isPaused ? colors.warning : colors.success};
                `}
              >
                {isPaused ? 'Recording paused' : 'Recording active'}
              </div>
            )
          }}
          <div
            data-testid="header-session-meta"
            css={`
              ${hideInCompactShell}
              color: ${colors.textMuted};
              font-size: 0.72rem;
              text-align: right;
            `}
          >
            {() => {
              const currentSession = session()
              return (
                <>
                  <div>Session {currentSession.id}</div>
                  <div>Started {formatDateTime(currentSession.startedAt)}</div>
                </>
              )
            }}
          </div>
        </div>
      </div>

      <SummaryCards admin={admin} />
      <SessionControls admin={admin} />
    </header>
  )
}
