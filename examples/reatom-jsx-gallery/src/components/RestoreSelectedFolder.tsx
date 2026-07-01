import { isAbort, wrap } from '@reatom/core'

import {
  folderTree,
  pendingFolderRestore,
  requestFolderRestore,
  restoreSelectedFolder,
  selectedFolderHandle,
} from '../model'

export const RestoreSelectedFolder = () => (
  <>
    <div
      style={{ display: 'none' }}
      ref={() => {
        let restoreStarted = false

        return selectedFolderHandle.subscribe(
          wrap((handle) => {
            if (restoreStarted) return
            if (handle === null) return
            if (folderTree() !== null) return

            restoreStarted = true
            restoreSelectedFolder().catch((error: unknown) => {
              if (isAbort(error)) return
              queueMicrotask(() => {
                throw error
              })
            })
          }),
        )
      }}
    />
    {() => {
      const pendingHandle = pendingFolderRestore()
      if (pendingHandle === null) return null

      return (
        <div
          role="status"
          css={`
            position: fixed;
            left: 50%;
            bottom: 24px;
            z-index: 1200;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: min(92vw, 520px);
            padding: 12px 14px;
            border: var(--border-width) var(--control-border-style)
              var(--border-color);
            border-radius: var(--radius-md);
            background: var(--bg-elevated);
            color: var(--text-primary);
            box-shadow: 0 14px 34px var(--shadow);
            transform: translateX(-50%);
          `}
        >
          <span css={`font-size: 14px; line-height: 1.4;`}>
            Restore your previous folder?
          </span>
          <button
            type="button"
            on:click={() => requestFolderRestore()}
            css={`
              flex-shrink: 0;
              min-height: 36px;
              padding: 8px 14px;
              font-size: 14px;
              font-weight: 650;
              color: var(--accent-contrast);
              background: var(--accent);
              border: var(--border-width) var(--control-border-style)
                var(--accent);
              border-radius: var(--radius-round);
              cursor: pointer;
            `}
          >
            Restore folder
          </button>
        </div>
      )
    }}
  </>
)
