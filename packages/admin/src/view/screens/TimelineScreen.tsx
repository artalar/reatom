import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import { formatSessionDuration } from '../../timeline'
import { formatTimestamp } from '../format'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { TimelineBars } from '../components/TimelineBars'
import { TimelineControls } from '../components/TimelineControls'
import { TimelineEventList } from '../components/TimelineEventList'
import {
  formatTimelineSelectionTime,
  TimelineSelectionPanel,
} from '../components/TimelineSelectionPanel'
import {
  badge,
  buttonGhost,
  card,
  colors,
  flex,
  gap,
  p,
  panelTitle,
} from '../styles'

export interface TimelineScreenProps {
  admin: Admin
}

type TimelineViewMode = 'chart' | 'events'

export const TimelineScreen = ({ admin }: TimelineScreenProps) => {
  const selectedBucketIndex = atom<number | null>(
    null,
    '_Admin.view.timeline.bucketIndex',
  )
  const selectedTimestamp = atom<number | null>(
    null,
    '_Admin.view.timeline.eventTimestamp',
  )
  const viewMode = atom<TimelineViewMode | null>(
    null,
    '_Admin.view.timeline.viewMode',
  )

  const resolvedViewMode = (): TimelineViewMode => {
    const manualMode = viewMode()
    if (manualMode !== null) return manualMode
    return admin.timeline.prefersEventList() ? 'events' : 'chart'
  }

  const effectiveBucketIndex = (): number | null => {
    if (resolvedViewMode() !== 'chart') return null

    const manualIndex = selectedBucketIndex()
    if (manualIndex !== null) return manualIndex

    return admin.timeline.busiestChartBucketIndex()
  }

  const selectedBucket = () => {
    const index = effectiveBucketIndex()
    if (index === null) return null
    return admin.timeline.chartBuckets()[index] ?? null
  }

  const effectiveTimestamp = (): number | null => {
    if (resolvedViewMode() !== 'events') return null

    const manualTimestamp = selectedTimestamp()
    if (manualTimestamp !== null) return manualTimestamp

    const groups = admin.timeline.frameGroups()
    if (groups.length === 0) return null

    let busiestTimestamp = groups[0]!.timestamp
    let busiestCount = groups[0]!.frames.length

    for (const group of groups) {
      if (group.frames.length > busiestCount) {
        busiestCount = group.frames.length
        busiestTimestamp = group.timestamp
      }
    }

    return busiestTimestamp
  }

  const selectedGroup = () => {
    const timestamp = effectiveTimestamp()
    if (timestamp === null) return null

    return (
      admin.timeline
        .frameGroups()
        .find((group) => group.timestamp === timestamp) ?? null
    )
  }

  const selectionFrames = () => {
    const bucket = selectedBucket()
    if (bucket) return bucket.entries

    const group = selectedGroup()
    if (group) return group.frames

    return []
  }

  const selectionTitle = () => {
    if (selectedBucket()) return 'Bucket focus'
    if (selectedGroup()) return 'Burst focus'
    return 'Timeline focus'
  }

  const selectionTimeLabel = () => {
    const bucket = selectedBucket()
    if (bucket) {
      return formatTimelineSelectionTime(bucket.start, bucket.end)
    }

    const group = selectedGroup()
    if (group) {
      return formatTimestamp(group.timestamp)
    }

    return null
  }

  const summary = () => admin.timeline.sessionSummary()

  return (
    <div
      css={`
        display: grid;
        gap: 1rem;
        color: ${colors.text};
      `}
    >
      <section
        css={`
          ${card}
          ${p(3)}
          display: grid;
          gap: 1rem;
        `}
      >
        <div
          css={`
            display: grid;
            gap: 0.65rem;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              flex-wrap: wrap;
              justify-content: space-between;
              align-items: flex-start;
            `}
          >
            <div
              css={`
                display: grid;
                gap: 0.45rem;
              `}
            >
              <h2
                css={`
                  ${panelTitle}
                `}
              >
                Session activity
              </h2>
              <p
                css={`
                  margin: 0;
                  color: ${colors.textMuted};
                  line-height: 1.5;
                  max-width: 42rem;
                `}
              >
                See when state changes clustered during this session. Taller
                bars mean more frames were captured in that time window.
              </p>
            </div>

            {() => {
              const currentSummary = summary()
              if (currentSummary.frameCount === 0) return null

              return (
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
                      background: ${colors.accentSoft};
                      border-color: ${colors.accent};
                      color: ${colors.accent};
                    `}
                  >
                    {currentSummary.frameCount} frames
                  </span>
                  <span
                    css={`
                      ${badge}
                      background: ${colors.bgElevated};
                      color: ${colors.textMuted};
                    `}
                  >
                    {formatSessionDuration(currentSummary.durationMs)}
                  </span>
                  <span
                    css={`
                      ${badge}
                      background: ${colors.bgElevated};
                      color: ${colors.textMuted};
                    `}
                  >
                    {currentSummary.burstCount} bursts
                  </span>
                  {currentSummary.errorCount > 0 && (
                    <span
                      css={`
                        ${badge}
                        background: ${colors.errorSoft};
                        border-color: ${colors.error};
                        color: ${colors.error};
                      `}
                    >
                      {currentSummary.errorCount} errors
                    </span>
                  )}
                </div>
              )
            }}
          </div>
        </div>

        <TimelineControls admin={admin} />
      </section>

      <div
        css={`
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 24rem);
          gap: 1rem;
          align-items: start;

          @container admin-shell (max-width: 680px) {
            grid-template-columns: minmax(0, 1fr);
            gap: 0.85rem;
          }
        `}
      >
        <section
          css={`
            ${card}
            ${p(3)}
            display: grid;
            gap: 1rem;
            min-width: 0;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              flex-wrap: wrap;
            `}
          >
            {(
              [
                { id: 'events' as const, label: 'Event list' },
                { id: 'chart' as const, label: 'Histogram' },
              ] as const
            ).map((tab) => (
              <button
                type="button"
                css={`
                  ${buttonGhost}
                  background: ${() =>
                    resolvedViewMode() === tab.id
                      ? colors.highlight
                      : 'transparent'};
                  color: ${() =>
                    resolvedViewMode() === tab.id
                      ? colors.text
                      : colors.textMuted};
                  border-color: ${() =>
                    resolvedViewMode() === tab.id
                      ? colors.accent
                      : colors.borderStrong};
                `}
                on:click={() => viewMode.set(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {() => {
            const currentSummary = summary()

            if (currentSummary.frameCount === 0) {
              return (
                <EmptyStateCard
                  title="No timeline yet"
                  description="Interact with your app to capture frames, then return here to inspect when state changes clustered during the session."
                />
              )
            }

            if (admin.timeline.isPannedOutsideRange()) {
              return (
                <EmptyStateCard
                  title="Timeline panned outside captured range"
                  description="The pan offset moved the chart away from your session data. Reset the timeline or use Auto-fit session to recover."
                />
              )
            }

            if (resolvedViewMode() === 'events') {
              return (
                <TimelineEventList
                  admin={admin}
                  selectedTimestamp={effectiveTimestamp()}
                  onSelectTimestamp={(timestamp) => {
                    selectedTimestamp.set(timestamp)
                    selectedBucketIndex.set(null)
                  }}
                />
              )
            }

            if (admin.timeline.chartBuckets().length === 0) {
              return (
                <EmptyStateCard
                  title="No bursts in the current window"
                  description="Try Auto-fit session or switch to Event list for a frame-by-frame view of short debugging sessions."
                />
              )
            }

            return (
              <TimelineBars
                admin={admin}
                selectedBucketIndex={effectiveBucketIndex()}
                onSelectBucket={(_, index) => {
                  selectedBucketIndex.set(index)
                  selectedTimestamp.set(null)
                }}
              />
            )
          }}
        </section>

        <section
          css={`
            ${card}
            ${p(3)}
            display: grid;
            gap: 1rem;
            min-width: 0;
          `}
        >
          {() => (
            <TimelineSelectionPanel
              admin={admin}
              frames={selectionFrames()}
              title={selectionTitle()}
              timeLabel={selectionTimeLabel()}
            />
          )}
        </section>
      </div>
    </div>
  )
}
