import { atom, bind, computed, reatomObservable } from '@reatom/core'

import { quantizeThumbnailBucket } from '../image-engine/decodePolicy'
import { GRID_GAP_VALUES } from '../types'
import { gridColumns, gridGap } from './view'
import { devicePixelRatio } from './viewport'

const AUTO_COLUMN_MIN_SIZE = 200

export const imageGrid = atom<HTMLElement | null>(null, 'imageGrid').extend(
  (target) => {
    const width = reatomObservable(
      () => ({
        initState: 0,
        getState: () => {
          const element = target()
          return element ? Math.ceil(element.getBoundingClientRect().width) : 0
        },
        subscribe: (notify) => {
          let observer: ResizeObserver | undefined

          const readWidth = () => {
            const element = target()
            return element
              ? Math.ceil(element.getBoundingClientRect().width)
              : 0
          }

          // ResizeObserver fires outside any Reatom frame; bind restores it.
          const notifyWidth = bind(() => notify(readWidth()))

          const observeElement = () => {
            observer?.disconnect()
            observer = undefined

            const element = target()
            if (!element) return

            notifyWidth()
            observer = new ResizeObserver(notifyWidth)
            observer.observe(element)
          }

          observeElement()
          const stopElementSubscription = target.subscribe(observeElement)

          return () => {
            stopElementSubscription()
            observer?.disconnect()
          }
        },
      }),
      `${target.name}._width`,
    )

    const itemSize = computed(() => {
      const gridWidth = width()
      const gap = GRID_GAP_VALUES[gridGap()]
      const configuredColumns = gridColumns()
      const columns =
        configuredColumns === 0
          ? Math.max(
              1,
              Math.floor((gridWidth + gap) / (AUTO_COLUMN_MIN_SIZE + gap)),
            )
          : configuredColumns

      return Math.max(0, Math.ceil((gridWidth - gap * (columns - 1)) / columns))
    }, `${target.name}._itemSize`)

    // 0 means "grid not measured yet" — the thumbnail pipeline waits for a
    // real target instead of wasting a decode on the smallest bucket.
    const thumbnailTarget = computed(() => {
      const size = itemSize()
      if (size === 0) return 0
      return quantizeThumbnailBucket(Math.ceil(size * devicePixelRatio()))
    }, `${target.name}._thumbnailTarget`)

    return {
      width,
      itemSize,
      thumbnailTarget,
      ref: (element: HTMLElement) => {
        target.set(element)
        return () => target.set(null)
      },
    }
  },
)
