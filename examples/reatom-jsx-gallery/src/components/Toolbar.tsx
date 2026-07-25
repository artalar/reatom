import type { Computed } from '@reatom/core'
import type { CompositeItemProps, RadioItemProps } from '@reatom/ux'

import { isFileSystemAccessSupported } from '../filesystem'
import {
  clearSelectionToolbarItem,
  clearSelection,
  folderTree,
  openFolder,
  resolvedThemeMode,
  searchQuery,
  selectionToolbar,
  selectAllToolbarItem,
  selectAllImages,
  selectedCount,
  themeToggleTooltip,
  toggleResolvedThemeMode,
  viewModeRadio,
  visibleIndexMap,
} from '../model'
import {
  FilterIcon,
  GalleryMarkIcon,
  GridIcon,
  ListIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TableIcon,
} from './Icons'
import {
  activeFilterCount,
  filterPanelOpen,
  settingsPanelOpen,
} from './panelState'
import { locallyPositionedTooltipProps, radioButtonProps } from './uxProps'

const ToolbarButton = ({
  label,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  itemProps,
}: {
  label: string
  onClick: () => void
  variant?: 'default' | 'accent'
  disabled?: boolean
  title?: string
  itemProps?: Computed<CompositeItemProps>
}) => (
  <button
    $spread={itemProps ?? {}}
    type="button"
    on:click={onClick}
    data-terminal-bracket="true"
    prop:disabled={disabled}
    title={title}
    css={`
      padding: 7px 13px;
      font-size: 13px;
      font-weight: 650;
      border: var(--border-width) var(--control-border-style)
        var(--input-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      background: ${variant === 'accent' ? 'var(--accent)' : 'var(--input-bg)'};
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      color: ${variant === 'accent'
        ? 'var(--accent-contrast)'
        : 'var(--text-primary)'};
      box-shadow: ${variant === 'accent' ? 'var(--glow)' : 'none'};
      text-transform: var(--control-transform);

      &:hover {
        background: ${variant === 'accent'
          ? 'var(--accent-hover)'
          : 'var(--hover-bg)'};
        border-color: ${variant === 'accent'
          ? 'var(--accent-hover)'
          : 'var(--text-muted)'};
        transform: var(--card-hover-transform);
        box-shadow: ${variant === 'accent'
          ? 'var(--card-hover-shadow)'
          : 'none'};
      }
      &:disabled {
        cursor: not-allowed;
        opacity: 0.62;
        filter: grayscale(0.18);
      }
      &:disabled:hover {
        background: ${variant === 'accent'
          ? 'var(--accent)'
          : 'var(--input-bg)'};
        border-color: ${variant === 'accent'
          ? 'var(--accent)'
          : 'var(--input-border)'};
        transform: none;
        box-shadow: ${variant === 'accent' ? 'var(--glow)' : 'none'};
      }
    `}
  >
    {label}
  </button>
)

const ViewModeButton = ({
  mode,
  icon,
  props,
  isActive,
}: {
  mode: 'grid' | 'list' | 'table'
  icon: () => Element
  props: Computed<RadioItemProps>
  isActive: () => boolean
}) => (
  <button
    $spread={radioButtonProps(props)}
    type="button"
    class="glass-lens"
    attr:data-active={isActive}
    title={`${mode} view`}
    aria-label={`${mode} view`}
    css={`
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: var(--border-width) var(--control-border-style) transparent;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;
      background: transparent;
      color: var(--text-secondary);

      &[data-active='true'] {
        background: var(--accent);
        color: var(--accent-contrast);
        border-color: var(--accent);
        box-shadow: var(--glow);
      }
      &:not([data-active='true']):hover {
        background: var(--hover-bg);
        color: var(--text-primary);
      }
    `}
  >
    {icon()}
  </button>
)

