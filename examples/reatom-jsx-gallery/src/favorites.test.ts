import { clearStack, context } from '@reatom/core'
import { expect, test } from 'vitest'

import { mockFolderTree } from './__fixtures__/mockData'
import { favoriteImages, favoritesCount } from './favorites'
import { visibleIndexMap } from './model'
import { loadGalleryState } from './shared/testSetup'

test.beforeEach(() => {
  clearStack()
})

test('favoriteImages returns only favorited images from visible list', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const models = [...visibleIndexMap().keys()]
    models[0]!.favorite.toggle()
    models[2]!.favorite.toggle()
    const favs = favoriteImages()
    expect(favs.length).toBe(2)
    expect(favs.map((i) => i.id)).toContain(models[0]!.id)
    expect(favs.map((i) => i.id)).toContain(models[2]!.id)
  }))

test('favoritesCount returns correct count', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const models = [...visibleIndexMap().keys()]
    expect(favoritesCount()).toBe(0)
    models[0]!.favorite.toggle()
    expect(favoritesCount()).toBe(1)
    models[1]!.favorite.toggle()
    expect(favoritesCount()).toBe(2)
    models[0]!.favorite.toggle()
    expect(favoritesCount()).toBe(1)
  }))
