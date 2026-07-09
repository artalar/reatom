import type { Admin } from '../../index'
import type { CauseGraph } from '../../types'
import {
  badge,
  buttonGhost,
  colors,
  flex,
  flexCol,
  gap,
  mono,
  panelTitle,
  rounded,
} from '../styles'

export interface GraphNodesProps {
  admin: Admin
  graph: CauseGraph
}

export const GraphNodes = ({ admin, graph }: GraphNodesProps) => {
  const atoms = admin.store.getAtoms()
  const direction = admin.causeGraph.direction
  const path = () => admin.causeGraph.path()
  const selectedFrameId = () => admin.store.selectedFrameId()

  const edgeCountForNode = (frameId: number): number =>
    graph.edges.filter(
      (edge) => edge.fromFrameId === frameId || edge.toFrameId === frameId,
    ).length

  return (
    <div
      data-reatom-name="GraphNodes"
      css={`
        ${flex}
        ${flexCol}
        ${gap(2)}
        width: 100%;
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(1)}
          align-items: center;
          flex-wrap: wrap;
        `}
      >
        <h3
          css={`
            ${panelTitle}
          `}
        >
          Graph nodes
        </h3>
        {(['ancestors', 'descendants', 'full'] as const).map((d) => (
          <button
            type="button"
            css={`
              ${buttonGhost}
              padding: 0.35rem 0.7rem;
              border-color: ${() =>
                direction() === d ? colors.accent : colors.borderStrong};
              background: ${() =>
                direction() === d ? colors.accentSoft : colors.bgElevated};
              color: ${() =>
                direction() === d ? colors.accent : colors.textMuted};
              font-size: 0.72rem;
              text-transform: capitalize;
            `}
            on:click={() => direction.set(d)}
          >
            {d}
          </button>
        ))}
        <span
          css={`
            ${badge}
            background: ${colors.bgElevated};
            color: ${colors.textMuted};
            margin-left: auto;
          `}
        >
          {graph.edges.length} edge{graph.edges.length === 1 ? '' : 's'}
        </span>
      </div>
      <div
        css={`
          ${flex}
          ${flexCol}
          ${gap(1)}
          font-size: 0.8rem;
        `}
      >
        {graph.nodes.map((node) => {
          const atom = atoms.get(node.atomId)
          const name = atom?.name ?? node.atomId
          const isRoot = node.frameId === graph.rootFrameId
          const isSelected = () => selectedFrameId() === node.frameId
          const nodeEdgeCount = edgeCountForNode(node.frameId)

          return (
            <div
              css={`
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.45rem;
                align-items: stretch;
                margin-left: ${node.depth * 1.25}rem;
              `}
            >
              <button
                type="button"
                aria-pressed={() => isSelected()}
                css={`
                  ${buttonGhost}
                  display: grid;
                  gap: 0.35rem;
                  text-align: left;
                  border-color: ${() =>
                    isSelected() ? colors.accent : colors.borderStrong};
                  background: ${() =>
                    isSelected()
                      ? colors.highlight
                      : isRoot
                        ? colors.accentSoft
                        : 'transparent'};
                `}
                on:click={() => {
                  admin.store.selectFrame(node.frameId)
                }}
              >
                <div
                  css={`
                    display: flex;
                    justify-content: space-between;
                    gap: 0.5rem;
                    align-items: center;
                    color: ${isRoot ? colors.accent : colors.text};
                  `}
                >
                  <strong>{name}</strong>
                  <span
                    css={`
                      ${rounded}
                      padding: 0.2rem 0.4rem;
                      border: 1px solid ${isRoot
                        ? colors.accent
                        : colors.borderStrong};
                      background: ${isRoot
                        ? colors.accentSoft
                        : colors.bgElevated};
                      color: ${isRoot ? colors.accent : colors.textMuted};
                      font-size: 0.7rem;
                    `}
                  >
                    #{node.frameId}
                  </span>
                </div>
                <div
                  css={`
                    ${mono}
                    color: ${colors.textSubtle};
                    font-size: 0.72rem;
                  `}
                >
                  depth {node.depth}
                  {isRoot ? ' · root' : ''} · {nodeEdgeCount} edge
                  {nodeEdgeCount === 1 ? '' : 's'}
                </div>
              </button>
              <button
                type="button"
                aria-label={`Focus graph on ${name}`}
                css={`
                  ${buttonGhost}
                  align-self: center;
                  font-size: 0.68rem;
                  padding-inline: 0.5rem;
                  white-space: nowrap;
                  border-color: ${isRoot ? colors.accent : colors.borderStrong};
                  color: ${isRoot ? colors.accent : colors.textMuted};
                `}
                on:click={() => {
                  admin.store.selectFrame(node.frameId)
                  admin.causeGraph.selectedRootId.set(node.frameId)
                }}
              >
                Focus
              </button>
            </div>
          )
        })}
      </div>
      {() => {
        const currentPath = path()
        return currentPath && currentPath.length > 0 ? (
          <div
            css={`
              display: grid;
              gap: 0.5rem;
            `}
          >
            <h4
              css={`
                ${panelTitle}
                font-size: 0.85rem;
              `}
            >
              Shortest path
            </h4>
            <div
              css={`
                display: flex;
                flex-wrap: wrap;
                gap: 0.45rem;
              `}
            >
              {currentPath.map((frameId) => (
                <span
                  css={`
                    ${rounded}
                    padding: 0.25rem 0.45rem;
                    border: 1px solid ${colors.borderStrong};
                    background: ${colors.bgElevated};
                    color: ${colors.textMuted};
                    font-size: 0.72rem;
                  `}
                >
                  #{frameId}
                </span>
              ))}
            </div>
          </div>
        ) : null
      }}
    </div>
  )
}
