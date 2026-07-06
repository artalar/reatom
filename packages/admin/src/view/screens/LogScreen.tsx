import type { Admin } from '../../index'
import { FilterBar } from '../components/FilterBar'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { InspectorPanel } from '../components/InspectorPanel'
import { LogItem } from '../components/LogItem'
import { StateExplorer } from '../components/StateExplorer'
import {
  card,
  colors,
  flex,
  gap,
  p,
  panelTitle,
} from '../styles'

export interface LogScreenProps {
  admin: Admin
}

export const LogScreen = ({ admin }: LogScreenProps) => {
  const frames = () => {
    const query = admin.filters.search.searchQuery()
    if (query) {
      return admin.filters.search.searchResults()
    }
    return admin.filters.engine.visibleFrames()
  }
  const highlightStyles = () => admin.filters.engine.highlightedFrames()
  const atoms = () => admin.store.getAtoms()
  const selectedFrameId = () => admin.store.selectedFrameId()
  const selectedFrame = () => admin.store.selectedFrame()

  return (
    <div
      css={`
        display: grid;
        gap: 0.85rem;
        min-height: 0;
      `}
    >
      <section
        css={`
          ${card}
          overflow: hidden;
        `}
      >
        <FilterBar admin={admin} />
      </section>
      <div
        css={`
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(19rem, 24rem);
          gap: 1rem;
          min-height: 0;
          align-items: start;

          @container admin-shell (max-width: 680px) {
            grid-template-columns: minmax(0, 1fr);
            gap: 0.85rem;
          }
        `}
      >
        <section
          data-reatom-name="ActivityFeedPanel"
          css={`
            ${card}
            ${p(2)}
            display: grid;
            gap: 0.85rem;
            min-width: 0;
            align-self: start;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              justify-content: space-between;
              align-items: center;
            `}
          >
            <h2
              css={`
                ${panelTitle}
              `}
            >
              Activity feed
            </h2>
            <div
              css={`
                color: ${colors.textSubtle};
                font-size: 0.74rem;
              `}
            >
              {() =>
                `${frames().length} visible · ${admin.store.frameCount()} captured`
              }
            </div>
          </div>

          {() =>
            frames().length === 0 ? (
              <EmptyStateCard
                title="No frames match the current filters"
                description="Clear the search query, disable saved rules, or interact with your app to capture new state transitions."
              />
            ) : (
              <div
                data-reatom-name="ActivityFeedList"
                css={`
                  display: grid;
                  gap: 0.55rem;
                `}
              >
                {frames().map((frame) => (
                  <LogItem
                    frame={frame}
                    atomName={atoms().get(frame.atomId)?.name ?? frame.atomId}
                    highlightStyle={highlightStyles().get(frame.id)}
                    isSelected={selectedFrameId() === frame.id}
                    onSelect={() => {
                      admin.store.selectFrame(frame.id)
                      admin.causeGraph.selectedRootId.set(frame.id)
                    }}
                  />
                ))}
              </div>
            )
          }
        </section>

        <aside
          css={`
            display: grid;
            gap: 1rem;
            align-content: start;
            min-height: 0;
          `}
        >
          {() => <InspectorPanel admin={admin} frame={selectedFrame()} />}
          <section
            css={`
              ${card}
              ${p(3)}
              display: grid;
              gap: 0.85rem;
            `}
          >
            <StateExplorer admin={admin} />
          </section>
        </aside>
      </div>
    </div>
  )
}
