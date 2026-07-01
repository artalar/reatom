import { action, effect, onEvent } from '@reatom/core'

import { clearSelection, currentImages, selectAllImages } from './collection'
import { closeLightbox, lightboxOpen, navigateLightbox } from './lightbox'
import { filterPanelOpen, settingsPanelOpen } from './panels'
import { toggleResolvedThemeMode } from './preferences'
import { slideshowPlaying } from './slideshow'
import {
  cycleGridColumnPreset,
  decreaseGridColumns,
  decreaseImagePreviewSize,
  increaseGridColumns,
  increaseImagePreviewSize,
  viewMode,
} from './view'

export const toggleFavoriteOnSelectedImages = action(() => {
  for (const model of currentImages()) {
    if (model.selected()) model.favorite.toggle()
  }
}, 'keyboardShortcuts.toggleFavoriteOnSelected')

export const handleKeyboardShortcut = action((event: KeyboardEvent) => {
  const tagName =
    event.target instanceof HTMLElement ? event.target.tagName : undefined
  const isInputFocused =
    tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'

  if (event.key === 'Escape') {
    if (lightboxOpen()) {
      closeLightbox()
      return
    }
    if (filterPanelOpen()) {
      filterPanelOpen.set(false)
      return
    }
    if (settingsPanelOpen()) {
      settingsPanelOpen.set(false)
      return
    }
    return
  }

  if (lightboxOpen()) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      navigateLightbox(-1)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      navigateLightbox(1)
      return
    }
    if (event.key === ' ') {
      event.preventDefault()
      slideshowPlaying.toggle()
      return
    }
  }

  if (isInputFocused) return

  if (event.key === 'Delete' || event.key === 'Backspace') {
    clearSelection()
    return
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    event.preventDefault()
    selectAllImages()
    return
  }

  if (!lightboxOpen() && (event.key === '-' || event.key === '_')) {
    event.preventDefault()
    if (viewMode() === 'grid') {
      decreaseGridColumns()
    } else {
      decreaseImagePreviewSize()
    }
    return
  }

  if (!lightboxOpen() && (event.key === '=' || event.key === '+')) {
    event.preventDefault()
    if (viewMode() === 'grid') {
      increaseGridColumns()
    } else {
      increaseImagePreviewSize()
    }
    return
  }

  if (lightboxOpen()) return

  if (event.key === 'f' || event.key === 'F') {
    toggleFavoriteOnSelectedImages()
    return
  }

  if (event.key === 'g' || event.key === 'G') {
    cycleGridColumnPreset()
    return
  }

  if (event.key === 't' || event.key === 'T') {
    toggleResolvedThemeMode()
    return
  }
}, 'keyboardShortcuts.handleKeyDown')

export const bindKeyboardShortcutsListener = () => {
  const listener = effect(() => {
    onEvent(document, 'keydown', handleKeyboardShortcut)
  }, 'keyboardShortcuts.listener')

  return () => listener.unsubscribe()
}
