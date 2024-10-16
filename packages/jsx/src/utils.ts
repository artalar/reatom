import { isObject } from '@reatom/utils'

/**
 * @see https://github.com/vuejs/core/blob/main/packages/shared/src/normalizeProp.ts
 */
export const normalizeClass = (value: unknown): string => {
  let className = ''
  if (typeof value === 'string') {
    className = value
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        className += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value) {
      if (value[name]) {
        className += name + ' '
      }
    }
  }
  return className.trim()
}
