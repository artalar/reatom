import type { Admin } from '../../index'
import type { TimeBucket } from '../../timeline'
import { formatTimestamp } from '../format'
import { colors, flex, flexCol, gap, rounded, scrollable } from '../styles'

export interface TimelineBarsProps {
  admin: Admin
  selectedBucketIndex: number | null
  onSelectBucket: (bucket: TimeBucket, index: number) => void
}

export const TimelineBars = ({
  admin,
  selectedBucketIndex,
  onSelectBucket,
}: TimelineBarsProps) => {
  const buckets = () => admin.timeline.visibleBuckets()
  const visibleRange = () => admin.timeline.visibleRange()
  const maxCount = () => Math.max(1, ...buckets().map((b) => b.entries.length))

  return (
    <div
      css={`
        ${flex}
        ${flexCol}
        ${gap(1)}
        width: 100%;
        min-height: 12rem;
      `}
    >
      <div
        css={`
          ${scrollable}
          flex: 1;
          min-height: 9rem;
          overscroll-behavior: contain;
        `}
      >
        <div
          css={`
            ${flex}
            ${gap(1)}
            align-items: flex-end;
            min-height: 9rem;
            min-width: ${() => `${Math.max(buckets().length * 1.35, 8)}rem`};
            padding-bottom: 0.15rem;
          `}
        >
          {() =>
            buckets().map((bucket, index) => {
              const height = (bucket.entries.length / maxCount()) * 100
              const hasError = bucket.errorCount > 0
              const isSelected = selectedBucketIndex === index

              return (
                <button
                  type="button"
                  title={`${bucket.entries.length} frames, ${bucket.errorCount} errors`}
                  css={`
                    flex: 1 0 1.1rem;
                    width: 1.1rem;
                    min-height: 0.35rem;
                    background: ${isSelected
                      ? colors.warning
                      : hasError
                        ? colors.error
                        : colors.accent};
                    opacity: ${0.3 + (bucket.entries.length / maxCount()) * 0.7};
                    border-radius: 8px 8px 0 0;
                    border: 1px solid ${isSelected
                      ? colors.warning
                      : 'transparent'};
                    cursor: pointer;
                    align-self: flex-end;
                  `}
                  style={{ height: `${Math.max(8, height)}%` }}
                  on:click={() => onSelectBucket(bucket, index)}
                />
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
        `}
      >
        {() => {
          const [rangeStart, rangeEnd] = visibleRange()
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
                {buckets().length} bucket{buckets().length === 1 ? '' : 's'}
              </span>
              <span>{formatTimestamp(rangeEnd)}</span>
            </>
          )
        }}
      </div>
    </div>
  )
}
