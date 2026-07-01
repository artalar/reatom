import type { JSX } from '@reatom/jsx'

import {
  folderModelTree,
  type GalleryFolderModel,
  isFolderImagesInCurrentScope,
  tableMinWidth,
  tablePreviewWidth,
  visibleExifColumnNames,
} from '../model'
import { ImageTableFilters } from './ImageTableFilters'
import { ImageTableRow } from './ImageTableRow'

const selectColumnWidth = 68
const previewColumnPadding = 20
const fileColumnWidth = 260
const sizeColumnWidth = 90
const dimensionsColumnWidth = 120
const modifiedColumnWidth = 126
const formatColumnWidth = 94
const exifThumbColumnWidth = 116
const exifColumnWidth = 160
const favoriteColumnWidth = 82

function renderFolderRows(
  folder: GalleryFolderModel,
  exifColumns: string[],
): JSX.Element[] {
  return [
    ...folder
      .sortedImages()
      .map((imageNode) => (
        <ImageTableRow
          image={imageNode}
          exifColumns={exifColumns}
          visible={() =>
            isFolderImagesInCurrentScope(folder) && imageNode.visible()
          }
        />
      )),
    ...folder.children.flatMap((child) => renderFolderRows(child, exifColumns)),
  ]
}

const tableHeaderCellCss = `
  position: sticky;
  top: 0;
  z-index: 1;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: var(--border-width) var(--border-style) var(--card-border);
  background: var(--toolbar-bg);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 750;
  line-height: 1.25;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export const ImageTable = () => (
  <div
    css={`
      grid-column: 1 / -1;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      max-width: 100%;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      border: var(--border-width) var(--border-style) var(--card-border);
      border-radius: var(--radius-md);
      background-color: var(--card-bg);
      background-image: var(--card-bg-image);
      background-size: var(--surface-bg-size);
      box-shadow: var(--glow);
    `}
  >
    <ImageTableFilters />

    <div
      css={`
        flex: 1 1 auto;
        max-width: 100%;
        min-height: 0;
        min-width: 0;
        overflow: auto;
      `}
    >
      <table
        css:min-table-width={() => `${tableMinWidth()}px`}
        css:preview-column-width={() =>
          `${tablePreviewWidth() + previewColumnPadding}px`
        }
        css={`
          width: 100%;
          min-width: max(100%, var(--min-table-width));
          border-collapse: collapse;
          table-layout: fixed;
        `}
      >
        <colgroup>
          <col
            css={`
              width: ${selectColumnWidth}px;
            `}
          />
          <col css="width: var(--preview-column-width);" />
          <col
            css={`
              width: ${fileColumnWidth}px;
            `}
          />
          <col
            css={`
              width: ${sizeColumnWidth}px;
            `}
          />
          <col
            css={`
              width: ${dimensionsColumnWidth}px;
            `}
          />
          <col
            css={`
              width: ${modifiedColumnWidth}px;
            `}
          />
          <col
            css={`
              width: ${formatColumnWidth}px;
            `}
          />
          <col
            css={`
              width: ${exifThumbColumnWidth}px;
            `}
          />
          {() =>
            visibleExifColumnNames().map(() => (
              <col
                css={`
                  width: ${exifColumnWidth}px;
                `}
              />
            ))
          }
          <col
            css={`
              width: ${favoriteColumnWidth}px;
            `}
          />
        </colgroup>
        <thead>
          <tr>
            <th css={tableHeaderCellCss}>Select</th>
            <th css={tableHeaderCellCss}>Preview</th>
            <th css={tableHeaderCellCss}>File</th>
            <th css={tableHeaderCellCss}>Size</th>
            <th css={tableHeaderCellCss}>Dimensions</th>
            <th css={tableHeaderCellCss}>Modified</th>
            <th css={tableHeaderCellCss}>Format</th>
            <th css={tableHeaderCellCss}>EXIF thumb</th>
            {() =>
              visibleExifColumnNames().map((columnName) => (
                <th css={tableHeaderCellCss} title={columnName}>
                  {columnName}
                </th>
              ))
            }
            <th css={tableHeaderCellCss}>Favorite</th>
          </tr>
        </thead>
        <tbody>
          {() => {
            const tree = folderModelTree()
            const exifColumns = visibleExifColumnNames()
            return tree ? renderFolderRows(tree, exifColumns) : null
          }}
        </tbody>
      </table>
    </div>
  </div>
)
