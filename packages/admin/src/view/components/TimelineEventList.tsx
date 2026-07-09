import type { Admin } from '../../index'
import type { FrameGroup } from '../../timeline'
import { formatPreview, formatTimestamp } from '../format'
import {
  badge,
  buttonGhost,
  colors,
  flex,
  gap,
  mono,
  rounded,
  scrollable,
} from '../styles'

export interface TimelineEventListProps {
  admin: Admin
  selectedTimestamp: number | null
  onSelectTimestamp: (timestamp: number) => void
}

function groupLabel(
  admin: Admin,
  group: FrameGroup,
  groupIndex: number,
): string {
  const actionFrame = group.frames.find((frame) => frame.params !== undefined)
  if (!actionFrame) {
    return `Burst ${groupIndex + 1}`
  }

  const atomName =
    admin.store.getAtoms().get(actionFrame.atomId)?.name ?? actionFrame.atomId

  if (atomName === 'makeMove' || atomName.endsWith('.makeMove')) {
    return `Move ${groupIndex + 1}`
  }

  return atomName
}

export const TimelineEventList = ({
  admin,
  selectedTimestamp,
  onSelectTimestamp,
}: TimelineEventListProps) => {
  const groups = () => admin.timeline.frameGroups()

  if (groups().length === 0) {
    return (
      <div
        css={`
          color: ${colors.textSubtle};
          font-size: 0.8rem;
        `}
      >
        Event bursts will appear here after your app emits frames.
      </div>
    )
  }

  return (
    <div
      data-reatom-name="TimelineEventList"
      css={`
        ${scrollable}
        display: grid;
        gap: 0.65rem;
        max-height: min(22rem, 48vh);
        overscroll-behavior: contain;
        padding-right: 0.15rem;
      `}
    >
      {groups().map((group, groupIndex) => {
        const isSelected = selectedTimestamp === group.timestamp
        const errorCount = group.frames.filter(
          (frame) => frame.error !== null,
        ).length

        return (
          <button
            type="button"
            css={`
              ${buttonGhost}
              display: grid;
              gap: 0.55rem;
              text-align: left;
              border-color: ${isSelected ? colors.accent : colors.borderStrong};
              background: ${isSelected ? colors.highlight : colors.bgElevated};
            `}
            on:click={() => onSelectTimestamp(group.timestamp)}
          >
            <div
              css={`
                ${flex}
                ${gap(1)}
                justify-content: space-between;
                align-items: center;
              `}
            >
              <strong>{groupLabel(admin, group, groupIndex)}</strong>
              <span
                css={`
                  color: ${colors.textSubtle};
                  font-size: 0.7rem;
                `}
              >
                {formatTimestamp(group.timestamp)}
              </span>
            </div>

            <div
              css={`
                ${flex}
                ${gap(1)}
                flex-wrap: wrap;
              `}
            >
              <span
                css={`
                  ${badge}
                  background: ${colors.surface};
                  color: ${colors.textMuted};
                `}
              >
                {group.frames.length} frame
                {group.frames.length === 1 ? '' : 's'}
              </span>
              {errorCount > 0 && (
                <span
                  css={`
                    ${badge}
                    background: ${colors.errorSoft};
                    border-color: ${colors.error};
                    color: ${colors.error};
                  `}
                >
                  {errorCount} error{errorCount === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div
              css={`
                display: grid;
                gap: 0.35rem;
              `}
            >
              {group.frames.slice(0, 4).map((frame) => {
                const atomName =
                  admin.store.getAtoms().get(frame.atomId)?.name ?? frame.atomId

                return (
                  <div
                    css={`
                      ${mono}
                      ${rounded}
                      padding: 0.35rem 0.45rem;
                      border: 1px solid ${colors.border};
                      background: ${colors.bg};
                      color: ${colors.textMuted};
                      font-size: 0.72rem;
                      white-space: pre-wrap;
                      word-break: break-word;
                    `}
                  >
                    <strong
                      css={`
                        color: ${colors.text};
                      `}
                    >
                      {atomName}
                    </strong>
                    {' · '}
                    {formatPreview(
                      frame.params !== undefined ? frame.params : frame.state,
                      64,
                    )}
                  </div>
                )
              })}
              {group.frames.length > 4 && (
                <div
                  css={`
                    color: ${colors.textSubtle};
                    font-size: 0.72rem;
                  `}
                >
                  +{group.frames.length - 4} more in this burst
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
