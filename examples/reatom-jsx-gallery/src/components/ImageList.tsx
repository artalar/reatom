import { focusableCardAttrs } from '../a11y'
import {
  bindGalleryImagePreview,
  folderModelTree,
  type GalleryFolderModel,
  type ImageModel,
  isFolderBranchInCurrentScope,
  isFolderImagesInCurrentScope,
  listPreviewHeight,
  listPreviewWidth,
  openLightbox,
  selectImage,
} from '../model'
import { CheckIcon, HeartIcon } from './Icons'

const ListImage = ({ image }: { image: ImageModel }) => {
  const isSelected = () => image.selected()
  const isFavorite = () => image.favorite()
  const displayThumbnail = () => {
    if (image.previewLoadPriority() === 'off') return null

    const thumbnail = image.thumbnail.data()
    return thumbnail ? (
      <img src={thumbnail.url} alt={image.name} loading="lazy" />
    ) : null
  }

  const openLabel = `Open ${image.name}`

  return (
    <div
      {...focusableCardAttrs(openLabel, () => openLightbox(image))}
      attr:data-selected={isSelected}
      css:preview-width={() => `${listPreviewWidth()}px`}
      css:preview-height={() => `${listPreviewHeight()}px`}
      on:click={() => openLightbox(image)}
      css={`
        &:focus-visible {
          outline: 3px solid var(--focus-ring);
          outline-offset: 2px;
        }
        display: grid;
        grid-template-columns: 34px var(--preview-width) minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        min-width: 0;
        padding: 10px 12px;
        border: var(--border-width) var(--border-style) var(--card-border);
        border-radius: var(--radius-md);
        background-color: var(--card-bg);
        background-image: var(--card-bg-image);
        background-size: var(--surface-bg-size);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          border-color: var(--accent);
          transform: var(--card-hover-transform);
          box-shadow: var(--card-hover-shadow);
        }
        &[data-selected='true'] {
          border-color: var(--accent);
          box-shadow: var(--selected-shadow);
        }
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
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          border: var(--border-width) var(--control-border-style)
            var(--input-border);
          background: var(--input-bg);
          color: var(--accent-contrast);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;

          &[aria-checked='true'] {
            background: var(--accent);
            border-color: var(--accent);
          }
        `}
      >
        {() => (isSelected() ? <CheckIcon /> : null)}
      </button>

      <div
        css={`
          width: var(--preview-width);
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

      <div css="min-width: 0;">
        <div
          css={`
            font-size: 14px;
            font-weight: 650;
            color: var(--text-primary);
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
            font-size: 12px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          `}
        >
          {image.source.relativePath || image.source.path}
        </div>
        <div css="margin-top: 5px; font-size: 12px; color: var(--text-secondary);">
          {image.display.summaryLabel}
        </div>
      </div>

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
          width: 34px;
          height: 34px;
          border-radius: var(--radius-round);
          border: var(--border-width) var(--control-border-style) transparent;
          background: var(--input-bg);
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;

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
    </div>
  )
}

const ListImageEntry = ({
  image,
  folder,
}: {
  image: ImageModel
  folder: GalleryFolderModel
}) => (
  <div
    style:display={() => (image.visible() ? 'contents' : 'none')}
    ref={() => bindGalleryImagePreview(image, folder)}
  >
    <ListImage image={image} />
  </div>
)

const ListFolder = ({ folder }: { folder: GalleryFolderModel }) => (
  <div
    style:display={() =>
      isFolderBranchInCurrentScope(folder) ? 'contents' : 'none'
    }
  >
    <div
      style:display={() =>
        isFolderImagesInCurrentScope(folder) ? 'contents' : 'none'
      }
    >
      {() =>
        folder
          .sortedImages()
          .map((image) => <ListImageEntry image={image} folder={folder} />)
      }
    </div>
    {folder.children.map((child) => (
      <ListFolder folder={child} />
    ))}
  </div>
)

export const ImageList = () => (
  <div css="display: contents;">
    {() => {
      const tree = folderModelTree()
      return tree ? <ListFolder folder={tree} /> : null
    }}
  </div>
)
