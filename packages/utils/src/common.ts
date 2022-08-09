export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export const isObject = (thing: any): thing is Record<keyof any, any> =>
  typeof thing === 'object' && thing !== null

export const shallowEqual = (a: any, b: any) => {
  if (!isObject(a) || !isObject(b)) return Object.is(a, b)
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  return (
    aKeys.length === bKeys.length && !aKeys.some((k) => !Object.is(a[k], b[k]))
  )
}
