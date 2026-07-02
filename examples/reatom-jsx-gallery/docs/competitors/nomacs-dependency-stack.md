# nomacs Dependency Stack & Web Equivalents

Companion to [nomacs-porting-playbook.md](./nomacs-porting-playbook.md) and [nomacs-codebase-deep-dive.md](./nomacs-codebase-deep-dive.md). Analysis from `~/code/nomacs/README.md`, `ImageLounge/CMakeLists.txt`, and `ImageLounge/src/DkCore/*` (June 2026).

nomacs **3.23** is a Qt6 desktop binary. Dependencies are discovered at **cmake** time (`find_package`) and optionally vendored via `git submodule` under `3rd-party/` (Exiv2, LibRaw, OpenCV, Quazip). **Runtime** format support can exceed compile-time libs through Qt `imageformats` plugins and **KImageFormats** (HEIC, AVIF, JXL, EXR).

---

## Build-time feature matrix

| CMake option                                                                           | Depends on           | nomacs use                                                   | Gallery equivalent                                                          |
| -------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| (required) Qt6 Core, Gui, Widgets, Network, Svg, Concurrent, PrintSupport, Core5Compat | Qt 6.x               | UI, `QImageReader`, TCP sync, printing                       | DOM + `@reatom/jsx` + Vite                                                  |
| `ENABLE_OPENCV`                                                                        | OpenCV core/imgproc  | RAW demosaic, TIFF, DRIF, manipulators, HQ thumbs, histogram | `OffscreenCanvas`, optional OpenCV.js (heavy)                               |
| `ENABLE_RAW`                                                                           | LibRaw (+ OpenCV)    | `DkRawLoader` preview + develop                              | `formats/raw.ts` embed only (DNG/ARW/CR2/NEF/ORF/SR2); WASM LibRaw optional |
| `ENABLE_TIFF`                                                                          | libtiff (+ OpenCV)   | Multipage TIFF in `loadTIFF`                                 | Gap — `utif` / decode in worker                                             |
| `ENABLE_QUAZIP`                                                                        | Quazip + zlib        | Zip-in-archive paths (`DkFileInfo`)                          | Gap — `fflate` / `zip.js`                                                   |
| `ENABLE_PLUGINS`                                                                       | OpenCV + plugin DLLs | Paint, composite, batch plugins                              | JS plugin hooks (future)                                                    |
| `ENABLE_TESTING`                                                                       | GoogleTest           | `DkMetaData_test`, etc.                                      | Vitest + Storybook                                                          |
| `ENABLE_HEIF/AVIF/JXL` (Windows)                                                       | Download Qt plugins  | Extend `QImageReader`                                        | Browser `createImageBitmap`                                                 |

---

## Full stack mapping table

