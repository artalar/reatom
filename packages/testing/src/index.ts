export function mockFn<I extends any[], O>(
  fn: (...input: I) => O = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function (...i: I) {
      try {
        // @ts-ignore
        var o = fn.apply(this, i)
      } catch (error) {
        // @ts-ignore
        _fn.calls.push({ i, o: error })

        throw error
      }

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
