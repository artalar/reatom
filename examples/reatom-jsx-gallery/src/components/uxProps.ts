import type { Computed } from '@reatom/core'
import type { RadioItemProps, TooltipContentProps } from '@reatom/ux'

/**
 * Keeps the custom-button half of a radio item record. Native-only input
 * properties are intentionally omitted before the record reaches the button.
 */
export const radioButtonProps = (props: Computed<RadioItemProps>) => {
  let previous: RadioItemProps | undefined
  let result: object | undefined

  return () => {
    const record = props()
    if (record === previous && result) return result
    previous = record
    return (result = {
      id: record.id,
      role: record.role,
      tabIndex: record.tabIndex,
      'data-active-item': record['data-active-item'],
      'aria-checked': record['aria-checked'],
      'aria-disabled': record['aria-disabled'],
      'aria-labelledby': record['aria-labelledby'],
      'aria-describedby': record['aria-describedby'],
      ref: record.ref,
      onFocus: record.onFocus,
      onKeyDown: record.onKeyDown,
      onClick: record.onClick,
    })
  }
}

/**
 * The gallery positions tooltip content with its existing CSS wrapper, so the
 * popover positioner's inline style is omitted while all behavior stays bound.
 */
export const locallyPositionedTooltipProps = (
  props: Computed<TooltipContentProps>,
) => {
  let previous: TooltipContentProps | undefined
  let result: object | undefined

  return () => {
    const current = props()
    if (current === previous && result) return result
    previous = current
    const { style: _positionerStyle, ...record } = current
    return (result = record)
  }
}
