export const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export function mockFn<I extends any[], O>(
  fn: (...input: I) => O = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function (...i: I) {
      // @ts-ignore
      const o = fn.apply(this, i)

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: new Array<{ i: I; o: O }>(),
      lastInput(index = 0): I[number] {
        const { length } = _fn.calls
        if (length === 0) throw new TypeError(`Array is empty`)
        return _fn.calls[length - 1]!.i[index]
      },
    },
  )

  return _fn
}

export const getDuration = async (cb: () => void) => {
  const start = Date.now()
  await cb()
  return Date.now() - start
}
