import type { Admin } from '../../index'
import { buttonBase, buttonGhost, colors, flex, flexWrap, gap, hideInCompactShell, inputLike } from '../styles'

export interface TimelineControlsProps {
  admin: Admin
}

export const TimelineControls = ({ admin }: TimelineControlsProps) => {
  const windowSizeMs = () => admin.timeline.effectiveBucketSize()

  return (
    <div
      css={`
        ${flex}
        ${gap(2)}
        ${flexWrap}
        align-items: end;

        @container admin-shell (max-width: 680px) {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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
        Window (ms)
        <input
          type="number"
          min={10}
          step={10}
          prop:value={windowSizeMs}
          on:input={(event: Event) => {
            const target = event.currentTarget
            if (!(target instanceof HTMLInputElement)) return
            const nextValue = Number.parseInt(target.value, 10)
            if (Number.isNaN(nextValue) || nextValue < 10) return
            admin.timeline.useAutoFit.setFalse()
            admin.timeline.bucketSize.set(nextValue)
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
        `}
      >
        Detail
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          prop:value={admin.timeline.zoom}
          on:input={(event: Event) => {
            const target = event.currentTarget
            if (!(target instanceof HTMLInputElement)) return
            const nextValue = Number.parseInt(target.value, 10)
            if (Number.isNaN(nextValue) || nextValue < 1) return
            admin.timeline.zoom.set(nextValue)
          }}
        />
      </label>

      <button
        type="button"
        css={buttonBase}
        on:click={() => admin.timeline.applyAutoFit()}
      >
        Auto-fit session
      </button>

      <button
        type="button"
        css={buttonGhost}
        on:click={() => admin.timeline.resetTimeline()}
      >
        Reset timeline
      </button>

      <details
        css={`
          ${hideInCompactShell}
          min-width: 14rem;
        `}
      >
        <summary
          css={`
            cursor: pointer;
            color: ${colors.textMuted};
            font-size: 0.76rem;
          `}
        >
          Advanced pan
        </summary>
        <label
          css={`
            display: grid;
            gap: 0.35rem;
            margin-top: 0.55rem;
            color: ${colors.textMuted};
            font-size: 0.76rem;
          `}
        >
          Pan offset
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            prop:value={admin.timeline.offset}
            on:input={(event: Event) => {
              const target = event.currentTarget
              if (!(target instanceof HTMLInputElement)) return
              const nextValue = Number.parseFloat(target.value)
              if (Number.isNaN(nextValue)) return
              admin.timeline.offset.set(nextValue)
            }}
          />
        </label>
      </details>
    </div>
  )
}
