import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { TimelineBars } from '../components/TimelineBars'
import { TimelineControls } from '../components/TimelineControls'
import { TimelineSelectionPanel } from '../components/TimelineSelectionPanel'
import { card, colors, p, panelTitle } from '../styles'

export interface TimelineScreenProps {
  admin: Admin
}

export const TimelineScreen = ({ admin }: TimelineScreenProps) => {
  const selectedBucketIndex = atom<number | null>(null, '_Admin.view.timeline.bucketIndex')
  const selectedBucket = () => {
    const index = selectedBucketIndex()
    if (index === null) return null
    return admin.timeline.visibleBuckets()[index] ?? null
  }

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
            gap: 0.45rem;
          `}
        >
          <h2
            css={`
              ${panelTitle}
            `}
          >
            Timeline analytics
          </h2>
          <p
            css={`
              margin: 0;
              color: ${colors.textMuted};
              line-height: 1.5;
            `}
          >
            Understand how bursts of state changes cluster over time, then zoom
            into the busiest windows and jump back into the feed.
          </p>
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
          `}
        >
          {() =>
            admin.timeline.buckets().length === 0 ? (
              <EmptyStateCard
                title="No timeline yet"
                description="Timeline buckets will appear after your app emits frames into the active admin session."
              />
            ) : (
              <TimelineBars
                admin={admin}
                selectedBucketIndex={selectedBucketIndex()}
                onSelectBucket={(_, index) => selectedBucketIndex.set(index)}
              />
            )
          }
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
          {() => <TimelineSelectionPanel admin={admin} bucket={selectedBucket()} />}
        </section>
      </div>
    </div>
  )
}
