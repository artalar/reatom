import { action, atom, computed, wrap } from '@reatom/core'

const tinyHeicSample = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
])

let heicDecodeSupportedPromise: Promise<boolean> | null = null

async function probeHeicDecodeSupport(): Promise<boolean> {
  if (typeof createImageBitmap !== 'function') return false

  const blob = new Blob([tinyHeicSample], { type: 'image/heic' })
  try {
    const bitmap = await createImageBitmap(blob)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

export const heicDecodeSupported = atom<boolean | null>(
  null,
  'format.heicDecodeSupported',
)

export const ensureHeicDecodeSupportProbed = action(async () => {
  if (heicDecodeSupported() !== null) return

  if (!heicDecodeSupportedPromise) {
    heicDecodeSupportedPromise = probeHeicDecodeSupport()
  }

  const supported = await wrap(heicDecodeSupportedPromise)
  if (heicDecodeSupported() === null) {
    heicDecodeSupported.set(supported)
  }
}, 'format.ensureHeicDecodeSupportProbed')

export const browserCanDecodeHeic = computed(
  () => heicDecodeSupported() === true,
  'format.browserCanDecodeHeic',
)

export function canBrowserDecodeImageType(
  mimeType: string,
  heicSupported: boolean | null,
): boolean {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes('heic') || normalized.includes('heif')) {
    return heicSupported === true
  }
  return true
}
