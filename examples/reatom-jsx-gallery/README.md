# Reatom JSX Gallery PWA

A modern, feature-rich Progressive Web App (PWA) image gallery built with **Reatom** and **JSX** (not React). Leverages the **File System Access API** to browse and display images from local folders with deep recursive parsing and extensive customization options.

## Features

### Implemented

- **Folder selection** with the File System Access API.
- **Recursive parsing** with progress state and cancellation.
- **Grid, list, and table views** with configurable columns, preview fit, gap, names, and file sizes.
- **Sorting and filtering** by name, size, date modified, type, dimensions, file type, size range, filename, and subfolder scope.
- **Lightbox** with zoom, pan, fullscreen, details panel, thumbnail strip, filtered navigation, folder scrubber, slideshow, download, and copy-as-JPEG.
- **Navigation preferences** for folder-end wrapping, keeping zoom/pan while navigating, and showing the folder scrubber.
- **Metadata-aware thumbnails** through JPEG EXIF previews, RAW embedded previews, generated browser thumbnails, EXIF orientation handling, and camera detail display.
- **Selection and favorites** persisted per image id.
- **Theme packs** with light, dark, and system modes.

### Planned from the research docs

- IndexedDB thumbnail cache with file size and mtime keys.
- XMP/IPTC metadata read paths.
- Histogram, channel inspection, and compare-at-zoom.
- Batch ZIP export and guarded metadata/write workflows.

## Supported image formats

| Extensions                                                                             | Thumbnail & display                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.jpg`, `.jpeg`                                                                        | EXIF embedded preview when available; EXIF orientation; camera metadata in details                                                                                                                                                                                      |
| `.png`, `.gif`, `.webp`, `.avif`, `.bmp`                                               | Browser `createImageBitmap`/canvas thumbnail when no format-specific preview; optional EXIF in PNG/WebP chunks; AVIF via BMFF header parse                                                                                                                              |
| `.svg`                                                                                 | Parsed dimensions; rendered in grid and lightbox                                                                                                                                                                                                                        |
| `.dng` (Adobe), `.arw`/`.sr2` (Sony), `.cr2` (Canon), `.nef` (Nikon), `.orf` (Olympus) | Embedded JPEG previews from TIFF IFD (64 MB scan), not full demosaic by default. **Develop RAW at Full Size** (Settings) develops full-resolution JPEGs in a worker for lightbox and copy. Not all camera models; exotic RAW suffixes outside this list are not scanned |

**Pipeline:** JPEG → EXIF thumbnail; RAW → embedded preview or optional full develop; raster/SVG → browser thumbnail — all feed grid and lightbox.

**Copy-as-JPEG** (`src/copyImage.ts`): JPEG originals as-is; RAW prefers developed JPEG when the setting is on, else largest embedded preview, else rasterize; other formats rasterize to JPEG (PNG clipboard fallback if `image/jpeg` is unsupported).

**Filtering:** Toolbar type chips match these extensions (`src/models/filters.ts`), plus size range, subfolder scope, and filename search.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **Modern Browser** (Chrome, Edge, Opera recommended for File System Access API)
  - Firefox and Safari have limited support (fallback available)

### Installation

```bash
# Navigate to the project directory
cd examples/reatom-jsx-gallery

# Install dependencies from the workspace root
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building

```bash
# Build for production
pnpm build

# Preview the production build
pnpm preview
```

## 📖 Usage

### Opening a Folder

1. Click the **"Open Folder"** button on the welcome screen
2. Select a folder containing images from the file picker dialog
3. The app will recursively scan all subfolders for images
4. Wait for parsing to complete (progress shown in overlay)

### Navigating Images

- **Grid View**: Click any image to open in lightbox
- **Lightbox**: Use arrow keys, side buttons, thumbnail strip, or folder scrubber to navigate the filtered visible set.
- **Slideshow**: Click play and choose 1s, 3s, 5s, 10s, or 30s intervals.

### Customizing the Grid

Use the **Settings** panel (toolbar gear icon) to adjust:

- **Columns**: 0-12, where 0 enables auto columns.
- **Gap**: Spacing between images
- **Image Fit**: How images fit in their containers
- **Lightbox**: Wrap navigation, keep zoom while navigating, and folder scrubber visibility.

