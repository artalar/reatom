import { onEvent, wrap } from '@reatom/core'

import { resolveImageOrientationStyle } from '../image-engine/orientation'
import {
  bindLightboxHideControlsAfterInactivity,
  bindLightboxResetSessionOnClose,
  closeLightbox,
  copyLightboxImageAsJpeg,
  downloadLightboxImage,
  endLightboxPan,
  handleLightboxKeyDown,
  ignoreExifOrientation,
  lightboxControlsVisible,
  lightboxCounter,
  lightboxDetailsButtonLabel,
  lightboxDialogLabel,
  lightboxDisplayOrientationStyle,
  lightboxFavoriteButtonLabel,
  lightboxFullscreenButtonLabel,
  lightboxImage,
  lightboxImageCursor,
  lightboxImageFrameSize,
  lightboxImageTransform,
  lightboxIsFullscreen,
  lightboxOpen,
  lightboxPreloadImageElement,
  lightboxPreloadImageUrl,
  lightboxScrubberMax,
  lightboxScrubberValue,
  lightboxShowControlsFromPointer,
  lightboxZoomIn,
  lightboxZoomOut,
  lightboxZoomReset,
  moveLightboxPan,
  navigateLightbox,
  openLightboxAtVisibleIndex,
  resetLightboxSession,
  showLightboxScrubber,
  startLightboxPan,
  thumbnailWindow,
  toggleLightboxImageFavorite,
  visibleImages,
  visibleIndexMap,
} from '../model'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CopyJpegIcon,
  DownloadIcon,
  FitIcon,
  FullscreenIcon,
  HeartIcon,
  InfoIcon,
  MinusIcon,
  PlusIcon,
} from './Icons'
import { imageInfoPanelOpen } from './panelState'
import { pressEvents } from './pressEvents'
import { Slideshow } from './Slideshow'

const controlBtnCss = `
  background: var(--overlay-control);
  border: var(--border-width) var(--control-border-style) rgba(255, 255, 255, 0.12);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-round);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: background 0.2s;
  backdrop-filter: blur(12px);
  box-shadow: var(--glow);
  &:hover { background: var(--overlay-control-hover); }
`

const navBtnCss = `
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--overlay-control);
  border: var(--border-width) var(--control-border-style) rgba(255, 255, 255, 0.12);
  color: #fff;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-round);
  cursor: pointer;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, opacity 0.2s;
  z-index: 1010;
  opacity: 0.7;
  backdrop-filter: blur(12px);
  box-shadow: var(--glow);
  &:hover { background: var(--overlay-control-hover); opacity: 1; }
`

const fullscreenExitGuardMs = 500

const lightboxImageFrameCss = `
  display: flex;
  pointer-events: auto;
  > img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    outline: none;
    pointer-events: auto;
  }
`

