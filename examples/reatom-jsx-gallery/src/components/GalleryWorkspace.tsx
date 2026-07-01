import {
  bindBackgroundPreviewLoader,
  folderTreeSidebarVisible,
  galleryContentMode,
} from '../model'
import { BreadcrumbNav } from './BreadcrumbNav'
import { EmptyState } from './EmptyState'
import { FolderTree } from './FolderTree'
import { ImageGrid } from './ImageGrid'
import { ProgressBar } from './ProgressBar'
import { SortPanel } from './SortPanel'

export const GalleryWorkspace = () => (
  <div css="flex: 1; overflow: hidden; display: flex;">
    {() => {
      if (galleryContentMode() !== 'gallery') return null

      return (
        <div
          style={{ display: 'none' }}
          ref={() => bindBackgroundPreviewLoader()}
        />
      )
    }}
    {() => (galleryContentMode() !== 'empty' ? <FolderTree /> : null)}

    <div css="flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden;">
      {() => {
        const mode = galleryContentMode()
        if (mode === 'empty') return null

        return (
          <div
            css={`
              padding: 4px 16px;
              display: flex;
              align-items: center;
              gap: 12px;
              border-bottom: var(--border-width) var(--border-style)
                var(--card-border);
              background-color: var(--surface-glass);
              background-image: var(--surface-bg-image);
              background-size: var(--surface-bg-size);
              backdrop-filter: var(--toolbar-backdrop-filter);
              flex-shrink: 0;
            `}
          >
            <div
              css="transition: margin-left 0.3s ease;"
              style:margin-left={() =>
                folderTreeSidebarVisible() ? '0px' : '22px'
              }
            >
              <BreadcrumbNav />
            </div>
            <div css="flex: 1;" />
            <SortPanel />
          </div>
        )
      }}

      <main
        id="gallery-main"
        tabindex={-1}
        css={`
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          min-width: 0;
          padding: 20px 24px;
          background-color: var(--bg-primary);
          background-image:
            radial-gradient(
              circle at top right,
              var(--hero-glow-2),
              transparent 34%
            ),
            var(--app-bg-image);
          background-size: auto, var(--bg-size);
        `}
      >
        {() => {
          const mode = galleryContentMode()
          if (mode === 'empty') return <EmptyState />
          if (mode === 'parsing') return <ProgressBar />
          return <ImageGrid />
        }}
      </main>
    </div>
  </div>
)
