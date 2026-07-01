import type { Atom, BooleanAtom, Computed } from '@reatom/core'

import type { ReatomImage } from '../reatomImage'
import type { FolderNode, ImageFile } from '../types'

export type RawDisplayStage = 'thumbnail' | 'embedded' | 'developed'

export type PreviewLoadPriority = 'off' | 'high' | 'background'

export type FolderScanResult = {
  tree: FolderNode
}

export type ParsingProgressSnapshot = {
  total: number
  current: number
}

export type GalleryImageDisplayModel = {
  stage: Computed<RawDisplayStage>
  source: Computed<{ url: string; orientationBaked: boolean } | null>
  element: Computed<HTMLImageElement | null>
  preloadUrl: Computed<string>
  downloadUrl: Computed<string>
  isRawPipeline: Computed<boolean>
  sizeLabel: Computed<string>
  typeLabel: Computed<string>
  lastModifiedLabel: Computed<string>
  dimensionsLabel: Computed<string>
  summaryLabel: Computed<string>
}

export type GalleryImageModel = ReatomImage & {
  id: ImageFile['id']
  source: ImageFile
  selected: BooleanAtom
  favorite: BooleanAtom
  previewLoadPriority: Atom<PreviewLoadPriority>
  visible: Computed<boolean>
  width: Computed<number>
  height: Computed<number>
  display: GalleryImageDisplayModel
}

export type ImageModel = GalleryImageModel
