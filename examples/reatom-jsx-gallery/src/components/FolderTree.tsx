import { commandProps, reatomCommand } from '@reatom/ux'

import {
  currentFolder,
  folderTree,
  folderTreeIsAllSelected,
  folderTreeSidebarVisible,
  reatomFolderTreeNodeUi,
} from '../model'
import type { FolderNode } from '../types'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderRootIcon,
} from './Icons'

const folderSidebarWidth = 240
const folderToggleSize = 34
const folderHeaderRailHeight = 40

const treeNodeCss = `
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  color: var(--text-secondary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }
`

const expandBtnCss = `
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s;
`

const FolderTreeNode = ({
  node,
  depth,
}: {
  node: FolderNode
  depth: number
}) => {
  const { expanded, isSelected } = reatomFolderTreeNodeUi(node.path, depth < 2)
  const hasChildren = node.children.length > 0
  const selectCommandProps = commandProps(
    reatomCommand({ name: `gallery.folder#${node.path}.select` }),
  )

  return (
    <div
      css={`
        padding-left: ${depth * 12}px;
      `}
    >
      <div
        $spread={selectCommandProps.element}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        tabindex={0}
        on:click={() => currentFolder.set(node)}
        data-selected={isSelected}
        css={`
          ${treeNodeCss}
          &:focus-visible {
            outline: 3px solid var(--focus-ring);
            outline-offset: 2px;
          }
          &[data-selected='true'] {
            background: var(--active-bg);
            color: var(--accent);
            box-shadow: inset 0 0 0 var(--border-width) var(--card-border);
          }
        `}
      >
        {hasChildren ? (
          <button
            type="button"
            on:click={(event: MouseEvent) => {
              event.stopPropagation()
              expanded.toggle()
            }}
            aria-label={() =>
              expanded() ? `Collapse ${node.name}` : `Expand ${node.name}`
            }
            data-expanded={expanded}
            css={`
              ${expandBtnCss}
              &[data-expanded='true'] {
                transform: rotate(90deg);
              }
            `}
          >
            <ChevronRightIcon />
          </button>
        ) : (
          <span css="width: 16px; flex-shrink: 0;" />
        )}
        <span css="flex-shrink: 0; font-size: 15px;">
          <FolderIcon />
        </span>
        <span
          css={`
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            min-width: 0;
          `}
        >
          {node.name}
        </span>
        <span css="color: var(--text-muted); font-size: 11px; flex-shrink: 0;">
          {node.imageCount}
        </span>
      </div>

      {hasChildren
        ? () =>
            expanded() ? (
              <div>
                {node.children.map((child) => (
                  <FolderTreeNode node={child} depth={depth + 1} />
                ))}
              </div>
            ) : null
        : null}
    </div>
  )
}

const selectAllCommandProps = commandProps(
  reatomCommand({ name: 'gallery.folder.all.select' }),
)

export const FolderTree = () => (
  <div css="display: flex; height: 100%; position: relative;">
    <div
      data-open={folderTreeSidebarVisible}
      css={`
        width: ${folderSidebarWidth}px;
        min-width: ${folderSidebarWidth}px;
        background-color: var(--panel-bg);
        background-image: var(--surface-bg-image);
        background-size: var(--surface-bg-size);
        border-right: var(--border-width) var(--border-style) var(--border);
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px;
        transition:
          margin-left 0.3s ease,
          opacity 0.3s ease;
        margin-left: -${folderSidebarWidth}px;
        opacity: 0;
        box-shadow: 12px 0 32px var(--shadow);
        backdrop-filter: var(--panel-backdrop-filter);
        clip-path: var(--surface-clip-path);
        &[data-open='true'] {
          margin-left: 0;
          opacity: 1;
        }
      `}
    >
      <div role="tree" aria-label="Folders">
        <div
          $spread={selectAllCommandProps.element}
          role="treeitem"
          aria-selected={folderTreeIsAllSelected}
          tabindex={0}
          on:click={() => currentFolder.set(null)}
          data-selected={folderTreeIsAllSelected}
          css={`
            ${treeNodeCss}
            font-weight: 600;
            margin-bottom: 4px;
            &:focus-visible {
              outline: 3px solid var(--focus-ring);
              outline-offset: 2px;
            }
            &[data-selected='true'] {
              background: var(--active-bg);
              color: var(--accent);
              box-shadow: inset 0 0 0 var(--border-width) var(--card-border);
            }
          `}
        >
          <span css="font-size: 15px;">
            <FolderRootIcon />
          </span>
          <span>All folders</span>
        </div>

        <div css="height: 1px; background: var(--border); margin: 6px 0 10px;" />

        {() => {
          const tree = folderTree()
          if (!tree)
            return (
              <div css="color: var(--text-muted); font-size: 13px; padding: 8px;">
                No folder opened
              </div>
            )
          return <FolderTreeNode node={tree} depth={0} />
        }}
      </div>
    </div>

    <button
      type="button"
      aria-expanded={folderTreeSidebarVisible}
      aria-label={() =>
        folderTreeSidebarVisible() ? 'Hide folder tree' : 'Show folder tree'
      }
      title={() =>
        folderTreeSidebarVisible() ? 'Hide folder tree' : 'Show folder tree'
      }
      on:click={folderTreeSidebarVisible.toggle}
      css={`
        position: absolute;
        top: ${(folderHeaderRailHeight - folderToggleSize) / 2}px;
        z-index: 10;
        width: ${folderToggleSize}px;
        height: ${folderToggleSize}px;
        display: grid;
        place-items: center;
        padding: 0;
        background:
          linear-gradient(135deg, var(--surface-strong), var(--panel-bg)),
          var(--surface-bg-image);
        background-size: auto, var(--surface-bg-size);
        border: var(--border-width) var(--control-border-style)
          var(--card-border);
        color: var(--accent);
        border-radius: var(--radius-round);
        cursor: pointer;
        font-size: 15px;
        line-height: 1;
        box-shadow:
          var(--glow),
          0 10px 24px var(--shadow);
        backdrop-filter: var(--panel-backdrop-filter);
        transform: translateX(-50%);
        transition:
          left 0.3s ease,
          background 0.2s,
          border-color 0.2s,
          color 0.2s,
          box-shadow 0.2s,
          transform 0.2s;
        &:hover {
          background: var(--bg-elevated);
          border-color: var(--accent);
          color: var(--accent-hover);
          transform: translateX(-50%) var(--card-hover-transform);
          box-shadow: var(--card-hover-shadow);
        }
        &:focus-visible {
          outline: 3px solid var(--focus-ring);
          outline-offset: 2px;
        }
        svg {
          display: block;
        }
      `}
      style:left={() =>
        folderTreeSidebarVisible()
          ? `${folderSidebarWidth}px`
          : `${folderToggleSize / 2}px`
      }
    >
      {() =>
        folderTreeSidebarVisible() ? <ChevronLeftIcon /> : <ChevronRightIcon />
      }
    </button>
  </div>
)
