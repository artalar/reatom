import { addChangeHook, atom, reatomBoolean } from '@reatom/core'
import { mount, stylesheet } from '@reatom/jsx'

import type { Admin } from '../../index'
import type { AdminOptions } from '../../index'
import { createAdmin } from '../../index'
import { ADMIN_FRAME } from '../../root'
import { colors, focusVisible } from '../styles'
import { AppShell } from './AppShell'

const MAX_Z = 2 ** 32 - 1
const MIN_PANEL_WIDTH = 360
const MIN_PANEL_HEIGHT = 320
const PANEL_MARGIN = 16
const DEFAULT_WIDTH = '560px'
const DEFAULT_HEIGHT = '760px'
let devtoolsCounter = 0

export interface AdminDevtoolsOptions extends AdminOptions {
  initVisibility?: boolean
  initialWidth?: string
  initialHeight?: string
}

export interface AdminDevtools {
  admin: Admin
  containerId: string
  show: () => void
  hide: () => void
}

function parsePixelSize(value: string): number | null {
  if (!value.endsWith('px')) return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clampPanelWidth(value: string): string {
  const parsed = parsePixelSize(value)
  if (parsed === null) return value

  const maxWidth = Math.max(
    MIN_PANEL_WIDTH,
    window.innerWidth - PANEL_MARGIN * 2,
  )
  return `${Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, parsed))}px`
}

function clampPanelHeight(value: string): string {
  const parsed = parsePixelSize(value)
  if (parsed === null) return value

  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT,
    window.innerHeight - PANEL_MARGIN * 2,
  )
  return `${Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, parsed))}px`
}