### Sorting & Filtering

Use the toolbar controls to:

- **Sort**: Click sort controls to change field and order
- **Filter**: Use type chips, size range, subfolder scope, and search box
- **Reset**: Clear all filters with one click

### Keyboard Shortcuts

- `←` / `→` - Previous/next image (in lightbox)
- `Escape` - Close lightbox or exit slideshow
- `Space` - Play/pause slideshow
- `F` - Toggle favorites for selected grid images
- `T` - Toggle light/dark theme

## 🛠️ Tech Stack

- **State Management**: [Reatom](https://reatom.js.org/) - Efficient reactive state
- **UI**: Reatom JSX - React-like JSX without React
- **Accessible widgets**: `@reatom/ux` dialog, disclosure, radio, checkbox,
  toolbar, tooltip, and command models bound to native DOM through reactive
  `$spread` prop records.
- **Build Tool**: Vite - Fast development and optimized builds
- **TypeScript**: Full type safety
- **File System Access API**: Local folder access
- **IndexedDB**: Directory handle persistence

## 📁 Project Structure

```mermaid
flowchart TB
  App[src/App.tsx] --> Model[src/model.ts]
  App --> Components[src/components]
  Components --> Lightbox[src/components/Lightbox.tsx]
  Components --> Grid[src/components/ImageGrid.tsx]
  Model --> Filesystem[src/filesystem.ts]
  Model --> ImageModel[src/reatomImage.ts]
  ImageModel --> Engine[src/image-engine]
  App --> Setup[src/setup.ts]
```

## 🎨 Customization

Theme packs and defaults live in `src/theme.tsx` and persisted UI atoms live in `src/model.ts`.

## 🔧 Browser Support

### Full Support

- **Chrome** 86+ (recommended)
- **Edge** 86+ (recommended)
- **Opera** 72+

### Limited Support

- **Firefox and Safari**: File System Access API support is limited.
- **Mobile**: Directory picking and persistent handles vary by browser.

## 📝 Notes

### File System Access API

- Requires HTTPS or localhost
- Permissions are granted per-folder and may be revoked by the user
- Browser may prompt for permission on each page reload
- Some file systems may not support recursive access

### Test fixtures

Binary image corpora live under `src/__fixtures__/images/` in three tiers:

| Tier     | Size              | Use                                                      |
| -------- | ----------------- | -------------------------------------------------------- |
| `tier-a` | ~4 MB             | Default CI — EXIF, PNG/WebP/AVIF/GIF/SVG/BMP smoke tests |
| `tier-b` | ~40 MB            | Extended parser/decode and stress cases                  |
| `tier-c` | ~140 MB (Git LFS) | Real RAW/DNG/ARW/ORF embedded-preview tests              |

```bash
# Re-download from pinned upstream URLs (updates manifest sha256)
pnpm fixtures:fetch

# Run fixture tests
pnpm test:fixtures              # tier-a
pnpm test:fixtures:extended     # tier-a + tier-b
pnpm test:fixtures:raw          # tier-c (requires Git LFS)
```

After clone, pull LFS objects for tier-c:

```bash
git lfs install
git lfs pull
```

Attribution: [`src/__fixtures__/LICENSES.md`](src/__fixtures__/LICENSES.md).

### Research references

- `docs/nomacs-porting-playbook.md` tracks metadata, thumbnail, performance, and test priorities.
- `docs/oculante-porting-playbook.md` tracks scrubber, keep-view, cache, histogram, and compare-mode ideas.

### Privacy

- All image processing happens locally in your browser
- No data is uploaded to any server
- File handles and permissions are managed by the browser

## 🤝 Contributing

This is an example project for demonstrating Reatom JSX capabilities. Feel free to fork and customize for your needs!

## 📄 License

MIT

## 🔗 Resources

- [Reatom Documentation](https://artalar.github.io/reatom/)
- [Reatom JSX Guide](https://github.com/artalar/reatom/tree/master/packages/jsx)
- [File System Access API](https://developer.chrome.com/docs/file-system-access/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)

## 🙏 Acknowledgments

Built with [Reatom](https://reatom.js.org/) - a lightweight state manager with a powerful reactivity system.
