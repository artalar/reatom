import type { Admin } from '../../index'
import type { AdminFrame } from '../../types'
import { card, colors, p, panelTitle, scrollable } from '../styles'
import { EmptyStateCard } from './EmptyStateCard'
import { FrameDetail } from './FrameDetail'
import { HistoryPanel } from './HistoryPanel'

export interface InspectorPanelProps {
  admin: Admin
  frame: AdminFrame | null
}

export const InspectorPanel = ({ admin, frame }: InspectorPanelProps) => {
  if (!frame) {
    return (
      <EmptyStateCard
        title="Inspect any frame"
        description="Select an item in the activity feed to inspect structured state, causal links, and the recent history for that atom."
      />
    )
  }

  const atomName = admin.store.getAtoms().get(frame.atomId)?.name ?? frame.atomId

  return (
    <div
      data-reatom-name="InspectorPanel"
      css={`
        display: grid;
        gap: 0.85rem;
        align-content: start;
        min-height: 0;
      `}
    >
      <FrameDetail
        admin={admin}
        frame={frame}
        atomName={atomName}
        onClose={() => admin.store.selectFrame(null)}
      />
      <section
        css={`
          ${card}
          ${p(3)}
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
          Recent history
        </h3>
        <p
          css={`
            margin: 0;
            color: ${colors.textMuted};
            font-size: 0.78rem;
            line-height: 1.45;
          `}
        >
          Jump across previous frames for the same atom.
        </p>
        <div
          css={`
            display: grid;
            gap: 0.5rem;
            ${scrollable}
            max-height: 16rem;
            overscroll-behavior: contain;
          `}
        >
          <HistoryPanel admin={admin} frame={frame} />
        </div>
      </section>
    </div>
  )
}