export const Toolbar = () => (
  <header
    css={`
      display: flex;
      align-items: center;
      gap: calc(12px + var(--shadow-clearance, 0px));
      padding: 10px calc(18px + var(--shadow-clearance, 0px))
        calc(10px + var(--shadow-clearance, 0px)) 18px;
      background: var(--toolbar-bg);
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      border-bottom: var(--border-width) var(--border-style) var(--card-border);
      backdrop-filter: var(--toolbar-backdrop-filter);
      box-shadow:
        var(--glow),
        0 12px 32px var(--shadow);
      clip-path: var(--surface-clip-path);
      flex-shrink: 0;
      min-height: 56px;
      z-index: 100;
      overflow-x: auto;
    `}
  >
    <div
      css={`
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      `}
    >
      <span
        css={`
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.3px;
          user-select: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        `}
      >
        <span
          css={`
            width: 28px;
            height: 28px;
            border-radius: var(--radius-md);
            background:
              radial-gradient(
                circle at 30% 20%,
                var(--hero-glow-1),
                transparent 52%
              ),
              linear-gradient(135deg, var(--accent), var(--accent-hover));
            color: var(--accent-contrast);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow:
              var(--glow),
              0 10px 24px var(--shadow);
          `}
        >
          <GalleryMarkIcon />
        </span>
        Gallery
      </span>

      <ToolbarButton
        label="Open"
        onClick={() => openFolder()}
        variant="accent"
        disabled={!isFileSystemAccessSupported()}
        title={
          isFileSystemAccessSupported()
            ? 'Open a local image folder'
            : 'File System Access is unavailable in this browser'
        }
      />

      {() => {
        const tree = folderTree()
        if (!tree) return <span />
        return (
          <span
            css={`
              font-size: 13px;
              color: var(--text-secondary);
              max-width: 160px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            `}
          >
            {tree.name}
          </span>
        )
      }}
    </div>

    <div
      css={`
        width: 1px;
        height: 24px;
        background: var(--border);
        flex-shrink: 0;
      `}
    />

    <div
      $spread={viewModeRadio.props.group}
      aria-label="View mode"
      css={`
        display: flex;
        gap: calc(4px + var(--shadow-clearance, 0px));
        flex-shrink: 0;
      `}
    >
      {(
        [
          ['grid', GridIcon],
          ['list', ListIcon],
          ['table', TableIcon],
        ] as const
      ).map(([mode, icon]) => {
        const item = viewModeRadio.item(mode)
        return (
          <ViewModeButton
            mode={mode}
            icon={icon}
            props={viewModeRadio.props.item(item, {
              name: `${item.name}.toolbarProps`,
            })}
            isActive={item.checked}
          />
        )
      })}
    </div>

    <div
      $spread={selectionToolbar.props.separator}
      css={`
        width: 1px;
        height: 24px;
        background: var(--border);
        flex-shrink: 0;
      `}
    />

    <div
      $spread={selectionToolbar.props.base}
      aria-label="Selection"
      css={`
        display: flex;
        align-items: center;
        gap: calc(8px + var(--shadow-clearance, 0px));
        flex-shrink: 0;
      `}
    >
      {() => {
        const count = selectedCount()
        if (count === 0) return <span />
        return (
          <span
            css={`
              font-size: 13px;
              color: var(--accent);
              font-weight: 500;
              white-space: nowrap;
              background: var(--accent-soft);
              border: var(--border-width) var(--control-border-style)
                var(--card-border);
              border-radius: var(--radius-round);
              padding: 4px 9px;
            `}
          >
            {count} selected
          </span>
        )
      }}
      <ToolbarButton
        label="All"
        onClick={() => selectAllImages()}
        itemProps={selectionToolbar.props.item(selectAllToolbarItem)}
      />
      <ToolbarButton
        label="Clear"
        onClick={() => clearSelection()}
        itemProps={selectionToolbar.props.item(clearSelectionToolbarItem)}
      />
    </div>

    <div css="flex: 1;" />

    <div
      css={`
        display: flex;
        align-items: center;
        gap: calc(8px + var(--shadow-clearance, 0px));
        flex-shrink: 0;
      `}
    >
      <div css="position: relative; display: flex; align-items: center;">
        <span
          css={`
            position: absolute;
            left: 10px;
            font-size: 13px;
            color: var(--text-muted);
            pointer-events: none;
          `}
        >
          <SearchIcon />
        </span>
        <input
          type="search"
          placeholder="Search images..."
          aria-label="Search images"
          model:value={searchQuery}
          css={`
            width: 190px;
            padding: 7px 11px 7px 32px;
            font-size: 13px;
            background: var(--input-bg);
            border: var(--border-width) var(--control-border-style)
              var(--input-border);
            border-radius: var(--radius-round);
            color: var(--text-primary);
            outline: none;
            transition: all 0.15s ease;

            &::placeholder {
              color: var(--text-muted);
            }
            &:focus {
              border-color: var(--accent);
              box-shadow:
                0 0 0 3px var(--focus-ring),
                var(--glow);
            }
          `}
        />
      </div>

      <span
        css={`
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
        `}
      >
        {() => {
          const count = visibleIndexMap().size
          return count > 0 ? `${count} images` : ''
        }}
      </span>
    </div>

    <div
      css={`
        width: 1px;
        height: 24px;
        background: var(--border);
        flex-shrink: 0;
      `}
    />

    <div css="display: flex; gap: calc(4px + var(--shadow-clearance, 0px)); flex-shrink: 0;">
      <button
        $spread={filterPanelOpen.props.disclosure}
        type="button"
        title="Filters"
        aria-label={() => {
          const count = activeFilterCount()
          return count > 0 ? `Filters, ${count} active` : 'Filters'
        }}
        aria-expanded={filterPanelOpen}
        css={`
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          background: transparent;
          border: var(--border-width) var(--control-border-style) transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s ease;
          position: relative;

          &:hover {
            background: var(--hover-bg);
            color: var(--text-primary);
          }
        `}
      >
        <FilterIcon />
        {() => {
          const count = activeFilterCount()
          if (count === 0) return null
          return (
            <span
              aria-hidden="true"
              css={`
                position: absolute;
                top: 2px;
                right: 2px;
                width: 14px;
                height: 14px;
                font-size: 9px;
                background: var(--accent);
                color: var(--accent-contrast);
                border-radius: var(--radius-round);
                display: flex;
                align-items: center;
                justify-content: center;
              `}
            >
              {count}
            </span>
          )
        }}
      </button>

      <button
        $spread={settingsPanelOpen.props.disclosure}
        type="button"
        title="Settings"
        aria-label="Settings"
        aria-expanded={settingsPanelOpen}
        css={`
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          background: transparent;
          border: var(--border-width) var(--control-border-style) transparent;
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.15s ease;

          &:hover {
            background: var(--hover-bg);
            color: var(--text-primary);
          }
        `}
      >
        <SettingsIcon />
      </button>

      <span css="position: relative; display: inline-flex;">
        <button
          $spread={themeToggleTooltip.props.anchor}
          type="button"
          on:click={toggleResolvedThemeMode}
          aria-label={() =>
            resolvedThemeMode() === 'dark'
              ? 'Switch to light theme'
              : 'Switch to dark theme'
          }
          css={`
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            background: transparent;
            border: var(--border-width) var(--control-border-style) transparent;
            border-radius: var(--radius-sm);
            cursor: pointer;
            color: var(--text-secondary);
            transition: all 0.15s ease;

            &:hover {
              background: var(--hover-bg);
              color: var(--text-primary);
            }
          `}
        >
          {() => (resolvedThemeMode() === 'dark' ? <MoonIcon /> : <SunIcon />)}
        </button>
        <span css="position: absolute; right: 0; top: calc(100% + 8px); z-index: 1200; width: max-content;">
          <span
            $spread={locallyPositionedTooltipProps(
              themeToggleTooltip.props.content,
            )}
            css={`
              display: block;
              padding: 5px 8px;
              border-radius: var(--radius-sm);
              background: var(--text-primary);
              color: var(--bg-primary);
              font-size: 11px;
              box-shadow: 0 8px 24px var(--shadow);
              pointer-events: none;
            `}
          >
            Toggle light/dark theme
          </span>
        </span>
      </span>
    </div>
  </header>
)
