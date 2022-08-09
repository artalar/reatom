export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export const isObject = (thing: any): thing is Record<keyof any, any> =>
  typeof thing === 'object' && thing !== null

export const shallowEqual = (a: any, b: any) => {
  if (!isObject(a) || !isObject(b)) return Object.is(a, b)
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) return false

  for (const k of aKeys) {
    if (!Object.is(a[k], b[k])) return false
  }

  return true
}
