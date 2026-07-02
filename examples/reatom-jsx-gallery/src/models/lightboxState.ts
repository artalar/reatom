import { atom, reatomBoolean, withLocalStorage } from '@reatom/core'

import type { GalleryImageModel } from './contracts'

export const lightboxOpen = reatomBoolean(false, 'lightboxOpen')
export const lightboxImage = atom<GalleryImageModel | null>(
  null,
  'lightboxImage',
)
export const lightboxSizedImageWindowIds = atom<ReadonlySet<string>>(
  new Set(),
  'lightbox.sizedImageWindowIds',
)
export const lightboxNavigationDirection = atom<1 | -1>(
  1,
  'lightbox.navigationDirection',
)
export const lightboxZoom = atom(1, 'lightboxZoom')
export const lightboxPanX = atom(0, 'lightbox._panX')
export const lightboxPanY = atom(0, 'lightbox._panY')
export const wrapFolderNavigation = reatomBoolean(
  true,
  'lightbox.wrapFolderNavigation',
).extend(withLocalStorage('gallery.wrapFolderNavigation'))
export const keepLightboxView = reatomBoolean(
  false,
  'lightbox.keepView',
).extend(withLocalStorage('gallery.keepLightboxView'))
export const showLightboxScrubber = reatomBoolean(
  true,
  'lightbox.showScrubber',
).extend(withLocalStorage('gallery.showLightboxScrubber'))
