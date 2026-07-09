import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { FilterBar } from '../components/FilterBar'
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

const FEED_RENDER_LIMIT = 200

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

  const renderedFrames = () => {
    const allFrames = frames()
    if (allFrames.length <= FEED_RENDER_LIMIT) return allFrames
    return allFrames.slice(-FEED_RENDER_LIMIT)
  }

  return (
    <div
      data-reatom-name="LogScreen"
      css={`
        display: grid;
        gap: 0.65rem;
        height: 100%;
        min-height: 0;
        grid-template-rows: auto minmax(0, 1fr);
        overflow: hidden;
      `}
    >
      <section
        css={`
          ${card}
          overflow: hidden;
          flex-shrink: 0;
        `}
      >
        <FilterBar admin={admin} />
      </section>
      <div
        css={`
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(17rem, 22rem);
          gap: 0.75rem;
          min-height: 0;
          overflow: hidden;

          @container admin-shell (max-width: 680px) {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: minmax(0, 1.35fr) minmax(0, 1fr);
            gap: 0.65rem;
          }
        `}
      >
        <section
          data-reatom-name="ActivityWorkspace"
          css={`
            ${card}
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
            min-width: 0;
            min-height: 0;
            overflow: hidden;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              ${p(2)}
              padding-bottom: 0.55rem;
              border-bottom: 1px solid ${colors.border};
              flex-shrink: 0;
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
                  grid-template-rows: auto minmax(0, 1fr);
                  gap: 0.5rem;
                  min-height: 0;
                  overflow: hidden;

                  @container admin-shell (max-width: 680px) {
                    padding: 0.55rem;
                    gap: 0.4rem;
                  }
                `}
              >
                <div
                  css={`
                    ${flex}
                    ${gap(1)}
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                  `}
                >
                  <h2
                    css={`
                      ${panelTitle}
                      font-size: 0.9rem;
                    `}
                  >
                    Activity feed
                  </h2>
                  <div
                    css={`
                      color: ${colors.textSubtle};
                      font-size: 0.72rem;
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
                    css={`
                      display: grid;
                      grid-template-rows: ${() =>
                        frames().length > FEED_RENDER_LIMIT
                          ? 'auto minmax(0, 1fr)'
                          : 'minmax(0, 1fr)'};
                      gap: 0.45rem;
                      min-height: 0;
                      overflow: hidden;
                    `}
                  >
                    {() =>
                      frames().length > FEED_RENDER_LIMIT ? (
                        <div
                          css={`
                            color: ${colors.textSubtle};
                            font-size: 0.7rem;
                            flex-shrink: 0;
                          `}
                        >
                          {`Showing latest ${FEED_RENDER_LIMIT} of ${frames().length}`}
                        </div>
                      ) : null
                    }
                    <div
                      data-reatom-name="ActivityFeedList"
                      css={`
                        ${scrollable}
                        min-height: 0;
                        overscroll-behavior: contain;
                        scroll-padding-block: 0.35rem;
                      `}
                    >
                      <div
                        css={`
                          display: flex;
                          flex-direction: column;
                          gap: 0.45rem;
                          padding: 0.55rem 0.2rem 0.65rem;
                          box-sizing: border-box;
                        `}
                      >
                        {() =>
                          renderedFrames().map((frame) => (
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
                          ))
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                css={`
                  ${p(2)}
                  ${scrollable}
                  min-height: 0;
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
            gap: 0.75rem;
            align-content: start;
            min-height: 0;
            min-width: 0;
            ${scrollable}
            overscroll-behavior: contain;
          `}
        >
          {() => <InspectorPanel admin={admin} frame={selectedFrame()} />}
        </aside>
      </div>
    </div>
  )
}
