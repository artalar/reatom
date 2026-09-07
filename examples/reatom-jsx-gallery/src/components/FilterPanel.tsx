import { checkboxProps } from '@reatom/ux'

import {
  clearFilters,
  filterSizeMaxKb,
  filterSizeMinKb,
  filterTypeCheckboxes,
  IMAGE_TYPE_OPTIONS,
  includeSubfoldersCheckbox,
  searchQuery,
  setFilterSizeMaxKb,
  setFilterSizeMinKb,
} from '../model'
import { CloseIcon } from './Icons'
import { filterPanelOpen } from './panelState'

const includeSubfoldersProps = checkboxProps(includeSubfoldersCheckbox)

const TypeCheckbox = ({ ext, label }: { ext: string; label: string }) => {
  const props = checkboxProps(filterTypeCheckboxes.item(ext))

  return (
    <label
      css={`
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-primary);

        &:hover {
          color: var(--accent);
        }
      `}
    >
      <input
        $spread={props.control}
        css={`
          accent-color: var(--accent);
          width: 16px;
          height: 16px;
        `}
      />
      <span>{label}</span>
    </label>
  )
}

export const FilterPanel = () => (
  <aside
    $spread={filterPanelOpen.props.content}
    aria-hidden={() => !filterPanelOpen()}
    prop:inert={() => !filterPanelOpen()}
    css={`
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      height: 100vh;
      background: var(--bg-secondary);
      border-left: var(--border-width) var(--border-style) var(--border);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      padding: 20px;
      box-shadow: -18px 0 48px var(--shadow-strong);
      background-color: var(--panel-bg);
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      backdrop-filter: var(--panel-backdrop-filter);
      clip-path: var(--surface-clip-path);

      &[data-open='true'] {
        transform: translateX(0);
      }
    `}
  >
    <div
      css={`
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      `}
    >
      <h2
        $spread={filterPanelOpen.props.heading}
        css={`
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        `}
      >
        Filters
      </h2>
      <button
        $spread={filterPanelOpen.props.dismiss}
        aria-label="Close filters"
        css={`
          width: 28px;
          height: 28px;
          border: var(--border-width) var(--control-border-style) transparent;
          border-radius: var(--radius-sm);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;

          &:hover {
            background: var(--accent);
            color: var(--accent-contrast);
          }
        `}
      >
        <CloseIcon />
      </button>
    </div>

    <div css="margin-bottom: 16px;">
      <input
        type="search"
        placeholder="Search by filename..."
        aria-label="Search by filename"
        model:value={searchQuery}
        css={`
          width: 100%;
          padding: 8px 12px;
          border: var(--border-width) var(--control-border-style) var(--border);
          border-radius: var(--radius-sm);
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;

          &:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--focus-ring);
          }

          &::placeholder {
            color: var(--text-secondary);
          }
        `}
      />
    </div>

    <h3
      css={`
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        margin-bottom: 8px;
      `}
    >
      File Types
    </h3>
    <div css="margin-bottom: 16px;">
      {IMAGE_TYPE_OPTIONS.map((option) => (
        <TypeCheckbox ext={option.ext} label={option.label} />
      ))}
    </div>

    <h3
      css={`
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-secondary);
        margin-bottom: 8px;
      `}
    >
      File Size (KB)
    </h3>
    <div css="display: flex; gap: 8px; margin-bottom: 16px;">
      <input
        type="number"
        placeholder="Min"
        value={filterSizeMinKb}
        on:input={(event: Event & { currentTarget: HTMLInputElement }) =>
          setFilterSizeMinKb(Number(event.currentTarget.value))
        }
        css={`
          width: 50%;
          padding: 6px 10px;
          border: var(--border-width) var(--control-border-style) var(--border);
          border-radius: var(--radius-sm);
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;

          &:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--focus-ring);
          }

          &::placeholder {
            color: var(--text-secondary);
          }
        `}
      />
      <input
        type="number"
        placeholder="Max"
        value={filterSizeMaxKb}
        on:input={(event: Event & { currentTarget: HTMLInputElement }) => {
          const value = event.currentTarget.value
          if (value === '') {
            setFilterSizeMaxKb(null)
            return
          }
          setFilterSizeMaxKb(Number(value))
        }}
        css={`
          width: 50%;
          padding: 6px 10px;
          border: var(--border-width) var(--control-border-style) var(--border);
          border-radius: var(--radius-sm);
          background: var(--input-bg);
          color: var(--text-primary);
          font-size: 13px;
          outline: none;

          &:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--focus-ring);
          }

          &::placeholder {
            color: var(--text-secondary);
          }
        `}
      />
    </div>

    <label
      css={`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        margin-bottom: 16px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-primary);
      `}
    >
      <span>Include Subfolders</span>
      <input
        $spread={includeSubfoldersProps.control}
        data-glass-toggle="true"
        css={`
          appearance: none;
          width: 40px;
          height: 22px;
          border-radius: var(--radius-round);
          background: var(--bg-tertiary);
          border: var(--border-width) var(--control-border-style) var(--border);
          position: relative;
          transition: background 0.2s;
          cursor: pointer;

          &::after {
            content: '';
            position: absolute;
            width: 18px;
            height: 18px;
            border-radius: var(--radius-round);
            background: var(--accent-contrast);
            box-shadow: 0 2px 6px var(--shadow);
            top: 2px;
            left: 2px;
            transition: transform 0.2s;
          }

          &:checked {
            background: var(--accent);
          }

          &:checked::after {
            transform: translateX(18px);
          }
        `}
      />
    </label>

    <button
      on:click={clearFilters}
      css={`
        width: 100%;
        padding: 10px;
        border: var(--border-width) var(--control-border-style) var(--border);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-secondary);
        font-size: 13px;
        transition: all 0.15s;

        &:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
      `}
    >
      Clear All Filters
    </button>
  </aside>
)