export function createAdminDevtools(
  options: AdminDevtoolsOptions = {},
): AdminDevtools {
  const {
    initVisibility = true,
    initialWidth = DEFAULT_WIDTH,
    initialHeight = DEFAULT_HEIGHT,
    ...adminOptions
  } = options

  const admin = createAdmin(adminOptions)

  return ADMIN_FRAME.run(() => {
    const previousStylesheet = stylesheet()
    const id = `_ReatomAdminDevtools_${++devtoolsCounter}`
    const container = globalThis.document.createElement('div')
    container.id = id
    const root = container.attachShadow({ mode: 'open' })
    const sheet = new CSSStyleSheet()
    root.adoptedStyleSheets = [sheet]

    for (const rule of Array.from(previousStylesheet.cssRules)) {
      sheet.insertRule(rule.cssText)
    }

    stylesheet.set(sheet)

    const visible = reatomBoolean(initVisibility, '_Admin.devtools.visible')
    const minimized = reatomBoolean(false, '_Admin.devtools.minimized')
    const width = atom(clampPanelWidth(initialWidth), '_Admin.devtools.width')
    const height = atom(
      clampPanelHeight(initialHeight),
      '_Admin.devtools.height',
    )
    const restoredWidth = atom(
      clampPanelWidth(initialWidth),
      '_Admin.devtools.restoredWidth',
    )
    const restoredHeight = atom(
      clampPanelHeight(initialHeight),
      '_Admin.devtools.restoredHeight',
    )

    const getPointerEvent = (event: Event): PointerEvent | null => {
      return event instanceof PointerEvent ? event : null
    }

    const minimizePanel = () => {
      restoredWidth.set(width())
      restoredHeight.set(height())
      minimized.setTrue()
    }

    const expandPanel = () => {
      width.set(clampPanelWidth(restoredWidth()))
      height.set(clampPanelHeight(restoredHeight()))
      minimized.setFalse()
    }

    const resizeHandle = (
      <div
        aria-label="Reatom Admin devtools resize handle"
        tabindex={0}
        css={`
          position: absolute;
          top: 8px;
          left: 8px;
          width: 14px;
          height: 14px;
          background:
            linear-gradient(
              135deg,
              transparent 35%,
              ${colors.accent} 35%,
              ${colors.accent} 55%,
              transparent 55%
            ),
            linear-gradient(
              135deg,
              transparent 55%,
              ${colors.textMuted} 55%,
              ${colors.textMuted} 70%,
              transparent 70%
            );
          border-radius: 4px;
          cursor: nwse-resize;
          touch-action: none;
          z-index: ${MAX_Z};
          opacity: 0.65;
          pointer-events: auto;
          ${focusVisible}
        `}
        on:pointerdown={(event: Event) => {
          const pointerEvent = getPointerEvent(event)
          if (!pointerEvent) return
          if (event.currentTarget instanceof Element) {
            event.currentTarget.setPointerCapture(pointerEvent.pointerId)
          }
        }}
        on:pointermove={(event: Event) => {
          const pointerEvent = getPointerEvent(event)
          if (!(event.currentTarget instanceof Element) || !pointerEvent) return

          if (event.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
            width.set(
              clampPanelWidth(`${window.innerWidth - pointerEvent.clientX}px`),
            )
            height.set(
              clampPanelHeight(
                `${window.innerHeight - pointerEvent.clientY}px`,
              ),
            )
          }
        }}
      />
    )

    const expandPill = (
      <button
        type="button"
        aria-label="Expand Reatom devtools"
        css={`
          all: unset;
          box-sizing: border-box;
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid ${colors.borderStrong};
          background:
            radial-gradient(
              circle at 30% 25%,
              ${colors.accentSoft},
              transparent 55%
            ),
            ${colors.surfaceRaised};
          color: ${colors.accent};
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 1rem;
          font-weight: 750;
          cursor: pointer;
          box-shadow: 0 12px 28px -16px ${colors.shadow};
          ${focusVisible}
        `}
        on:click={() => expandPanel()}
      >
        R
      </button>
    )

    const panel = (
      <div
        data-reatom-name="DevtoolsPanel"
        css:width={() => (minimized() ? '44px' : width())}
        css:height={() => (minimized() ? '44px' : height())}
        css={`
          all: initial;
          position: fixed;
          inset-inline-end: 1rem;
          inset-block-end: 1rem;
          width: var(--width);
          height: var(--height);
          max-width: calc(100vw - 2rem);
          max-height: calc(100vh - 2rem);
          z-index: ${MAX_Z};
          background: ${() => (minimized() ? 'transparent' : colors.bg)};
          border: ${() =>
            minimized() ? 'none' : `1px solid ${colors.borderStrong}`};
          border-radius: ${() => (minimized() ? '999px' : '16px')};
          box-shadow: ${() =>
            minimized() ? 'none' : `0 24px 48px -28px ${colors.shadow}`};
          font-family: system-ui, sans-serif;
          font-size: 12px;
          box-sizing: border-box;
          overflow: hidden;
        `}
      >
        {() => (minimized() ? expandPill : null)}
        {() => (minimized() ? null : resizeHandle)}
        <div
          css={`
            height: 100%;
            min-height: 0;
            overflow: hidden;
            border-radius: inherit;
            display: ${() => (minimized() ? 'none' : 'block')};
          `}
        >
          <AppShell admin={admin} onMinimize={minimizePanel} />
        </div>
      </div>
    )

    const mountHost = document.createElement('div')
    root.append(mountHost)
    const mountPoint = document.createElement('div')
    mountHost.append(mountPoint)
    mount(mountPoint, panel)

    let bodyMount: { unmount: () => void } | null = null
    if (visible()) {
      bodyMount = mount(document.body, container)
    }

    addChangeHook(visible, (state) => {
      if (state) {
        bodyMount = mount(document.body, container)
      } else {
        bodyMount?.unmount()
        bodyMount = null
      }
    })

    return {
      admin,
      containerId: id,
      show: () => {
        ADMIN_FRAME.run(() => visible.setTrue())
      },
      hide: () => {
        ADMIN_FRAME.run(() => visible.setFalse())
      },
    }
  })
}
