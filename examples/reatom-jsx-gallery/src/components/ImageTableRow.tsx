import { commandProps, reatomCommand } from '@reatom/ux'

import { formatExifDisplayValue } from '../image-engine/exifDisplay'
import { resolveImageOrientationStyle } from '../image-engine/orientation'
import type { ImageModel } from '../model'
import {
  bindGalleryImagePreviewWhen,
  ignoreExifOrientation,
  openLightbox,
  selectImage,
  tablePreviewHeight,
  tablePreviewWidth,
} from '../model'
import { CheckIcon, HeartIcon } from './Icons'

export const tableCellCss = `
  min-width: 0;
  padding: 8px 10px;
  border-bottom: var(--border-width) var(--border-style) var(--card-border);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.35;
  vertical-align: top;
  overflow-wrap: anywhere;
`

export const ImageTableRow = ({
  image,
  exifColumns,
  visible,
}: {
  image: ImageModel
  exifColumns: string[]
  visible: () => boolean
}) => {
  const isSelected = () => image.selected()
  const isFavorite = () => image.favorite()
  const openCommandProps = commandProps(
    reatomCommand({ name: `gallery.image#${image.id}.tableOpen` }),
  )
  const displayThumbnail = () => {
    if (image.previewLoadPriority() === 'off') return null

    const thumbnail = image.thumbnail.data()
    if (!thumbnail) return null

    const orientationStyle = resolveImageOrientationStyle(
      image.meta.data()?.exif,
      ignoreExifOrientation(),
      thumbnail.orientationBaked || image.display.isRawPipeline(),
    )
    return (
      <img
        src={thumbnail.url}
        alt={image.name}
        loading="lazy"
        style:image-orientation={orientationStyle}
      />
    )
  }

  const openLabel = `Open ${image.name}`

  return (
    <tr
      $spread={openCommandProps.element}
      tabindex={0}
      aria-label={openLabel}
      ref={() => bindGalleryImagePreviewWhen(image, visible)}
      attr:data-selected={isSelected}
      style:display={() => (visible() ? 'table-row' : 'none')}
      css:preview-width={() => `${tablePreviewWidth()}px`}
      css:preview-height={() => `${tablePreviewHeight()}px`}
      on:click={() => openLightbox(image)}
      css={`
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
          background: var(--hover-bg);
        }
        &:focus-visible {
          outline: 3px solid var(--focus-ring);
          outline-offset: -2px;
        }
        &[data-selected='true'] {
          background: var(--accent-soft);
        }
      `}
    >
      <td
        css={`
          ${tableCellCss}
          vertical-align: middle;
        `}
      >
        <button
          on:click={(e: Event) => {
            e.stopPropagation()
            selectImage(image)
          }}
          role="checkbox"
          aria-checked={isSelected}
          aria-label={() =>
            isSelected() ? `Deselect ${image.name}` : `Select ${image.name}`
          }
          type="button"
          css={`
            width: 24px;
            height: 24px;
            border-radius: var(--radius-sm);
            border: var(--border-width) var(--control-border-style)
              var(--input-border);
            background: var(--input-bg);
            color: var(--accent-contrast);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-inline: auto;

            &[aria-checked='true'] {
              background: var(--accent);
              border-color: var(--accent);
            }
          `}
        >
          {() => (isSelected() ? <CheckIcon /> : null)}
        </button>
      </td>
      <td css={tableCellCss}>
        <div
          css={`
            width: min(var(--preview-width), 100%);
            height: var(--preview-height);
            border-radius: var(--radius-sm);
            overflow: hidden;
            background: var(--input-bg);

            > img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            }
          `}
        >
          {displayThumbnail}
        </div>
      </td>
      <td css={tableCellCss}>
        <div css="min-width: 0;">
          <div
            css={`
              font-weight: 650;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {image.name}
          </div>
          <div
            css={`
              margin-top: 4px;
              color: var(--text-muted);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            `}
          >
            {image.source.relativePath || image.source.path}
          </div>
        </div>
      </td>
      <td css={tableCellCss}>{image.display.sizeLabel}</td>
      <td css={tableCellCss}>{image.display.dimensionsLabel}</td>
      <td css={tableCellCss}>{image.display.lastModifiedLabel}</td>
      <td css={tableCellCss}>{() => image.meta.data()?.format ?? 'unknown'}</td>
      <td css={tableCellCss}>
        {() => (image.meta.data()?.hasExifThumbnail ? 'yes' : 'no')}
      </td>
      {exifColumns.map((columnName) => (
        <td css={tableCellCss}>
          {() => {
            const exif = image.meta.data()?.exif
            if (!exif) return ''
            const raw = exif[columnName] ?? ''
            return formatExifDisplayValue(columnName, raw, exif)
          }}
        </td>
      ))}
      <td css={tableCellCss}>
        <button
          on:click={(e: Event) => {
            e.stopPropagation()
            image.favorite.toggle()
          }}
          aria-pressed={isFavorite}
          aria-label={() =>
            isFavorite()
              ? `Remove ${image.name} from favorites`
              : `Add ${image.name} to favorites`
          }
          type="button"
          css={`
            width: 30px;
            height: 30px;
            border-radius: var(--radius-round);
            border: var(--border-width) var(--control-border-style) transparent;
            background: var(--input-bg);
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;

            &[aria-pressed='true'] {
              color: var(--accent);
              box-shadow: var(--glow);
            }
            &:hover {
              background: var(--hover-bg);
              color: var(--text-primary);
            }
          `}
        >
          {() => <HeartIcon filled={isFavorite()} />}
        </button>
      </td>
    </tr>
  )
}
