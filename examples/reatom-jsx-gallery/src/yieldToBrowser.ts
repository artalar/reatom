import { abortVar, throwAbort, wrap } from '@reatom/core'

export function waitForBrowserFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => {
        globalThis.setTimeout(resolve, 0)
      })
      return
    }

    globalThis.setTimeout(resolve, 0)
  })
}

export async function yieldToBrowser(): Promise<void> {
  const signal = abortVar.require().signal
  if (signal.aborted) throwAbort()

  await wrap(waitForBrowserFrame())

  if (signal.aborted) throwAbort()
}
