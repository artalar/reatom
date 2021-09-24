import { AtomDecorator, isObject } from '@reatom/core'

export function isShallowEqual(a: any, b: any) {
  if (Object.is(a, b)) {
    return true
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return (
      aKeys.length == bKeys.length && aKeys.every((k) => Object.is(a[k], b[k]))
    )
  }
  return false
}

export function memo<T>(
  /** Should return `true` if values are equals. */
  comparator: (a: T, b: T) => boolean = isShallowEqual,
): AtomDecorator<T> {
  return (reducer) => (transaction, cache) => {
    const patch = reducer(transaction, cache)

    if (cache.tracks != undefined && comparator(cache.state!, patch.state)) {
      // @ts-expect-error
      patch.state = cache.state
    }

    return patch
  }
}
