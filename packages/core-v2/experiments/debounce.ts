import { AtomDecorator, Cache } from '@reatom/core-v2'

let count = 0
export function debounce<T>(
  /** Delay in milliseconds */
  delay: number,
): AtomDecorator<T> {
  const timeoutKey = `__DEBOUNCE${++count}`
  const invalidateType = `invalidate ${timeoutKey}`

  return (reducer) => (transaction, cache) => {
    if (timeoutKey in cache.ctx === false) {
      cache.ctx[timeoutKey] = -1
      return reducer(transaction, cache)
    }

    let shouldScheduleInvalidate = true

    const invalidateAction = transaction.actions.find(
      ({ type }) => type == invalidateType,
    )

    if (invalidateAction != undefined) {
      shouldScheduleInvalidate = false

      cache = reducer(
        Object.assign({}, transaction, { actions: invalidateAction.payload }),
        cache,
      )
    }

    if (shouldScheduleInvalidate) {
      transaction.schedule((dispatch, cause) => {
        clearInterval(cache.ctx[timeoutKey] as number)
        cache.ctx[timeoutKey] = setTimeout(
          () =>
            dispatch(
              {
                type: invalidateType,
                payload: transaction.actions,
                targets: [cache.atom],
              },
              cause,
            ),
          delay,
        )
      })
    }

    return cache as Cache
  }
}
