import {
  folderModelTree,
  gridColumns,
  gridGap,
  imageGrid,
  isFolderBranchInCurrentScope,
  isFolderImagesInCurrentScope,
  type GalleryFolderModel,
  viewMode,
  visibleIndexMap,
} from '../model'
import { GRID_GAP_VALUES } from '../types'
import { GridImage } from './GridImage'
import { SearchIcon } from './Icons'
import { ImageList } from './ImageList'
import { ImageTable } from './ImageTable'

const GridImageEntry = ({ image }: { image: GalleryFolderModel['images'][number] }) => (
  <div style:display={() => (image.visible() ? 'contents' : 'none')}>
    <GridImage image={image} />
  </div>
)

const GridFolder = ({ folder }: { folder: GalleryFolderModel }) => (
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
          .map((image) => <GridImageEntry image={image} />)
      }
    </div>
    {folder.children.map((child) => (
      <GridFolder folder={child} />
    ))}
  </div>
)

const GridFolderTree = () => (
  <div css="display: contents;">
    {() => {
      const tree = folderModelTree()
      return tree ? <GridFolder folder={tree} /> : null
    }}
  </div>
)

const NoImagesMessage = () => (
  <div
    role="status"
    css={`
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      color: var(--text-secondary);
      gap: 12px;
    `}
  >
    <div css="font-size: 48px; user-select: none;">
      <SearchIcon />
    </div>
    <p css="font-size: 16px; margin: 0; font-weight: 500;">No images found</p>
    <p css="font-size: 14px; margin: 0; color: var(--text-muted);">
      Try adjusting your search or filter settings.
    </p>
  </div>
)

export const ImageGrid = () => (
  <div
    ref={imageGrid.ref}
    attr:data-view-mode={viewMode}
    css:columns={() => {
      const mode = viewMode()
      if (mode === 'list' || mode === 'table') return '1, minmax(0, 1fr)'

      const cols = gridColumns()
      return cols === 0
        ? 'auto-fill, minmax(min(200px, 100%), 1fr)'
        : `${cols}, minmax(0, 1fr)`
    }}
    css:gap={() => `${GRID_GAP_VALUES[gridGap()]}px`}
    css={`
      display: grid;
      grid-template-columns: repeat(var(--columns));
      gap: calc(var(--gap) + var(--shadow-clearance, 0px));
      width: 100%;
      min-width: 0;

      &[data-view-mode='list'] {
        grid-template-columns: minmax(0, 1fr);
      }
      &[data-view-mode='table'] {
        display: flex;
        grid-template-columns: minmax(0, 1fr);
        height: 100%;
        min-height: 0;
      }
    `}
  >
    {() => (visibleIndexMap().size === 0 ? <NoImagesMessage /> : null)}
    {() => {
      if (visibleIndexMap().size === 0) return null

      const mode = viewMode()
      if (mode === 'table') return <ImageTable />

      return (
        <div css="display: contents;">
          {mode === 'list' ? <ImageList /> : <GridFolderTree />}
        </div>
      )
    }}
  </div>
)
