import type { Admin } from '../../index'
import { CauseGraphControls } from '../components/CauseGraphControls'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { GraphNodes } from '../components/GraphNodes'
import { card, colors, p, panelTitle } from '../styles'

export interface CauseGraphScreenProps {
  admin: Admin
}

export const CauseGraphScreen = ({ admin }: CauseGraphScreenProps) => {
  const graph = () => admin.causeGraph.graph()
  const selectedFrameId = () => admin.store.selectedFrameId()

  return (
    <div
      data-reatom-name="CauseGraphWorkspace"
      css={`
        display: grid;
        gap: 1rem;
        color: ${colors.text};
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        align-content: start;
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
            Causal graph
          </h2>
          <p
            css={`
              margin: 0;
              color: ${colors.textMuted};
              line-height: 1.5;
            `}
          >
            Traverse upstream causes and downstream consequences from any
            selected frame, then search for the shortest path across visible
            transitions.
          </p>
        </div>
        <CauseGraphControls admin={admin} />
      </section>

      <section
        css={`
          ${card}
          ${p(3)}
          display: grid;
          gap: 1rem;
        `}
      >
        {() => {
          const resolvedGraph = graph()
          const selectedId = selectedFrameId()
          if (!resolvedGraph && !selectedId) {
            return (
              <EmptyStateCard
                title="Select a frame to start graph analysis"
                description="Choose any activity item to make it the root of the causal graph and then explore ancestors, descendants, or the combined path."
              />
            )
          }
          if (!resolvedGraph) {
            return (
              <EmptyStateCard
                title="No graph nodes for this frame"
                description="The selected frame has no visible causal relationships in the current dataset or active filters."
              />
            )
          }
          return <GraphNodes admin={admin} graph={resolvedGraph} />
        }}
      </section>
    </div>
  )
}