| Layer                     | nomacs component                 | Version / source     | Role in app                                | Web / gallery substitute                 | Port priority                 |
| ------------------------- | -------------------------------- | -------------------- | ------------------------------------------ | ---------------------------------------- | ----------------------------- |
| **UI framework**          | Qt6 Widgets                      | System / installer   | Windows, docks, actions                    | Reatom JSX + CSS (`theme.tsx`)           | N/A (different product)       |
| **Image decode (common)** | `QImageReader` + Qt imageformats | Qt 6                 | JPEG/PNG/WebP/BMP/GIF/TGA/TIFF/WebP        | `createImageBitmap`, `<img>`, SVG inline | Done                          |
| **Modern codecs**         | KImageFormats plugins            | Match Qt major       | HEIC, AVIF, JXL, EXR, EPS                  | Browser codecs + flags in `types.ts`     | Medium — decode OK, EXIF weak |
| **Metadata**              | Exiv2                            | Submodule / system   | Read/write EXIF, IPTC, XMP, BMFF, previews | `formats/exif.ts` (read), future `exifr` | High — XMP/IPTC gap           |
| **RAW develop**           | LibRaw                           | Submodule            | `unpack`, `dcraw_process`, thumb extract   | None (preview-only policy)               | Low unless WASM               |
| **RAW post-process**      | OpenCV                           | Submodule            | Demosaic, gamma, noise, resize             | Canvas 2D / WebGL / OpenCV.js            | Low                           |
| **TIFF multipage**        | libtiff                          | Optional             | `loadTIFF`, page index                     | `utif` or server                         | Medium                        |
| **PSD**                   | libqpsd (Unix) / Qt plugin       | 3rdparty             | `loadPSD`                                  | None for MVP                             | Low                           |
| **Zip archives**          | Quazip                           | Optional OFF default | `DkFileInfo` zip members                   | File System Access (no zip browse)       | Low                           |
| **Thumbnails (compute)**  | Qt + OpenCV `INTER_AREA`         | —                    | `DkImage::createThumb`                     | `thumbnail.ts` canvas scale              | Done                          |
| **Thumbnails (cache)**    | `DkCachedThumb` XDG PNG          | —                    | Disk LRU + shared thumbs                   | IndexedDB blob store (proposed)          | High                          |
| **Color**                 | `QColorSpace`, ICC               | Qt 6.8+ CMYK path    | Loader color space normalize               | sRGB canvas assumption                   | Medium                        |
| **Network sync**          | Qt Network TCP                   | —                    | `DkConnection` multi-instance              | `BroadcastChannel`                       | Low (different scope)         |
| **i18n**                  | Qt linguist / Crowdin            | —                    | 30+ locales                                | English only                             | Low                           |
| **Batch / plugins**       | `QLibrary` plugins               | —                    | Native manipulators                        | ZIP export, WASM modules                 | Low                           |

---

## Exiv2 vs gallery TypeScript parser

