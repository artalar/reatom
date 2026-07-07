import { urlAtom } from '@reatom/core'

import type { Admin } from '../../index'
import type { AdminFrame } from '../../types'
import { formatDateTime, formatJson } from '../format'
import {
  getFrameExportPayload,
  getFrameInspectorPayload,
  isActionFrame,
} from '../frame-inspector'
import {
  badge,
  buttonBase,
  buttonGhost,
  card,
  colors,
  flex,
  flexWrap,
  gap,
  mono,
  p,
  panelTitle,
} from '../styles'
import { JsonInspector } from './JsonInspector'

export interface FrameDetailProps {
  admin: Admin
  frame: AdminFrame
  atomName: string
  onClose: () => void
}

export const FrameDetail = ({
  admin,
  frame,
  atomName,
  onClose,
}: FrameDetailProps) => {
  const atoms = admin.store.getAtoms()
  const frameIndex = admin.store.frameIndex()
  const exportPayload = getFrameExportPayload(frame)
  const inspectorPayload = getFrameInspectorPayload(frame)
  const isAction = isActionFrame(frame)

  return (
    <div
      data-reatom-name="FrameDetail"
      css={`
        ${card}
        ${p(3)}
        ${gap(2)}
        display: grid;
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(2)}
          ${flexWrap}
          justify-content: space-between;
          align-items: center;
        `}
      >
        <div
          css={`
            display: grid;
            gap: 0.65rem;
          `}
        >
          <div
            css={`
              ${flex}
              ${gap(1)}
              ${flexWrap}
              align-items: center;
            `}
          >
            <span
              css={`
                ${badge}
                background: ${frame.error !== null
                  ? colors.errorSoft
                  : colors.accentSoft};
                border-color: ${frame.error !== null
                  ? colors.error
                  : colors.accent};
                color: ${frame.error !== null ? colors.error : colors.accent};
              `}
            >
              {frame.error !== null ? 'Error frame' : isAction ? 'Action' : 'State'}
            </span>
            <span
              css={`
                ${badge}
                background: ${colors.bgElevated};
                color: ${colors.textMuted};
              `}
            >
              #{frame.id}
            </span>
          </div>
          <h3
            css={`
              ${panelTitle}
            `}
          >
            {atomName}
          </h3>
          <div
            data-testid="frame-detail-meta"
            css={`
              color: ${colors.textMuted};
              font-size: 0.78rem;
              line-height: 1.5;
            `}
          >
            <div>{formatDateTime(frame.timestamp)}</div>
            <div>Session {frame.sessionId}</div>
          </div>
        </div>

        <div
          css={`
            ${flex}
            ${gap(1)}
            ${flexWrap}
            justify-content: flex-end;
          `}
        >
          <button
            type="button"
            css={buttonGhost}
            on:click={() => {
              navigator.clipboard.writeText(formatJson(exportPayload))
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            css={buttonGhost}
            on:click={() => {
              const blob = new Blob([formatJson(exportPayload)], {
                type: 'application/json',
              })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = `frame-${frame.id}.json`
              document.body.append(anchor)
              anchor.click()
              anchor.remove()
              URL.revokeObjectURL(url)
            }}
          >
            Download
          </button>
          <button type="button" css={buttonGhost} on:click={onClose}>
            Close
          </button>
        </div>
      </div>

      {frame.error !== null && (
        <div
          data-testid="frame-error-panel"
          css={`
            ${mono}
            ${badge}
            display: grid;
            gap: 0.5rem;
            padding: 0.85rem 1rem;
            background: ${colors.errorSoft};
            border-color: ${colors.error};
            color: ${colors.error};
            white-space: pre-wrap;
            word-break: break-word;
          `}
        >
          <strong>Captured error</strong>
          <div>{formatJson(frame.error)}</div>
        </div>
      )}

      <section
        css={`
          display: grid;
          gap: 0.75rem;
        `}
      >
        <h4
          css={`
            ${panelTitle}
            font-size: 0.9rem;
          `}
        >
          {isAction ? 'Action payload' : 'Current state'}
        </h4>
        <JsonInspector value={inspectorPayload} />
      </section>

      {frame.pubIds.length > 0 && (
        <section
          css={`
            display: grid;
            gap: 0.75rem;
          `}
        >
          <h4
            css={`
              ${panelTitle}
              font-size: 0.9rem;
            `}
          >
            Cause chain
          </h4>
          <div
            css={`
              ${flex}
              ${gap(1)}
              ${flexWrap}
            `}
          >
            {frame.pubIds.map((pubId) => {
              const pubFrame = frameIndex.get(pubId)
              const pubName = pubFrame
                ? (atoms.get(pubFrame.atomId)?.name ?? pubFrame.atomId)
                : `#${pubId}`
              return (
                <button
                  type="button"
                  css={buttonGhost}
                  on:click={() => {
                    if (pubFrame) {
                      admin.store.selectFrame(pubId)
                      admin.causeGraph.selectedRootId.set(pubId)
                    }
                  }}
                >
                  {pubName}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div
        css={`
          ${flex}
          ${gap(1)}
          ${flexWrap}
        `}
      >
        <button
          type="button"
          css={buttonBase}
          on:click={() => urlAtom.go('/graph')}
        >
          Open in cause graph
        </button>
      </div>
    </div>
  )
}
