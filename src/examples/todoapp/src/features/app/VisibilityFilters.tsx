import React from 'react'
import cx from 'classnames'

import { useAtom, useDispatch } from '../../shared'
import { VISIBILITY_FILTERS, createActionCreator, createAtom } from './domain'

const filtersList = Object.keys(VISIBILITY_FILTERS)

export const setFilter = createActionCreator('setFilter')

export const $visibilityFilter = createAtom(
  'visibilityFilter', // name
  VISIBILITY_FILTERS.ALL, // initial state
  reduce => reduce(setFilter, (state, filter) => filter),
)

export function VisibilityFilters() {
  const visibilityFilter = useAtom(() => $visibilityFilter)
  const handleClick = useDispatch(payload => setFilter(payload))
  return (
    <div className="visibility-filters">
      {filtersList.map(filterKey => {
        const currentFilter = VISIBILITY_FILTERS[filterKey]
        return (
          <span
            key={`visibility-filter-${currentFilter}`}
            className={cx(
              'filter',
              currentFilter === visibilityFilter && 'filter--active',
            )}
            onClick={() => handleClick(currentFilter)}
          >
            {currentFilter}
          </span>
        )
      })}
    </div>
  )
}
