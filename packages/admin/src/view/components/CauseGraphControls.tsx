import type { Admin } from '../../index'
import { buttonBase, buttonGhost, colors, flex, flexWrap, gap, inputLike } from '../styles'

export interface CauseGraphControlsProps {
  admin: Admin
}

export const CauseGraphControls = ({ admin }: CauseGraphControlsProps) => {
  const selectedFrameId = () => admin.store.selectedFrameId()
  const visibleFrames = () => admin.filters.engine.visibleFrames()

  return (
    <div
      data-reatom-name="CauseGraphControls"
      css={`
        ${flex}
        ${gap(2)}
        ${flexWrap}
        align-items: end;

        @container admin-shell (max-width: 680px) {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0.65rem;
        }
      `}
    >
      <label
        css={`
          display: grid;
          gap: 0.35rem;
          color: ${colors.textMuted};
          font-size: 0.76rem;
        `}
      >
        Depth limit
        <input
          type="number"
          min={1}
          step={1}
          prop:value={() => admin.causeGraph.depthLimit() ?? ''}
          placeholder="unbounded"
          on:input={(event: Event) => {
            const target = event.currentTarget
            if (!(target instanceof HTMLInputElement)) return
            if (target.value === '') {
              admin.causeGraph.depthLimit.set(undefined)
              return
            }
            const nextValue = Number.parseInt(target.value, 10)
            if (Number.isNaN(nextValue) || nextValue < 1) return
            admin.causeGraph.depthLimit.set(nextValue)
          }}
          css={inputLike}
        />
      </label>

      <label
        css={`
          display: grid;
          gap: 0.35rem;
          color: ${colors.textMuted};
          font-size: 0.76rem;
          min-width: 16rem;

          @container admin-shell (max-width: 680px) {
            min-width: 0;
            width: 100%;
          }
        `}
      >
        Find path from
        <select
          prop:value={() => {
            const pathFrom = admin.causeGraph.pathFrom()
            return pathFrom === null ? '' : String(pathFrom)
          }}
          on:change={(event: Event) => {
            const target = event.currentTarget
            if (!(target instanceof HTMLSelectElement)) return
            const nextValue = Number.parseInt(target.value, 10)
            if (Number.isNaN(nextValue)) {
              admin.causeGraph.pathFrom.set(null)
              return
            }
            admin.causeGraph.pathFrom.set(nextValue)
          }}
          css={inputLike}
        >
          <option value="">Select a visible frame</option>
          {() =>
            visibleFrames().map((frame) => {
              const atomName =
                admin.store.getAtoms().get(frame.atomId)?.name ?? frame.atomId
              return (
                <option value={frame.id}>
                  #{frame.id} {atomName}
                </option>
              )
            })
          }
        </select>
      </label>

      <button
        type="button"
        css={buttonBase}
        on:click={() => {
          const selectedId = selectedFrameId()
          if (selectedId === null) return
          admin.causeGraph.selectedRootId.set(selectedId)
        }}
      >
        Use current selection
      </button>

      <button
        type="button"
        css={buttonGhost}
        on:click={() => {
          admin.causeGraph.depthLimit.set(undefined)
          admin.causeGraph.pathFrom.set(null)
        }}
      >
        Reset graph controls
      </button>
    </div>
  )
}
