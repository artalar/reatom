import type { GalleryImageModel } from './models/contracts'

function triggerBlobDownload(url: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export function downloadPreparedGalleryImage(image: GalleryImageModel) {
  const preparedUrl = image.display.downloadUrl()
  if (!preparedUrl) return

  triggerBlobDownload(preparedUrl, image.source.name)
}
