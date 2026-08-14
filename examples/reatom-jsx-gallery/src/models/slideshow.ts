import {
  atom,
  effect,
  onEvent,
  reatomBoolean,
  reatomMediaQuery,
  sleep,
  withLocalStorage,
  wrap,
} from '@reatom/core'

import { navigateLightbox } from './lightboxNavigation'

export const slideshowPlaying = reatomBoolean(false, 'slideshowPlaying')
export const slideshowInterval = atom(3000, 'slideshowInterval').extend(
  withLocalStorage('gallery.slideshowInterval'),
)

const prefersReducedMotion = reatomMediaQuery(
  '(prefers-reduced-motion: reduce)',
)

export const slideshowProgressPercent = atom(0, 'slideshow._progressPercent')

export const bindSlideshowAutoAdvance = () => {
  const autoAdvance = effect(async () => {
    if (prefersReducedMotion() && slideshowPlaying()) {
      slideshowPlaying.setFalse()
      slideshowProgressPercent.set(0)
      return
    }

    while (slideshowPlaying()) {
      const intervalMs = slideshowInterval()
      const startedAt = Date.now()

      slideshowProgressPercent.set(0)

      while (Date.now() - startedAt < intervalMs) {
        await wrap(sleep(50))

        const elapsed = Date.now() - startedAt
        slideshowProgressPercent.set(
          Math.min((elapsed / intervalMs) * 100, 100),
        )
      }

      if (!navigateLightbox(1)) {
        slideshowPlaying.setFalse()
      }
    }

    slideshowProgressPercent.set(0)
  }, 'slideshow._autoAdvance')

  return () => autoAdvance.unsubscribe()
}

export const bindSlideshowPauseOnPageHidden = () => {
  const pauseOnHidden = effect(() => {
    onEvent(document, 'visibilitychange', () => {
      if (document.hidden) {
        slideshowPlaying.setFalse()
      }
    })
  }, 'slideshow.pauseOnPageHidden')

  return () => pauseOnHidden.unsubscribe()
}
