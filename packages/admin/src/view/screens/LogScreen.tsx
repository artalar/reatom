import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import { FilterBar } from '../components/FilterBar'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { InspectorPanel } from '../components/InspectorPanel'
import { LogItem } from '../components/LogItem'
import { StateExplorer } from '../components/StateExplorer'
import {
  buttonGhost,
  card,
  colors,
  flex,
  gap,
  p,
  panelTitle,
  scrollable,
} from '../styles'

type ActivityWorkspaceTab = 'feed' | 'state'

export interface LogScreenProps {
  admin: Admin
}

export const LogScreen = ({ admin }: LogScreenProps) => {
  const workspaceTab = atom<ActivityWorkspaceTab>(
    'feed',
    '_Admin.view.logWorkspaceTab',
  )
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
          data-reatom-name="ActivityWorkspace"
          css={`
            ${card}
            display: grid;
            min-width: 0;
            align-self: start;
            overflow: hidden;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              ${p(2)}
              padding-bottom: 0.65rem;
              border-bottom: 1px solid ${colors.border};
            `}
          >
            {(
              [
                { id: 'feed' as const, label: 'Activity feed' },
                { id: 'state' as const, label: 'State explorer' },
              ] as const
            ).map((tab) => (
              <button
                type="button"
                css={`
                  ${buttonGhost}
                  background: ${() =>
                    workspaceTab() === tab.id
                      ? colors.highlight
                      : 'transparent'};
                  color: ${() =>
                    workspaceTab() === tab.id
                      ? colors.text
                      : colors.textMuted};
                  border-color: ${() =>
                    workspaceTab() === tab.id
                      ? colors.accent
                      : colors.borderStrong};
                `}
                on:click={() => workspaceTab.set(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {() =>
            workspaceTab() === 'feed' ? (
              <div
                css={`
                  ${p(2)}
                  display: grid;
                  gap: 0.85rem;
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
                    {`${frames().length} visible · ${admin.store.frameCount()} captured`}
                  </div>
                </div>

                {frames().length === 0 ? (
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
                        atomName={
                          atoms().get(frame.atomId)?.name ?? frame.atomId
                        }
                        highlightStyle={highlightStyles().get(frame.id)}
                        isSelected={selectedFrameId() === frame.id}
                        onSelect={() => {
                          admin.store.selectFrame(frame.id)
                          admin.causeGraph.selectedRootId.set(frame.id)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                css={`
                  ${p(2)}
                  ${scrollable}
                  max-height: min(28rem, 52vh);
                  overscroll-behavior: contain;
                `}
              >
                <StateExplorer admin={admin} />
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
        </aside>
      </div>
    </div>
  )
}