const LightboxContent = () => {
  let lightboxElement: HTMLDivElement | null = null
  let lightboxImageElement: HTMLImageElement | null = null
  let focusFrame: number | null = null
  let fullscreenTransition: Promise<void> | null = null
  let fullscreenEnteredAt = 0

  const focusLightboxImage = () => {
    if (focusFrame !== null) cancelAnimationFrame(focusFrame)
    focusFrame = requestAnimationFrame(() => {
      focusFrame = null
      lightboxImageElement?.focus({ preventScroll: true })
    })
  }

  const setLightboxImageElement = (element: HTMLImageElement) => {
    lightboxImageElement = element
    element.tabIndex = -1
    focusLightboxImage()
  }

  const displayImage = () => {
    const model = lightboxImage()
    if (!model) return null

    const rawPipelineImage = model.display.element()
    if (rawPipelineImage) {
      rawPipelineImage.alt = model.source.name
      rawPipelineImage.draggable = false
      const orientationStyle = lightboxDisplayOrientationStyle()
      if (orientationStyle) {
        rawPipelineImage.style.imageOrientation = orientationStyle
      } else {
        rawPipelineImage.style.removeProperty('image-orientation')
      }
      setLightboxImageElement(rawPipelineImage)
      return rawPipelineImage
    }

    const fullImage = model.fullImage.data()
    if (fullImage) {
      fullImage.alt = model.source.name
      fullImage.draggable = false
      const orientationStyle = resolveImageOrientationStyle(
        model.meta.data()?.exif,
        ignoreExifOrientation(),
      )
      if (orientationStyle) {
        fullImage.style.imageOrientation = orientationStyle
      } else {
        fullImage.style.removeProperty('image-orientation')
      }
      setLightboxImageElement(fullImage)
      return fullImage
    }

    const thumbnailUrl = model.thumbnail.data()?.url
    if (!thumbnailUrl) return null

    return (
      <img
        src={thumbnailUrl}
        alt={model.source.name}
        draggable={false}
        tabindex={-1}
        ref={setLightboxImageElement}
        style:image-orientation={lightboxDisplayOrientationStyle}
      />
    )
  }

  const pressLightboxControl = (action: () => void) => {
    const press = pressEvents(action)
    return {
      'on:mousedown': (event: MouseEvent) => {
        lightboxShowControlsFromPointer()
        press['on:mousedown'](event)
      },
      'on:click': press['on:click'],
      'on:keydown': press['on:keydown'],
    }
  }

  const handleFullscreenToggle = () => {
    if (fullscreenTransition) return

    const fullscreenOpened = document.fullscreenElement === lightboxElement
    if (
      fullscreenOpened &&
      performance.now() - fullscreenEnteredAt < fullscreenExitGuardMs
    ) {
      return
    }

    const fullscreenPromise = fullscreenOpened
      ? document.exitFullscreen()
      : lightboxElement?.requestFullscreen()

    if (!fullscreenPromise) return

    fullscreenTransition = fullscreenPromise
    fullscreenPromise
      .catch(
        wrap(() => {
          lightboxIsFullscreen.set(
            document.fullscreenElement === lightboxElement,
          )
        }),
      )
      .finally(() => {
        fullscreenTransition = null
      })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lightboxDialogLabel}
      tabindex={-1}
      ref={(el) => {
        lightboxElement = el
        const stopHideControls = bindLightboxHideControlsAfterInactivity()
        const stopSessionReset = bindLightboxResetSessionOnClose()
        const updateFullscreenState = wrap(() => {
          const fullscreenOpened = document.fullscreenElement === el
          lightboxIsFullscreen.set(fullscreenOpened)
          if (fullscreenOpened) {
            fullscreenEnteredAt = performance.now()
            focusLightboxImage()
          }
        })

        el.focus({ preventScroll: true })
        focusLightboxImage()
        updateFullscreenState()
        const stopFullscreenListener = onEvent(
          document,
          'fullscreenchange',
          updateFullscreenState,
        )

        return () => {
          stopHideControls()
          stopSessionReset()
          stopFullscreenListener()
          if (focusFrame !== null) cancelAnimationFrame(focusFrame)
          resetLightboxSession()
          lightboxIsFullscreen.set(false)
          lightboxElement = null
          lightboxImageElement = null
        }
      }}
      attr:data-controls-visible={lightboxControlsVisible}
      on:keydown={handleLightboxKeyDown}
      on:click={(event: MouseEvent & { currentTarget: HTMLDivElement }) => {
        if (event.target === event.currentTarget) closeLightbox()
      }}
      on:mousedown={(event: MouseEvent) =>
        startLightboxPan(event.clientX, event.clientY)
      }
      on:mousemove={(event: MouseEvent) => {
        lightboxShowControlsFromPointer()
        moveLightboxPan(event.clientX, event.clientY)
      }}
      on:mouseup={endLightboxPan}
      on:mouseleave={endLightboxPan}
      css={`
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: var(--overlay-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        outline: none;
        user-select: none;
        .lightbox-control-layer {
          opacity: 1;
          pointer-events: auto;
          transition: opacity 0.35s ease;
        }
        &[data-controls-visible='false'] .lightbox-control-layer {
          opacity: 0;
          pointer-events: none;
        }
        &[data-controls-visible='false'] .lightbox-control-layer:focus-within {
          opacity: 1;
          pointer-events: auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .lightbox-control-layer {
            opacity: 1 !important;
            pointer-events: auto !important;
            transition: none !important;
          }
        }
      `}
    >
      <div
        class="lightbox-control-layer"
        css={`
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          z-index: 1010;
          background: linear-gradient(
            to bottom,
            var(--image-overlay),
            transparent
          );
        `}
      >
        <span
          aria-live="polite"
          aria-atomic="true"
          css="color: #fff; font-size: 14px; font-family: monospace;"
        >
          {() => lightboxCounter()}
        </span>
        <div
          style:margin-right={() => (imageInfoPanelOpen() ? '300px' : '0px')}
          css="display: flex; gap: 8px; align-items: center; transition: margin-right 0.3s ease;"
        >
          <button
            {...pressLightboxControl(toggleLightboxImageFavorite)}
            type="button"
            css={controlBtnCss}
            title={lightboxFavoriteButtonLabel}
            aria-label={lightboxFavoriteButtonLabel}
            aria-pressed={() => lightboxImage()?.favorite() ?? false}
          >
            {() => {
              const img = lightboxImage()
              return <HeartIcon filled={img?.favorite() ?? false} />
            }}
          </button>
          <button
            {...pressLightboxControl(downloadLightboxImage)}
            type="button"
            css={controlBtnCss}
            title="Download image"
            aria-label="Download image"
          >
            <DownloadIcon />
          </button>
          <button
            {...pressLightboxControl(copyLightboxImageAsJpeg)}
            type="button"
            css={controlBtnCss}
            title="Copy as JPEG"
            aria-label="Copy as JPEG"
          >
            <CopyJpegIcon />
          </button>
          <button
            {...pressLightboxControl(lightboxZoomOut)}
            type="button"
            css={controlBtnCss}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <MinusIcon />
          </button>
          <button
            {...pressLightboxControl(lightboxZoomReset)}
            type="button"
            css={controlBtnCss}
            title="Reset zoom"
            aria-label="Reset zoom"
          >
            <FitIcon />
          </button>
          <button
            {...pressLightboxControl(handleFullscreenToggle)}
            type="button"
            css={controlBtnCss}
            title={lightboxFullscreenButtonLabel}
            aria-label={lightboxFullscreenButtonLabel}
            aria-pressed={lightboxIsFullscreen}
          >
            <FullscreenIcon />
          </button>
          <button
            {...pressLightboxControl(lightboxZoomIn)}
            type="button"
            css={controlBtnCss}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <PlusIcon />
          </button>
          <button
            {...pressLightboxControl(imageInfoPanelOpen.toggle)}
            type="button"
            css={controlBtnCss}
            title={lightboxDetailsButtonLabel}
            aria-label={lightboxDetailsButtonLabel}
            aria-expanded={imageInfoPanelOpen}
          >
            <InfoIcon />
          </button>
          <button
            {...pressLightboxControl(closeLightbox)}
            type="button"
            css={controlBtnCss}
            title="Close preview"
            aria-label="Close preview"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        style:cursor={lightboxImageCursor}
        css={`
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          overflow: hidden;
          padding: 60px 80px 120px;
          pointer-events: none;
        `}
      >
        {() => {
          const img = lightboxImage()
          if (!img)
            return (
              <div css="color: #fff; font-size: 18px;">No image selected</div>
            )

          return (
            <div
              style:width={() => lightboxImageFrameSize().width}
              style:height={() => lightboxImageFrameSize().height}
              style:transform={lightboxImageTransform}
              css={lightboxImageFrameCss}
            >
              {displayImage}
            </div>
          )
        }}
      </div>

      {() => {
        lightboxPreloadImageElement()
        const preloadUrl = lightboxPreloadImageUrl()
        if (!preloadUrl) return null

        return (
          <img
            src={preloadUrl}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            draggable={false}
            css="position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;"
          />
        )
      }}

      <button
        class="lightbox-control-layer"
        {...pressLightboxControl(() => navigateLightbox(-1))}
        type="button"
        title="Previous image"
        aria-label="Previous image"
        css={`
          ${navBtnCss} left: 16px;
        `}
      >
        <ChevronLeftIcon />
      </button>
      <button
        class="lightbox-control-layer"
        {...pressLightboxControl(() => navigateLightbox(1))}
        type="button"
        title="Next image"
        aria-label="Next image"
        css={`
          ${navBtnCss} right: 16px;
        `}
      >
        <ChevronRightIcon />
      </button>

      <Slideshow
        class="lightbox-control-layer"
        onControlPress={lightboxShowControlsFromPointer}
      />

      {() => {
        if (!showLightboxScrubber() || visibleImages().length <= 1) return null

        return (
          <label
            class="lightbox-control-layer"
            css={`
              position: absolute;
              right: max(16px, calc(16px + var(--shadow-clearance, 0px)));
              bottom: 58px;
              display: grid;
              gap: 4px;
              min-width: min(260px, calc(100vw - 32px));
              padding: 8px 12px;
              border: var(--border-width) var(--control-border-style)
                rgba(255, 255, 255, 0.12);
              border-radius: var(--radius-md);
              background: var(--image-overlay);
              color: #fff;
              font-size: 11px;
              z-index: 1020;
              backdrop-filter: var(--panel-backdrop-filter);
              box-shadow: var(--glow);
            `}
          >
            <span>Folder position</span>
            <input
              type="range"
              min="0"
              max={lightboxScrubberMax}
              step="1"
              aria-label="Folder position"
              prop:value={lightboxScrubberValue}
              on:input={(event: Event) => {
                if (event.currentTarget instanceof HTMLInputElement) {
                  openLightboxAtVisibleIndex(event.currentTarget.valueAsNumber)
                }
              }}
              css="accent-color: var(--accent);"
            />
          </label>
        )
      }}

      <div
        class="lightbox-control-layer"
        css={`
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          gap: 4px;
          padding: 8px 16px 12px;
          background: linear-gradient(
            to top,
            var(--image-overlay),
            transparent
          );
          z-index: 1010;
          overflow-x: auto;
        `}
      >
        {() =>
          thumbnailWindow().map((imageNode) => (
            <button
              {...pressLightboxControl(() => {
                const index = visibleIndexMap().get(imageNode)
                if (index === undefined) return
                openLightboxAtVisibleIndex(index)
              })}
              type="button"
              title={() => `View ${imageNode.source.name}`}
              aria-label={() => `View ${imageNode.source.name}`}
              aria-current={() =>
                lightboxImage()?.id === imageNode.id ? 'true' : undefined
              }
              data-active={() => lightboxImage()?.id === imageNode.id}
              css={`
                flex-shrink: 0;
                padding: 2px;
                border: var(--border-width) var(--control-border-style)
                  transparent;
                background: none;
                cursor: pointer;
                border-radius: var(--radius-sm);
                transition:
                  border-color 0.2s,
                  opacity 0.2s;
                opacity: 0.6;
                &[data-active='true'] {
                  border-color: var(--accent);
                  opacity: 1;
                  box-shadow: var(--glow);
                }
                &:hover {
                  opacity: 1;
                }
              `}
            >
              {/* Thumbnail only: falling back to `fullImage.data()` would
                  subscribe it and trigger a full-resolution decode for every
                  strip entry whose thumbnail is still loading. */}
              <img
                src={() => imageNode.thumbnail.data()?.url ?? ''}
                alt=""
                css={`
                  width: 60px;
                  height: 40px;
                  object-fit: cover;
                  border-radius: var(--radius-xs);
                  display: block;
                `}
                draggable={false}
              />
            </button>
          ))
        }
      </div>
    </div>
  )
}

export const Lightbox = () => (
  <div css="display: contents;">
    {() => (lightboxOpen() ? <LightboxContent /> : null)}
  </div>
)
