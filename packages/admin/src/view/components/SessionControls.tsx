import { atom } from '@reatom/core'

import type { Admin } from '../../index'
import type { AdminAtom, AdminFrame, AdminSession } from '../../types'
import {
  buttonBase,
  buttonGhost,
  colors,
  flex,
  flexWrap,
} from '../styles'

export interface SessionControlsProps {
  admin: Admin
}

interface ImportedSessionPayload {
  session: AdminSession
  atoms: Record<string, AdminAtom>
  frames: Array<AdminFrame>
}

type ConfirmAction = 'clear' | 'fresh' | null

let importInputCounter = 0

const primaryControlButton = `
  ${buttonBase}
  font-size: 0.66rem;
  white-space: nowrap;
  min-height: 1.55rem;
  padding-inline: 0.45rem;
  padding-block: 0.18rem;
`

const secondaryControlButton = `
  ${buttonGhost}
  font-size: 0.64rem;
  white-space: nowrap;
  min-height: 1.55rem;
  padding-inline: 0.35rem;
  padding-block: 0.16rem;
`

function downloadJson(filename: string, data: unknown): void {
  const serialized = JSON.stringify(data, null, 2)
  const blob = new Blob([serialized], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function isImportedSessionPayload(
  value: unknown,
): value is ImportedSessionPayload {
  if (!value || typeof value !== 'object') return false

  if (!('session' in value) || !('atoms' in value) || !('frames' in value)) {
    return false
  }

  const session = value.session
  const atoms = value.atoms
  const frames = value.frames

  return (
    !!session &&
    typeof session === 'object' &&
    'id' in session &&
    typeof session.id === 'string' &&
    'startedAt' in session &&
    typeof session.startedAt === 'number' &&
    !!atoms &&
    typeof atoms === 'object' &&
    Array.isArray(frames)
  )
}

export const SessionControls = ({ admin }: SessionControlsProps) => {
  const inputId = `admin-import-session-${++importInputCounter}`
  const confirmAction = atom<ConfirmAction>(
    null,
    '_Admin.view.sessionControls.confirm',
  )
  const importFeedback = atom<string | null>(
    null,
    '_Admin.view.sessionControls.importFeedback',
  )
  const importFeedbackTone = atom<'error' | 'success'>(
    'error',
    '_Admin.view.sessionControls.importFeedbackTone',
  )

  let confirmTimer: ReturnType<typeof setTimeout> | null = null
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const clearConfirmTimer = () => {
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
  }

  const scheduleConfirmRevert = () => {
    clearConfirmTimer()
    confirmTimer = setTimeout(() => {
      confirmAction.set(null)
      confirmTimer = null
    }, 3000)
  }

  const showFeedback = (message: string, tone: 'error' | 'success') => {
    if (feedbackTimer !== null) {
      clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
    importFeedbackTone.set(tone)
    importFeedback.set(message)
    if (tone === 'success') {
      feedbackTimer = setTimeout(() => {
        importFeedback.set(null)
        feedbackTimer = null
      }, 2500)
    }
  }

  const clearWorkspace = () => {
    admin.reporter.clear()
    admin.store.clear()
  }

  const startFreshSession = () => {
    admin.session.start()
    admin.reporter.clear()
    admin.store.clear()
  }

  return (
    <div
      css={`
        ${flex}
        gap: 0.25rem;
        ${flexWrap}
        align-items: center;
        min-width: 0;
        position: relative;
      `}
    >
      <button
        type="button"
        css={`
          ${primaryControlButton}
          border-color: ${() =>
            admin.reporter.paused() ? colors.warning : colors.success};
          background: ${() =>
            admin.reporter.paused()
              ? colors.warningSoft
              : colors.successSoft};
          color: ${() =>
            admin.reporter.paused() ? colors.warning : colors.success};
        `}
        on:click={() => {
          confirmAction.set(null)
          clearConfirmTimer()
          importFeedback.set(null)
          if (admin.reporter.paused()) {
            admin.reporter.paused.setFalse()
            return
          }
          admin.reporter.paused.setTrue()
        }}
      >
        {() =>
          admin.reporter.paused()
            ? 'Resume capture'
            : 'Pause capture'
        }
      </button>
      {() =>
        admin.reporter.paused() ? (
          <span
            aria-live="polite"
            css={`
              position: absolute;
              width: 1px;
              height: 1px;
              padding: 0;
              margin: -1px;
              overflow: hidden;
              clip: rect(0, 0, 0, 0);
              white-space: nowrap;
              border: 0;
            `}
          >
            Recording paused
          </span>
        ) : null
      }

      <div
        css={`
          ${flex}
          gap: 0.25rem;
          flex-wrap: nowrap;
          align-items: center;
          min-width: 0;
          flex: 1 1 auto;

          @container admin-shell (max-width: 360px) {
            flex-wrap: wrap;
          }
        `}
      >
      <button
        type="button"
        title="Export session"
        css={secondaryControlButton}
        on:click={() => {
          confirmAction.set(null)
          clearConfirmTimer()
          importFeedback.set(null)
          const session = admin.store.exportSession()
          downloadJson(
            `reatom-admin-session-${session.session.id}.json`,
            session,
          )
        }}
      >
        Export
      </button>

      <button
        type="button"
        title="Import replay"
        css={secondaryControlButton}
        on:click={() => {
          confirmAction.set(null)
          clearConfirmTimer()
          const fileInput = document.getElementById(inputId)
          if (fileInput instanceof HTMLInputElement) {
            fileInput.click()
          }
        }}
      >
        Import
      </button>
      <input
        id={inputId}
        type="file"
        accept="application/json"
        css={`
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        `}
        on:change={(event: Event) => {
          const target = event.currentTarget
          if (!(target instanceof HTMLInputElement)) return
          const file = target.files?.[0]
          if (!file) return

          const reader = new FileReader()
          reader.onload = () => {
            try {
              if (typeof reader.result !== 'string') {
                showFeedback('Import failed: empty file', 'error')
                return
              }
              const parsed: unknown = JSON.parse(reader.result)
              if (!isImportedSessionPayload(parsed)) {
                showFeedback('Import failed: invalid session payload', 'error')
                return
              }
              admin.store.importSession(parsed)
              showFeedback('Replay loaded', 'success')
            } catch {
              showFeedback('Import failed: could not parse JSON', 'error')
            }
          }
          reader.onerror = () => {
            showFeedback('Import failed: could not read file', 'error')
          }
          reader.readAsText(file)
          target.value = ''
        }}
      />

      <button
        type="button"
        title="Clear workspace"
        css={`
          ${secondaryControlButton}
          border-color: ${() =>
            confirmAction() === 'clear' ? colors.error : colors.border};
          color: ${() =>
            confirmAction() === 'clear' ? colors.error : colors.textMuted};
          background: ${() =>
            confirmAction() === 'clear' ? colors.errorSoft : 'transparent'};
        `}
        on:click={() => {
          if (confirmAction() === 'clear') {
            clearConfirmTimer()
            confirmAction.set(null)
            importFeedback.set(null)
            clearWorkspace()
            return
          }
          confirmAction.set('clear')
          scheduleConfirmRevert()
        }}
      >
        {() => (confirmAction() === 'clear' ? 'Confirm clear' : 'Clear')}
      </button>

      <button
        type="button"
        title="Start fresh session"
        css={`
          ${secondaryControlButton}
          border-color: ${() =>
            confirmAction() === 'fresh' ? colors.error : colors.border};
          color: ${() =>
            confirmAction() === 'fresh' ? colors.error : colors.textMuted};
          background: ${() =>
            confirmAction() === 'fresh' ? colors.errorSoft : 'transparent'};
        `}
        on:click={() => {
          if (confirmAction() === 'fresh') {
            clearConfirmTimer()
            confirmAction.set(null)
            importFeedback.set(null)
            startFreshSession()
            return
          }
          confirmAction.set('fresh')
          scheduleConfirmRevert()
        }}
      >
        {() => (confirmAction() === 'fresh' ? 'Confirm fresh' : 'Fresh')}
      </button>

      {() => {
        const message = importFeedback()
        if (!message) return null
        const tone = importFeedbackTone()
        return (
          <span
            role="status"
            css={`
              font-size: 0.68rem;
              color: ${tone === 'error' ? colors.error : colors.success};
            `}
          >
            {message}
          </span>
        )
      }}
      </div>
    </div>
  )
}
