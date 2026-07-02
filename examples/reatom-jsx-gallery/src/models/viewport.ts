import { computed, reatomObservable, withMemo } from '@reatom/core'

const MIN_DECODE_DPR = 1
const MAX_DECODE_DPR = 3

function readViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function readDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(
    MAX_DECODE_DPR,
    Math.max(MIN_DECODE_DPR, window.devicePixelRatio || 1),
  )
}

function readPanelLongEdge(): number {
  if (typeof window === 'undefined') return 0
  return Math.ceil(window.screen.width * readDevicePixelRatio())
}

export const viewportSize = reatomObservable(
  () => ({
    initState: readViewportSize(),
    getState: readViewportSize,
    subscribe: (notify) => {
      if (typeof window === 'undefined') return () => {}

      let frame = 0
      const scheduleNotify = () => {
        if (frame !== 0) return
        frame = requestAnimationFrame(() => {
          frame = 0
          notify(readViewportSize())
        })
      }

      window.addEventListener('resize', scheduleNotify)
      return () => {
        window.removeEventListener('resize', scheduleNotify)
        if (frame !== 0) cancelAnimationFrame(frame)
      }
    },
  }),
  'viewport.size',
).extend(
  // Without that memo, the tab gets stuck indefinitely.
  withMemo(),
)

export const devicePixelRatio = reatomObservable(
  () => ({
    initState: readDevicePixelRatio(),
    getState: readDevicePixelRatio,
    subscribe: (notify) => {
      if (typeof window === 'undefined') return () => {}

      let mediaQuery: MediaQueryList | null = null
      let mediaListener: (() => void) | null = null

      const armMediaQuery = () => {
        mediaQuery?.removeEventListener('change', mediaListener ?? undefined)
        const dpr = window.devicePixelRatio || 1
        mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`)
        mediaListener = () => {
          notify(readDevicePixelRatio())
          armMediaQuery()
        }
        mediaQuery.addEventListener('change', mediaListener)
      }

      const onViewportChange = () => {
        notify(readDevicePixelRatio())
        armMediaQuery()
      }

      armMediaQuery()
      window.addEventListener('resize', onViewportChange)

      return () => {
        window.removeEventListener('resize', onViewportChange)
        if (mediaQuery && mediaListener) {
          mediaQuery.removeEventListener('change', mediaListener)
        }
      }
    },
  }),
  'viewport.devicePixelRatio',
)

export const panelLongEdge = reatomObservable(
  () => ({
    initState: readPanelLongEdge(),
    getState: readPanelLongEdge,
    subscribe: (notify) => {
      if (typeof window === 'undefined') return () => {}

      let frame = 0
      const scheduleNotify = () => {
        if (frame !== 0) return
        frame = requestAnimationFrame(() => {
          frame = 0
          notify(readPanelLongEdge())
        })
      }

      let mediaQuery: MediaQueryList | null = null
      let mediaListener: (() => void) | null = null

      const armMediaQuery = () => {
        mediaQuery?.removeEventListener('change', mediaListener ?? undefined)
        const dpr = window.devicePixelRatio || 1
        mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`)
        mediaListener = () => {
          notify(readPanelLongEdge())
          armMediaQuery()
        }
        mediaQuery.addEventListener('change', mediaListener)
      }

      armMediaQuery()
      window.addEventListener('resize', scheduleNotify)
      window.addEventListener('orientationchange', scheduleNotify)

      return () => {
        window.removeEventListener('resize', scheduleNotify)
        window.removeEventListener('orientationchange', scheduleNotify)
        if (mediaQuery && mediaListener) {
          mediaQuery.removeEventListener('change', mediaListener)
        }
        if (frame !== 0) cancelAnimationFrame(frame)
      }
    },
  }),
  'viewport.panelLongEdge',
)

export const viewportLongEdge = computed(() => {
  const { width, height } = viewportSize()
  return Math.max(width, height)
}, 'viewport.longEdge')

export const viewportDeviceLongEdge = computed(
  () => Math.ceil(viewportLongEdge() * devicePixelRatio()),
  'viewport.deviceLongEdge',
)
