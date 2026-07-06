import type { Admin } from '../../index'
import type { AdminAtom, AdminFrame, AdminSession } from '../../types'
import { buttonBase, buttonGhost } from '../styles'

export interface SessionControlsProps {
  admin: Admin
}

interface ImportedSessionPayload {
  session: AdminSession
  atoms: Record<string, AdminAtom>
  frames: Array<AdminFrame>
}

let importInputCounter = 0

const primaryControlButton = `
  ${buttonBase}
  font-size: 0.78rem;
  white-space: nowrap;
`

const secondaryControlButton = `
  ${buttonGhost}
  font-size: 0.78rem;
  white-space: nowrap;
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

  return (
    <div
      css={`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8.5rem, max-content));
        gap: 0.5rem;
        align-items: center;
        justify-content: start;
      `}
    >
      <button
        type="button"
        css={primaryControlButton}
        on:click={() => {
          if (admin.reporter.paused()) {
            admin.reporter.paused.setFalse()
            return
          }
          admin.reporter.paused.setTrue()
        }}
      >
        {() => (admin.reporter.paused() ? 'Resume capture' : 'Pause capture')}
      </button>

      <button
        type="button"
        css={secondaryControlButton}
        on:click={() => {
          admin.reporter.clear()
          admin.store.clear()
        }}
      >
        Clear workspace
      </button>

      <button
        type="button"
        css={secondaryControlButton}
        on:click={() => {
          admin.session.start()
          admin.reporter.clear()
          admin.store.clear()
        }}
      >
        Start fresh session
      </button>

      <button
        type="button"
        css={secondaryControlButton}
        on:click={() => {
          const session = admin.store.exportSession()
          downloadJson(`reatom-admin-session-${session.session.id}.json`, session)
        }}
      >
        Export session
      </button>

      <button
        type="button"
        css={secondaryControlButton}
        on:click={() => {
          const fileInput = document.getElementById(inputId)
          if (fileInput instanceof HTMLInputElement) {
            fileInput.click()
          }
        }}
      >
        Import replay
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
            if (typeof reader.result !== 'string') return
            const parsed: unknown = JSON.parse(reader.result)
            if (!isImportedSessionPayload(parsed)) return
            admin.store.importSession(parsed)
          }
          reader.readAsText(file)
          target.value = ''
        }}
      />
    </div>
  )
}
