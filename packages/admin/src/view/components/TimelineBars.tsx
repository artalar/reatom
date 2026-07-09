import type { Admin } from '../../index'
import type { TimeBucket } from '../../timeline'
import { formatSessionDuration } from '../../timeline'
import { formatTimestamp } from '../format'
import { colors, flex, flexCol, gap, rounded } from '../styles'

export interface TimelineBarsProps {
  admin: Admin
  selectedBucketIndex: number | null
  onSelectBucket: (bucket: TimeBucket, index: number) => void
}

const CHART_HEIGHT_REM = 9
const CHART_HEADER_REM = 1.35

export const TimelineBars = ({
  admin,
  selectedBucketIndex,
  onSelectBucket,
}: TimelineBarsProps) => {
  const buckets = () => admin.timeline.chartBuckets()
  const visibleRange = () => admin.timeline.visibleRange()
  const summary = () => admin.timeline.sessionSummary()
  const maxCount = () =>
    Math.max(1, ...buckets().map((bucket) => bucket.entries.length))

  return (
    <div
      data-reatom-name="TimelineBars"
      css={`
        ${flex}
        ${flexCol}
        ${gap(1)}
        width: 100%;
        min-width: 0;
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(2)}
          flex-wrap: wrap;
          color: ${colors.textSubtle};
          font-size: 0.72rem;
        `}
      >
        <span>
          ■{' '}
          <span
            css={`
              color: ${colors.accent};
            `}
          >
            Frames
          </span>
        </span>
        <span>
          ■{' '}
          <span
            css={`
              color: ${colors.error};
            `}
          >
            Errors
          </span>
        </span>
        <span>
          ■{' '}
          <span
            css={`
              color: ${colors.warning};
            `}
          >
            Selected
          </span>
        </span>
        <span>Taller bars = more frames in that time window</span>
      </div>

      <div
        css={`
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          scrollbar-width: thin;
          min-width: 0;
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(1)}
            align-items: flex-end;
            height: ${CHART_HEIGHT_REM + CHART_HEADER_REM}rem;
            min-width: ${() => `${Math.max(buckets().length * 2.4, 100)}%`};
            padding-top: ${CHART_HEADER_REM}rem;
            padding-bottom: 0.15rem;
            box-sizing: border-box;
          `}
        >
          {() =>
            buckets().map((bucket, index) => {
              const heightRatio = bucket.entries.length / maxCount()
              const barHeightRem = Math.max(
                0.35,
                heightRatio * CHART_HEIGHT_REM,
              )
              const hasError = bucket.errorCount > 0
              const isSelected = selectedBucketIndex === index

              return (
                <button
                  type="button"
                  aria-label={`${bucket.entries.length} frames between ${formatTimestamp(bucket.start)} and ${formatTimestamp(bucket.end)}`}
                  css={`
                    flex: 1 0 1.75rem;
                    width: 1.75rem;
                    background: ${isSelected
                      ? colors.warning
                      : hasError
                        ? colors.error
                        : colors.accent};
                    opacity: ${0.45 + heightRatio * 0.55};
                    border-radius: 8px 8px 0 0;
                    border: 1px solid
                      ${isSelected ? colors.warning : 'transparent'};
                    cursor: pointer;
                    align-self: flex-end;
                    position: relative;
                  `}
                  style={{ height: `${barHeightRem}rem` }}
                  on:click={() => onSelectBucket(bucket, index)}
                >
                  {isSelected && (
                    <span
                      css={`
                        position: absolute;
                        top: -1.15rem;
                        left: 50%;
                        transform: translateX(-50%);
                        ${rounded}
                        padding: 0.1rem 0.3rem;
                        background: ${colors.bgElevated};
                        border: 1px solid ${colors.borderStrong};
                        color: ${colors.text};
                        font-size: 0.62rem;
                        white-space: nowrap;
                        z-index: 1;
                      `}
                    >
                      {bucket.entries.length}
                    </span>
                  )}
                </button>
              )
            })
          }
        </div>
      </div>

      <div
        css={`
          font-size: 0.65rem;
          color: ${colors.textMuted};
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        `}
      >
        {() => {
          const [rangeStart, rangeEnd] = visibleRange()
          const currentSummary = summary()

          return (
            <>
              <span>{formatTimestamp(rangeStart)}</span>
              <span
                css={`
                  ${rounded}
                  padding: 0.2rem 0.45rem;
                  border: 1px solid ${colors.border};
                  background: ${colors.bgElevated};
                `}
              >
                {buckets().length} burst{buckets().length === 1 ? '' : 's'} ·{' '}
                {currentSummary.frameCount} frames ·{' '}
                {formatSessionDuration(currentSummary.durationMs)}
              </span>
              <span>{formatTimestamp(rangeEnd)}</span>
            </>
          )
        }}
      </div>
    </div>
  )
}
