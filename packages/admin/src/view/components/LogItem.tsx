import type { AdminFrame, HighlightStyle } from '../../types'
import { formatPreview, formatTimestamp } from '../format'
import {
  badge,
  colors,
  flex,
  focusVisible,
  gap,
  mono,
  px,
  rounded,
  truncate,
} from '../styles'

export interface LogItemProps {
  frame: AdminFrame
  atomName: string
  highlightStyle?: HighlightStyle
  isSelected: boolean
  onSelect: () => void
}

export const LogItem = ({
  frame,
  atomName,
  highlightStyle,
  isSelected,
  onSelect,
}: LogItemProps) => {
  const hasError = frame.error !== null
  const content =
    frame.params !== undefined
      ? formatPreview(frame.params)
      : frame.payload !== undefined
        ? formatPreview(frame.payload)
        : formatPreview(frame.state)

  return (
    <div
      data-frame-id={frame.id}
      role="button"
      tabindex={0}
      aria-pressed={isSelected}
      aria-selected={isSelected}
      css={`
        ${flex}
        ${gap(2)}
        ${px(2)}
        padding-block: 0.45rem;
        ${rounded}
        ${focusVisible}
        border: 1px solid ${isSelected
          ? colors.accent
          : highlightStyle?.borderColor ?? colors.border};
        cursor: pointer;
        background: ${isSelected
          ? colors.highlight
          : highlightStyle?.background ?? colors.surface};
        color: ${hasError ? colors.error : colors.text};
        align-items: flex-start;
        box-sizing: border-box;
        overflow: visible;
        flex-shrink: 0;
        box-shadow: ${isSelected
          ? `inset 3px 0 0 ${colors.accent}`
          : 'none'};

        @container admin-shell (max-width: 680px) {
          flex-direction: column;
          gap: 0.35rem;
          padding-block: 0.5rem;
        }
      `}
      on:click={onSelect}
      on:keydown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <span
        data-testid="log-item-timestamp"
        css={`
          flex-shrink: 0;
          width: 4.5rem;
          font-size: 0.65rem;
          color: ${colors.textMuted};

          @container admin-shell (max-width: 680px) {
            width: auto;
          }
        `}
      >
        {formatTimestamp(frame.timestamp)}
      </span>

      <div
        css={`
          display: grid;
          gap: 0.35rem;
          min-width: 5rem;
          max-width: 12rem;
          flex: 0 1 9rem;

          @container admin-shell (max-width: 680px) {
            min-width: 0;
            max-width: none;
            flex: 1 1 auto;
            width: 100%;
          }
        `}
      >
        <strong
          css={`
            ${truncate}
            font-weight: 600;
            display: block;
          `}
        >
          {atomName}
        </strong>
        <div
          css={`
            ${flex}
            ${gap(1)}
            flex-wrap: wrap;
            align-items: center;
            line-height: 1.2;
          `}
        >
          {frame.params !== undefined && (
            <span
              css={`
                ${badge}
                padding-block: 0.15rem;
                background: ${colors.bgElevated};
                color: ${colors.textSubtle};
              `}
            >
              action
            </span>
          )}
          {hasError && (
            <span
              css={`
                ${badge}
                padding-block: 0.15rem;
                background: ${colors.errorSoft};
                color: ${colors.error};
                border-color: ${colors.error};
              `}
            >
              error
            </span>
          )}
        </div>
      </div>

      <span
        css={`
          flex: 1;
          min-width: 0;
          ${mono}
          color: ${highlightStyle?.textColor ?? colors.textMuted};
          white-space: pre-wrap;
          word-break: break-word;
        `}
      >
        {content}
      </span>

      <span
        css={`
          color: ${colors.textSubtle};
          font-size: 0.7rem;
          flex-shrink: 0;
        `}
      >
        #{frame.id}
      </span>
    </div>
  )
}
