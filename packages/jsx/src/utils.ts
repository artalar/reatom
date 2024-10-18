import { isObject } from '@reatom/utils'

/**
 * @see https://github.com/vuejs/core/blob/main/packages/shared/src/normalizeProp.ts
 */
export const buildClassName = (value: unknown): string => {
  let className = ''
  if (typeof value === 'string') {
    className = value
  } else if (Array.isArray(value)) {
    const length = value.length
    for (let i = 0; i < length; i++) {
      const normalized = buildClassName(value[i])
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
  return className
}
