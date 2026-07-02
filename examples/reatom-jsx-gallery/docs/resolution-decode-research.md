# Resolution-aware decode — research findings

## TL;DR

- **Oversize threshold: ~1.5× linear** (≈2.25× area), compared against the *exact needed* display size — never against a quantized bucket (see red-team finding 1). The 1.3–2× band is the *worst zone* for big images: Chrome's paint path only switches to a cheaper mip decode at ≥2× linear downscale, so a 1.5× oversized 50 MP image gets a *full* decode either way; above ~1.5× manual resize-decode clearly wins for any pipeline that calls `img.decode()`.
- **Fit-to-viewport decode ceiling = the current physical panel long edge** (reactive `screen.width × DPR`). 3840 covers ~99% of desktops (1080p ≈ 51% Steam / 20% StatCounter, 1440p ≈ 21%, 4K ≈ 5%, MacBook Pro 16" Retina = 3456); only Apple 5K/6K (~1%) go higher. The fixed bucket ladder originally recommended here was dropped after adversarial review — decode at exact needed size instead.
- **Small-original floor: 4 MP, lightbox only** (revised twice: Full HD → 12 MP → 4 MP). The 12 MP modal photo must *not* get the shortcut — on 1080p it is ~2.1× oversized, exactly the cheap 1/2 IDCT decode. `'original'` decode is additionally gated by a **~96 MB pin budget counting preloads**; 24–32 MP is where a single pinned decode becomes risky (32 MP × 4 B = 128 MB = Chrome's entire default decode working set).
- **Never re-encode the resized bitmap to a JPEG blob for display.** Paint via a `bitmaprenderer` canvas — but the reactive atom must yield the **canvas element**, not the raw `ImageBitmap` (`transferFromImageBitmap` is one-shot; a bitmap-valued atom breaks on re-mount). Use `resizeQuality: 'medium'` — Chrome's `'high'` downscale has known quality bugs.
- **Chrome decode-cache claims confirmed** with source constants and bug tracker issues (see below). `img.decode()` pins at full natural size; CSS paint decodes at mip scale.
- **Two assumptions require measured spikes before implementation**: IDCT decode-to-scale reachability through `createImageBitmap`, and `'medium'` downscale quality at >2× ratios (see section 7).

## 1. Desktop dimensions and DPR (2025–2026)

| Signal | Value | Source |
| --- | --- | --- |
| 1920×1080 share | ~20% worldwide StatCounter, ~51% Steam | [StatCounter](https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide), [Steam HW Survey](https://store.steampowered.com/hwsurvey/) |
| 2560×1440 | ~8% StatCounter aggregate, ~21% Steam | same |
| 3840×2160 | ~5% both | same |
| 1536×864 (1080p @ 125% Windows) | ~7% | StatCounter |
| DPR distribution (est.) | 1×: ~50%, 1.25–1.5×: ~15–20%, 2×: ~25–35% (all Mac Retina is 2×) | derived; no direct DPR census exists |
| MacBook Pro 16" | 1728×1117 CSS @2× = 3456 physical | [Apple/9to5mac](https://9to5mac.com/2021/10/19/new-macbook-pro-screen-resolution-options/) |
| Studio Display 5K / Pro Display XDR | 5120 / 6016 physical, <1% share | — |

Effective viewport: maximized browser loses ~110–130 CSS px vertically (tabs + taskbar/menu bar). `deviceLongEdge ≈ max(innerWidth, innerHeight) × devicePixelRatio ≈ physical panel long edge`.

**Original recommendation was a bucket ladder (1280 → 1920 → 2560 → 3840, optional 5120)** with ~99% coverage at 3840. **Superseded** (section 7, finding 1/3): without a cross-size cache the rungs bought nothing, quantizing above the physical panel decoded pixels the display can never show, and the residual paint scale cost a second resampling generation. Current design: decode at exact needed size, clamped to the reactive panel long edge; the population data above still justifies treating >3840 panels (~1%) as the rare case.

## 2. Chrome decode cache — verified claims and bugs

All three claims from `chrome-image-decode-cache.md` are **confirmed**:

| Claim | Status | Evidence |
| --- | --- | --- |
| `decode()` pins frames in a limited cache | Confirmed | Working set **128 MB default, 256 MB when RAM ≥ 4 GB, 32 MB low-end** — [`cc/tiles/image_decode_cache_utils.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/cc/tiles/image_decode_cache_utils.cc); plus Blink 64 MB lock budget (`kLockedMemoryLimitBytes`) in [`platform/graphics/image.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/graphics/image.cc) |
| `EncodingError` under cache pressure, not just corruption | Confirmed | `ImageController::CompleteTaskForRequest` returns FAILURE when the image "doesn't fit into memory" — [`cc/tiles/image_controller.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/cc/tiles/image_controller.cc); same `EncodingError` string for all failure modes ([`image_loader.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/loader/image_loader.cc)) |
| 54 MP ≈ 241 MB exceeds budget; paint still works | Confirmed | `decode()` builds `DrawImage` at full natural size (no scale); paint path uses **raster-scale mip caching** — [`gpu_image_decode_cache.h`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/cc/tiles/gpu_image_decode_cache.h) |

Bug tracker issues:

- [issues.chromium.org/40676514](https://issues.chromium.org/issues/40676514) (legacy [crbug.com/1055828](https://crbug.com/1055828)) — parallel `img.decode()` hitting the memory/cache limit.
- [issues.chromium.org/40261318](https://issues.chromium.org/issues/40261318) — batch/concurrent `img.decode()` on valid images rejecting with `EncodingError`.
- [WHATWG html#2037](https://github.com/whatwg/html/issues/2037) — Chrome engineer confirms decode() locks the frame in the raster-time cache.
- [WHATWG html#11935](https://github.com/whatwg/html/issues/11935) — proposal to give `decode()` a destination size (the exact gap this project works around).
- Newer Chrome has `kResolveLargeImageDecodes` (default enabled, [`cc/base/features.cc`](https://chromium.googlesource.com/chromium/src/+/master/cc/base/features.cc)): too-large decodes may resolve *without pinning* ("soft guarantee") — concurrent pressure still yields `EncodingError` in the wild.

## 3. Manual resize vs native downscale

- **JPEG decode-to-scale exists at n/8 factors** (libjpeg-turbo IDCT scaling, 1/8…7/8). The compositor mip path uses it; `createImageBitmap(blob, {resizeWidth…})` *should* per the fused-blit design, but the evidence is mixed ([SkJpegCodec](https://github.com/google/skia/blob/master/src/codec/SkJpegCodec.cpp), [Chromium fused-blit commit](https://github.com/chromium/chromium/commit/d1df22e3c6617efc41ac12c431395d28f83f9c25)) — **must be verified by the spike in §7.8 before the perf constants are trusted**.
- **Native paint mip levels only kick in at ≥2× linear downscale** (mip 1 = ½ per axis). A 1.3–2× oversized image is full-decoded even for CSS paint — and `img.decode()` *always* pins full size. Hence the crossover: **manual resize pays off from ~1.5× linear** for a decode()-driven gallery.
- **Do not re-encode the resized bitmap to JPEG for display**: encode of a ~4K bitmap is tens to hundreds of ms plus a second decode. Paint the `ImageBitmap` via `canvas` (`bitmaprenderer` / `transferFromImageBitmap`) — noting the transfer is one-shot, so any cached/reactive value must be the canvas element, not the bitmap (§7.4). Re-encode only for IndexedDB/disk caching. ([scheduler-dev thread](https://groups.google.com/a/chromium.org/g/scheduler-dev/c/CFuzg2g-obI/m/NxV-zvCNAAAJ), [SO 67148570](https://stackoverflow.com/questions/67148570/memory-leak-in-javascript-webworker-canvas-indexeddb))
- **`resizeQuality`**: use `'medium'`; Chrome `'high'` downscale has quality bugs ([WPT interop #731](https://github.com/web-platform-tests/interop/issues/731), [crbug 40044062](https://issues.chromium.org/issues/40044062)); pica disables `createImageBitmap` resize by default for this reason.
- **Decode throughput ≈ 100–300 Mpx/s desktop** (~150 typical): 2 MP ≈ 13 ms, 12 MP ≈ 80 ms, 24 MP ≈ 160 ms, 50 MP ≈ 330 ms full decode; with IDCT scaling the cost tracks *output* pixels.

## 4. Size tiers and hard limits

Realistic source tiers: phones 12–24 MP (48 MP opt-in), mainstream mirrorless 24–45 MP, high-res FF 61–67 MP, medium format ~102 MP, panoramas open-ended. JPEG MB ≈ MP ÷ 8–12.

Hard limits: Chrome canvas 32767 px/axis (268 Mpx area); Firefox 65535/axis; **Safari desktop 16384/axis**; desktop Chrome has no decoded-image byte cap for `<img>` (mobile: RAM/25). PhotoSwipe recommends ≤3000×3000 (~9 MP) for smooth pan/zoom; tile pyramids (OpenSeadragon-style, 512–1024 px tiles) become necessary around **≥50 MP source or when max zoom needs >8192 px decoded long edge**.

Risk ladder for a single pinned decode: **≤12 MP safe → 12–32 MP downscale-decode for fit → >32 MP never pin full res** (paint-time fallback or, later, tiles).

## 5. Real-world image resolution distribution (2024–2026)

### Consumer libraries (phone-dominated)

| Long edge | MP | Share | What it is |
| --- | --- | --- | --- |
| ≤1280 px | 0.5–2 | ~12–14% | Telegram/Instagram saves, memes |
| 1600–2048 px | 2–3.5 | ~8–10% | WhatsApp (~1600), Messenger (~2048) |
| 2400–2800 px | 3–4.5 | ~10–12% | Screenshots (device screen res) |
| **~4000 px** | **~12** | **~50%** | **Mode.** Android binned default (12–12.5 MP regardless of 50–200 MP sensors), iPhone 6s–14, and Night/Portrait/tele shots on newer iPhones |
| ~5712 px | ~24 | ~18–22% | iPhone 14 Pro+ daylight default (since 2022) |
| ≥8000 px | 48+ | 1–3% | Opt-in 48 MP / ProRAW / 200 MP modes |

Median ~10–12 MP, 90th percentile ~12–13 MP, 99th ~24 MP. **HEIC is ~35–42% of files** (all iPhone camera output) — note HEIC has no JPEG-style IDCT decode-to-scale, so resize-decode saves memory but not decode CPU for HEIC. Sources: TelemetryDeck iPhone model survey, Counterpoint sensor stats, Avast 3B-photo study (31% WhatsApp images), DB Labs 2026 library composition, Phasm/Lifehacker messaging compression tests.

### Photographer libraries (street/enthusiast)

| MP band | Dimensions | Share (est.) | Cameras |
| --- | --- | --- | --- |
| 24–26 | 6000×4000 | ~40–50% | Ricoh GR III/IV, X100V, Nikon Zf, R6 II, volume APS-C |
| 33 | 7008×4672 | ~10–15% | Sony A7 IV / A7C II |
| **40** | **7728×5152** | **~25–35% and growing** | X100VI (#1 Map Camera FY2024), X-T5/X-T50 |
| 45–61 | 8192×5464–9504×6336 | ~5–10% | R5 II, Z8, A7R V, Leica Q3 |
| Panoramas | 9600–30,000+ px wide, up to 65k/512 MP (Adobe ceiling) | rare but real | in-camera + Lightroom stitches |

File sizes: 24 MP JPEG Fine 8–15 MB, 40 MP 10–20 MB, 61 MP 35–52 MB; RAW 20–83 MB. RAW embedded previews: **Sony/Canon/Nikon carry a full-resolution `JpgFromRaw`**; **Fuji RAF only ~4416×2944**; all have a ~1616×1080 fallback preview. RAW+JPEG pairs dominate (~64% poll), JPEG-only strong among Fuji/Ricoh street shooters. Sources: Map Camera FY2024 ranking, BCN 2025, CIPA shipments (compacts +30% YoY), Flickr Camera Finder 2025, Alpha Shooters / pal2tech file-size measurements.

### Algorithm consequences

1. **The modal case (12 MP on a 1080p/1920-bucket display) is ~2.1× oversized** — exactly libjpeg-turbo's 1/2 IDCT scale. Resize-decode is the decode there: ~20 ms / 12 MB vs ~80 ms / 48 MB full. So the "small original" floor must sit *below* 12 MP, not at it.
2. New floor: `SMALL_ORIGINAL_MEGAPIXELS = 4` (messaging saves + screenshots tier, ~20–35% of consumer items): full decode ≤ ~27 ms / ≤16 MB — resize logic is pure overhead. Between 4 and 12 MP the standard 1.5× tolerance rule decides (on Retina/4K displays a 12 MP image is within tolerance and decodes original anyway; on 1080p it gets the cheap half-scale decode).
3. **Photographer bands 24–61 MP make resize-decode the primary lightbox path**, not an edge case — quality (`resizeQuality: 'medium'`, n/8 snapping) and the thumbnail-first swap matter most here. Their fit ratios on common displays: 24 MP → 3840 is ~1.56× (resize), 40 MP → 3840 ≈ 2× (1/2 IDCT, ideal), 61 MP → 3840 ≈ 2.5×.
4. **Panoramas need axis clamps**: any resize target must clamp each axis to Safari's 16384 canvas limit (Chrome 32767) and extreme aspect ratios must fit-scale by the *constrained* axis; the 24 MP intermediate cap already bounds total memory.
5. **RAW strategy per brand**: prefer the embedded `JpgFromRaw` (full-res on Sony/Canon/Nikon) as the lightbox source and resize-decode it like a normal JPEG; only Fuji (≤4416 px preview) needs develop for targets above ~2560 or deep zoom.
6. **HEIC (~40% of consumer files)**: decode cost is full-size regardless of resize; still resize for memory, but don't expect the IDCT speedup — thumbnail-first swap carries the UX.

## 6. Consequences applied to this gallery

(As corrected by the adversarial review in section 7.)

1. Keep `maxParallelImageDecodes = 1` for `img.decode()` originals and the `EncodingError` → undecoded-element fallback — both independently validated. Sized `createImageBitmap` decodes get a **separate lane** (concurrency 2, in-flight output budget, current > zoom upgrade > preload priority with preemption): they never touch the compositor cache, and sharing the slot caused priority inversion (a 61 MP preload blocking the user's zoom upgrade).
2. Decode policy (lightbox): original when `oversize ≤ 1.5×` of *exact needed* **and** `originalBytes × (1 + preloads) ≤ ~96 MB` pin budget, **or** original ≤ 4 MP; otherwise resize-decode to exactly `needed` (clamped to panel long edge and 16384/axis), skipping the resize when output area would be ≥ 0.7× of original. Inputs are **EXIF-orientation-normalized dimensions** (portraits fit on the wrong axis otherwise).
3. Zoom tiers: per-image rungs at n/8 fractions of the source long edge, capped at ~24 MP each; `'original'` only at `target ≥ original` within the pin budget. This closes the 40 MP dead zone (zoom 1.5–10× otherwise degraded to fallback quality).
4. Resized lightbox tier: the computed yields a **canvas element** (bitmap transferred inside the computed; teardown zeroes `canvas.width/height` — `bitmap.close()` after transfer frees nothing). Thumbnails keep the existing blob-URL pipeline (many long-lived `<img>` consumers), and the 4 MP floor does **not** apply to grid slots.
5. Eviction: sized tiers live for current ± 2 lightbox neighbors only; upgrade-monotonic only within that window; re-entry recomputes from the current viewport. (First draft had no eviction — a 100-photo session on 4K would retain ~4.4 GB.)
6. RAW routes *through* the policy via a source-blob selector (`JpgFromRaw` first; LibRaw develop capped by the same target atom). HEIC gets a startup capability probe — Chromium/Firefox do not decode HEIC at all, so unsupported formats fall back to thumbnail/EXIF preview rather than queueing doomed decodes.
7. Deep zoom (10×) on >32 MP sources stays on the largest ≤24 MP rung + paint-time fallback; tile pyramid is future work.

## 7. Adversarial review (red team) — key corrections

A Fable subagent attacked the first plan draft; 15 weaknesses were found. The ones that changed the design:

1. **Tolerance vs bucket mismatch broke the Apple core cases.** 12 MP on MBP 14": bucket quantize-up to 3840 meant full-decode cost for a bitmap 8% smaller than the original. 24 MP on MBP 16": 1.92× oversized vs needed but 1.49× vs the bucket → tolerance kept `'original'` → 98 MB pinned, ×2 with preload → EncodingError churn on the most common enthusiast file/machine pair. Fix: decide on raw needed; output exact-fit; pin-budget gate.
2. **Zoom dead zone on 40 MP** (X100VI): no rung existed between display-ladder max and `original/1.5`, and the `'original'` jump pinned 159 MB. Fix: n/8-of-source rungs + `target ≥ original` threshold.
3. **Grid regression**: "≤4 MP → original regardless of slot" would decode hundreds of 16 MB screenshot originals during scroll. Fix: floor is lightbox-only.
4. **One-shot transfer**: returning a raw `ImageBitmap` from an atom breaks on any re-mount. Fix: yield the canvas element.
5. **No eviction story** existed at all. Fix: current ± 2 window.
6. **Orientation**: policy math used pre-orientation dims (wrong fit axis for every portrait), and combining `imageOrientation: 'from-image'` with `resizeWidth/Height` is cross-browser-undefined for orientations 5–8. Fix: normalize dims first; resize in source space with `'none'`; bake orientation via the existing helper.
7. **Priority inversion** from the shared decode slot. Fix: two lanes (see §6.1).
8. **Unverified load-bearing assumptions** → mandatory spikes: (a) does `createImageBitmap(blob, {resizeWidth})` actually reach libjpeg-turbo IDCT scaling (the 20-vs-80 ms numbers depend on it; evidence is mixed); (b) does `'medium'` single-pass downscale at 2.5× moiré on fine detail (brick/fabric — street-photo staples) vs iterative ≤2× halving. Today's compositor mip path is a proper power-of-two prefilter; shipping worse-than-status-quo fit quality for 40–61 MP files is unacceptable.
9. **HEIC (~40% of consumer files) does not decode in Chromium/Firefox.** Probe + fallback routing now; libheif WASM worker (with HEIC tile-grid partial decode as a deep-zoom bonus) as follow-up.
10. **RAW chain contradiction**: RAW elements sat above `sizedImage` in display precedence, so RAW never benefited from the policy — while the 61 MP A7R V develop is the file that needs it most. Fix: source-blob selector inside `sizedImage`.

Also reactive-display handling: the panel ceiling must re-read `screen.width` on the matchMedia DPR-change event (fires on display moves) — dragging the window from a 5K Studio Display to the laptop panel must not leave stale decode ceilings in either direction.
