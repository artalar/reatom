import type { Computed } from '@reatom/core'
import type { RadioItemProps } from '@reatom/ux'

import { sortFieldRadio, sortOrder, toggleSortOrder } from '../model'
import type { SortField } from '../types'
import { SortAscIcon, SortDescIcon } from './Icons'
import { radioButtonProps } from './uxProps'

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date' },
  { value: 'type', label: 'Type' },
  { value: 'dimensions', label: 'Dimensions' },
]

const SortFieldButton = ({
  label,
  props,
  isActive,
}: {
  label: string
  props: Computed<RadioItemProps>
  isActive: () => boolean
}) => (
  <button
    $spread={radioButtonProps(props)}
    type="button"
    class="glass-lens"
    attr:data-active={isActive}
    css={`
      padding: 5px 10px;
      border: var(--border-width) var(--control-border-style) var(--border);
      border-radius: var(--radius-sm);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: 12px;
      transition: all 0.15s;
      white-space: nowrap;
      text-transform: var(--control-transform);

      &:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      &[data-active='true'] {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
    `}
  >
    {label}
  </button>
)

export const SortPanel = () => (
  <div
    $spread={sortFieldRadio.props.group}
    aria-label="Sort field"
    css={`
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    `}
  >
    {SORT_FIELD_OPTIONS.map((opt) => {
      const item = sortFieldRadio.item(opt.value)
      return (
        <SortFieldButton
          label={opt.label}
          props={sortFieldRadio.props.item(item)}
          isActive={item.checked}
        />
      )
    })}
    <button
      on:click={toggleSortOrder}
      css={`
        padding: 5px 10px;
        border: var(--border-width) var(--control-border-style) var(--accent);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--accent);
        font-size: 12px;
        font-weight: 600;
        transition: all 0.15s;
        min-width: 76px;
        text-transform: var(--control-transform);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;

        &:hover {
          background: var(--accent);
          color: var(--accent-contrast);
        }
      `}
    >
      {() => (sortOrder() === 'asc' ? <SortAscIcon /> : <SortDescIcon />)}
      <span>{() => (sortOrder() === 'asc' ? 'Asc' : 'Desc')}</span>
    </button>
  </div>
)