| Capability                  | Exiv2 in nomacs                                   | Gallery today                 |
| --------------------------- | ------------------------------------------------- | ----------------------------- |
| JPEG APP1 EXIF              | Yes                                               | Yes (`exif.ts`)               |
| PNG eXIf / WebP EXIF        | Yes                                               | Partial                       |
| TIFF IFD chains (RAW)       | Yes                                               | Yes (`raw.ts`)                |
| BMFF (HEIC/AVIF/JXL)        | `EXV_ENABLE_BMFF` / `enableBMFF(true)` at startup | Browser image only            |
| IPTC                        | Yes                                               | No                            |
| XMP read/write              | Yes + sidecar                                     | No                            |
| Embedded preview extract    | `PreviewManager` largest                          | Custom IFD + JPEG scan        |
| MakerNote decode            | Partial                                           | Opaque blob UI                |
| Write + shrink guard        | 50% size reject (#995)                            | No write                      |
| Orientation compose on save | `setOrientation`                                  | `composeOrientation` (future) |

**Recommendation:** Keep custom parser for hot path (grid EXIF); add **exifr** (MIT) in worker for HEIC/XMP when bundle budget allows. Do not ship GPL Exiv2 WASM without legal review.

---

## LibRaw vs gallery RAW path

| Stage        | nomacs (`DkRawLoader`)                                           | Gallery                        |
| ------------ | ---------------------------------------------------------------- | ------------------------------ |
| Fast open    | `loadPreview` → Exiv2 largest preview                            | `parseRawMeta` IFD tags        |
| LibRaw thumb | `unpack_thumb` + JPEG                                            | Same embed tags                |
| Full develop | `dcraw_process` + OpenCV pipeline                                | Not implemented                |
| Settings     | `loadRawThumb`, `filterRawImages`                                | N/A                            |
| Tone issues  | [#1578](https://github.com/nomacs/nomacs/issues/1578) bright DNG | Show “embedded preview” banner |

**WASM options:** `libraw-wasm` (LGPL — compliance required), or stay preview-only indefinitely per playbook Phase 1.

---

## OpenCV usage map (when enabled)

| Feature                      | nomacs file             | Web substitute                  |
| ---------------------------- | ----------------------- | ------------------------------- |
| Bayer demosaic               | `DkRawLoader::demosaic` | LibRaw WASM or skip             |
| Gamma / white balance        | `DkRawLoader`           | None                            |
| High-quality thumb downscale | `DkImageStorage.cpp`    | `imageSmoothingQuality: 'high'` |
| Image manipulators           | `DkManipulatorsIpl`     | Canvas filters / future WASM    |
| Histogram                    | `DkHistogramEngine`     | Worker + Canvas 2D              |
| Page extraction plugin       | `PageExtractionPlugin`  | ML segmentation (out of scope)  |

OpenCV.js is ~8MB+; only consider for histogram or demosaic if product accepts load cost.

---

## Qt / KImageFormats vs browser codecs

| Format          | nomacs path                                                                                                              | Browser (2026)        | Gallery `IMAGE_EXTENSIONS`                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------- |
| JPEG            | Qt + Exiv2                                                                                                               | Native                | `.jpg`, `.jpeg`                                                 |
| PNG             | Qt                                                                                                                       | Native                | `.png`                                                          |
| WebP            | Qt                                                                                                                       | Native                | `.webp`                                                         |
| GIF             | Qt                                                                                                                       | Native                | `.gif`                                                          |
| SVG             | Qt                                                                                                                       | Native                | `.svg`                                                          |
| AVIF            | KImageFormats + BMFF EXIF                                                                                                | Chrome/Firefox/Safari | `.avif` listed; BMFF **dimensions** in engine, no BMFF EXIF yet |
| HEIC/HEIF       | KImageFormats ([#257](https://github.com/nomacs/nomacs/issues/257), [#1503](https://github.com/nomacs/nomacs/pull/1503)) | Safari, Chrome        | Not listed — add when EXIF ready                                |
| JXL             | KImageFormats                                                                                                            | Emerging              | Not listed                                                      |
| DNG/ARW         | LibRaw + TIFF                                                                                                            | Preview parser only   | `.dng`, `.arw`                                                  |
| CR2/NEF/ORF/SR2 | LibRaw                                                                                                                   | Preview parser only   | `.cr2`, `.nef`, `.orf`, `.sr2`                                  |
| PSD             | libqpsd / plugin                                                                                                         | —                     | Gap                                                             |
| ZIP folder      | Quazip                                                                                                                   | —                     | Gap                                                             |

**Double-rotation risk:** nomacs `maybeTransformed` for HEIC/AVIF/JXL and Qt RAW plugins (`DkBasicLoader.cpp` 437–450). Gallery must use `image-orientation: from-image` and per-format `orientationBaked` flags.

---

## npm / WASM candidates (optional adoption)

| Need             | Package                  | License | Notes                       |
| ---------------- | ------------------------ | ------- | --------------------------- |
| EXIF/XMP read    | `exifr`                  | MIT     | Tree-shake; worker-friendly |
| HEIC decode/meta | `heic2any`, `libheif-js` | Various | Meta vs pixels split        |
| TIFF             | `utif`                   | MIT     | Multipage                   |
| ZIP              | `fflate`                 | MIT     | Archive browse              |
| RAW              | `libraw-wasm`            | LGPL    | Full develop; COOP/COEP     |
| ICC              | `icc-parser` + canvas    | MIT     | Color management v2         |

---

## Licensing summary (do not mix wrongly)

| Dependency             | License         | Gallery rule                                 |
| ---------------------- | --------------- | -------------------------------------------- |
| nomacs                 | GPLv3           | Behavior-only port                           |
| Exiv2                  | GPLv2+          | No static link in MIT app without compliance |
| LibRaw                 | LGPL            | WASM needs dynamic linking story             |
| Qt                     | LGPL/commercial | Not applicable on web                        |
| Reatom gallery example | MIT (monorepo)  | Keep TS clean-room implementations           |

---

## Suggested adoption order for jsx-gallery

1. **IndexedDB thumbnail cache** — replaces `DkCachedThumb` semantics (highest perf win).
2. **exifr worker** — HEIC/XMP without GPL.
3. **Duplicate basename filter** — ports `filterDuplicateNames` (no new deps).
4. **utif** — multipage TIFF badge.
5. **LibRaw WASM** — only if preview-only is insufficient after user research.

See [nomacs-exif-reference.md](./nomacs-exif-reference.md) for orientation/flash/compression behavior that must stay aligned regardless of dependency choices.
