import type { Admin } from '../../index'
import type { AdminFrame } from '../../types'
import { formatPreview, formatTimestamp } from '../format'
import { badge, buttonGhost, colors, flex, gap, mono, rounded } from '../styles'

export interface HistoryPanelProps {
  admin: Admin
  frame: AdminFrame
}

export const HistoryPanel = ({ admin, frame }: HistoryPanelProps) => {
  const history = () =>
    admin.store
      .frames()
      .filter((entry) => entry.atomId === frame.atomId && entry.id !== frame.id)
      .slice(-8)
      .reverse()

  if (history().length === 0) {
    return (
      <div
        css={`
          color: ${colors.textSubtle};
          font-size: 0.8rem;
        `}
      >
        No prior frames for this atom in the current session.
      </div>
    )
  }

  return (
    <div
      css={`
        display: grid;
        gap: 0.65rem;
      `}
    >
      {() =>
        history().map((entry) => (
          <button
            type="button"
            css={`
              ${buttonGhost}
              display: grid;
              gap: 0.35rem;
              text-align: left;
            `}
            on:click={() => {
              admin.store.selectFrame(entry.id)
              admin.causeGraph.selectedRootId.set(entry.id)
            }}
          >
            <div
              css={`
                ${flex}
                ${gap(1)}
                justify-content: space-between;
                align-items: center;
              `}
            >
              <span
                css={`
                  ${badge}
                  background: ${colors.bgElevated};
                  color: ${colors.textMuted};
                  pointer-events: none;
                `}
              >
                #{entry.id}
              </span>
              <span
                css={`
                  color: ${colors.textSubtle};
                  font-size: 0.7rem;
                `}
              >
                {formatTimestamp(entry.timestamp)}
              </span>
            </div>
            <div
              css={`
                ${mono}
                ${rounded}
                padding: 0.45rem 0.55rem;
                border: 1px solid ${colors.border};
                background: ${colors.bgElevated};
                color: ${colors.text};
                white-space: pre-wrap;
                word-break: break-word;
              `}
            >
              {formatPreview(entry.state)}
            </div>
          </button>
        ))
      }
    </div>
  )
}
