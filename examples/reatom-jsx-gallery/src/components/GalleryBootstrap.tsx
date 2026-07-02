import { ensureHeicDecodeSupportProbed } from '../model'

export const GalleryBootstrap = () => (
  <div
    aria-hidden="true"
    css="display: none;"
    ref={() => {
      ensureHeicDecodeSupportProbed()
      return () => {}
    }}
  />
)
