import type { Admin } from '../../index'
import type { StateTreeNode } from '../../types'
import { formatPreview } from '../format'
import {
  buttonGhost,
  colors,
  flex,
  gap,
  mono,
  panelTitle,
  rounded,
} from '../styles'

export interface StateExplorerProps {
  admin: Admin
}

function renderNode(node: StateTreeNode, admin: Admin): Element {
  if (node.kind === 'group') {
    return (
      <details open>
        <summary
          css={`
            cursor: pointer;
            color: ${colors.text};
            font-weight: 600;
          `}
        >
          {node.label}
        </summary>
        <div
          css={`
            display: grid;
            gap: 0.4rem;
            margin-left: 0.85rem;
            margin-top: 0.45rem;
            padding-left: 0.75rem;
            border-left: 1px solid ${colors.border};
          `}
        >
          {node.children.map((child) => renderNode(child, admin))}
        </div>
      </details>
    )
  }

  return (
    <button
      type="button"
      css={`
        ${buttonGhost}
        display: grid;
        gap: 0.35rem;
        text-align: left;
      `}
      on:click={() => {
        if (node.frameId === undefined) return
        admin.store.selectFrame(node.frameId)
        admin.causeGraph.selectedRootId.set(node.frameId)
      }}
    >
      <div
        css={`
          ${flex}
          ${gap(1)}
          justify-content: space-between;
          align-items: center;
        `}
      >
        <span
          css={`
            color: ${colors.text};
            font-weight: 600;
          `}
        >
          {node.label}
        </span>
        {node.frameId !== undefined && (
          <span
            css={`
              color: ${colors.textSubtle};
              font-size: 0.68rem;
            `}
          >
            #{node.frameId}
          </span>
        )}
      </div>
      <div
        css={`
          ${mono}
          ${rounded}
          padding: 0.45rem 0.55rem;
          border: 1px solid ${colors.border};
          background: ${colors.bgElevated};
          color: ${colors.textMuted};
          white-space: pre-wrap;
          word-break: break-word;
        `}
      >
        {formatPreview(node.value)}
      </div>
    </button>
  )
}

export const StateExplorer = ({ admin }: StateExplorerProps) => {
  const tree = () => {
    const visible = admin.view.visibleStateTree()
    if (visible.length > 0) return visible
    return admin.view.stateTree()
  }

  return (
    <section
      css={`
        display: grid;
        gap: 0.75rem;
      `}
    >
      <div
        css={`
          ${flex}
          justify-content: space-between;
          align-items: center;
        `}
      >
        <h3
          css={`
            ${panelTitle}
          `}
        >
          State explorer
        </h3>
        <span
          css={`
            color: ${colors.textSubtle};
            font-size: 0.72rem;
          `}
        >
          reactive atoms only
        </span>
      </div>

      {() =>
        tree().length === 0 ? (
          <div
            css={`
              color: ${colors.textSubtle};
              font-size: 0.8rem;
            `}
          >
            State values will appear here as soon as the app emits frames.
          </div>
        ) : (
          <div
            css={`
              display: grid;
              gap: 0.6rem;
            `}
          >
            {tree().map((node) => renderNode(node, admin))}
          </div>
        )
      }
    </section>
  )
}
