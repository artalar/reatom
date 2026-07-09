import type { Admin } from '../../index'
import type { AdminFrame } from '../../types'
import { formatPreview, formatTimestamp } from '../format'
import {
  buttonGhost,
  colors,
  flex,
  gap,
  mono,
  panelTitle,
  rounded,
  scrollable,
} from '../styles'

export interface TimelineSelectionPanelProps {
  admin: Admin
  frames: Array<AdminFrame>
  title: string
  timeLabel: string | null
}

export const TimelineSelectionPanel = ({
  admin,
  frames,
  title,
  timeLabel,
}: TimelineSelectionPanelProps) => {
  if (frames.length === 0) {
    return (
      <div
        css={`
          color: ${colors.textSubtle};
          font-size: 0.8rem;
        `}
      >
        Select a burst in the chart or event list to inspect the frames captured
        during that moment.
      </div>
    )
  }

  return (
    <div
      css={`
        display: grid;
        gap: 0.75rem;
        min-height: 0;
      `}
    >
      <h3
        css={`
          ${panelTitle}
        `}
      >
        {title}
      </h3>
      <div
        css={`
          color: ${colors.textMuted};
          font-size: 0.78rem;
          line-height: 1.5;
        `}
      >
        {timeLabel && <div>{timeLabel}</div>}
        <div>{frames.length} frame(s) captured</div>
      </div>

      <div
        css={`
          ${scrollable}
          display: grid;
          gap: 0.55rem;
          max-height: min(18rem, 42vh);
          overscroll-behavior: contain;
          padding-right: 0.15rem;
        `}
      >
        {frames.map((frame) => {
          const atomName =
            admin.store.getAtoms().get(frame.atomId)?.name ?? frame.atomId

          return (
            <button
              type="button"
              css={buttonGhost}
              on:click={() => {
                admin.store.selectFrame(frame.id)
                admin.causeGraph.selectedRootId.set(frame.id)
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
                <strong>{atomName}</strong>
                <span
                  css={`
                    color: ${colors.textSubtle};
                    font-size: 0.7rem;
                  `}
                >
                  #{frame.id}
                </span>
              </div>
              <div
                css={`
                  ${mono}
                  ${rounded}
                  margin-top: 0.45rem;
                  padding: 0.4rem 0.5rem;
                  background: ${colors.bgElevated};
                  border: 1px solid ${colors.border};
                  color: ${colors.textMuted};
                  white-space: pre-wrap;
                  word-break: break-word;
                `}
              >
                {formatPreview(
                  frame.params !== undefined ? frame.params : frame.state,
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function formatTimelineSelectionTime(
  start: number,
  end: number,
): string {
  if (start === end) {
    return formatTimestamp(start)
  }

  return `${formatTimestamp(start)} → ${formatTimestamp(end)}`
}
