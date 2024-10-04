import { __root, action, atom, AtomCache, parseAtoms, withReset } from '@reatom/framework'
import { h, hf, JSX } from '@reatom/jsx'
import { ObservableHQ } from '../ObservableHQ'
import { reatomFilters } from './reatomFilters'
import { actionsStates, history } from './utils'
import { withComputed } from '@reatom/primitives'

type InspectorState =
  | { kind: 'hidden' }
  | { kind: 'open'; patch: AtomCache }
  | { kind: 'fixed'; patch: AtomCache; element: HTMLElement }

export const reatomInspector = ({ filters }: { filters: ReturnType<typeof reatomFilters> }, name: string) => {
  const state = atom<InspectorState>({ kind: 'hidden' }, `${name}.state`)
  const patch = atom((ctx) => {
    const s = ctx.spy(state)

    return s.kind === 'hidden' ? null : s.patch
  }, `${name}.patch`)
  const patchState = atom<any>(null, `${name}.patchState`).pipe(
    withComputed((ctx) => {
      const patchState = ctx.spy(patch)

      if (patchState?.proto.isAction) {
        const calls = actionsStates.get(patchState)
        return calls && calls.length > 1 ? calls[calls.length - 1] : calls
      }

      return patchState?.state instanceof URL ? patchState?.state.href : patchState?.state
    }),
  )
  const patchHistory = atom((ctx) => {
    const patchState = ctx.spy(patch)

    if (patchState?.proto.isAction) return [patchState]

    const patchHistory = patchState && history.get(patchState.proto)

    if (!patchHistory) return null

    const idx = patchHistory.indexOf(patchState)

    return patchHistory.slice(idx)
  }, `${name}.patchHistory`).pipe(withReset())
  patchHistory.reset.onCall((ctx) => {
    const patchState = ctx.get(patch)

    if (patchState) history.delete(patchState.proto)
  })

  const open = action((ctx, patch: AtomCache) => {
    if (ctx.get(state).kind !== 'fixed') {
      state(ctx, { kind: 'open', patch })
    }
  }, `${name}.open`)

  const fix = action((ctx, patch: AtomCache, element: HTMLElement) => {
    const s = ctx.get(state)

    const toFix = () => {
      state(ctx, { kind: 'fixed', patch, element })
      element.style.fontWeight = 'bold'
    }

    if (s.kind === 'fixed') {
      s.element.style.fontWeight = 'normal'
      if (s.patch === patch) {
        state(ctx, { kind: 'hidden' })
      } else {
        toFix()
      }
    } else {
      toFix()
    }
  }, `${name}.fixed`)

  const hide = action((ctx, relatedElement: EventTarget | null) => {
    if (!(relatedElement instanceof Node && element.contains(relatedElement))) {
      if (ctx.get(state).kind !== 'fixed') {
        state(ctx, { kind: 'hidden' })
      }
    }
  }, `${name}.hide`)

  const parse: JSX.EventHandler<HTMLButtonElement> = action((ctx) => {
    patchState(ctx, (state: any) => parseAtoms(ctx, state))
  }, `${name}.parse`)

  const copy: JSX.EventHandler<HTMLButtonElement> = action((ctx) => {
    const snapshot = JSON.stringify(parseAtoms(ctx, patchState), null, 2)
    navigator.clipboard.writeText(snapshot)
  }, `${name}.copy`)

  const close: JSX.EventHandler<HTMLButtonElement> = action((ctx) => {
    state(ctx, { kind: 'hidden' })
  }, `${name}.close`)

  const filtersHeight = atom((ctx) => filters.element.clientHeight + 'px', `${name}.filtersHeight`).pipe(
    withComputed((ctx, s) => {
      ctx.spy(state)
      parseAtoms(ctx, filters)
      return s
    }),
  )

  const element = (
    <div
      css:filtersHeight={filtersHeight}
      css:pe={atom((ctx) => (ctx.spy(state).kind === 'hidden' ? 'none' : 'all'))}
      css:opacity={atom((ctx) => {
        const { kind } = ctx.spy(state)
        return {
          hidden: '0',
          open: '0.8',
          fixed: '1',
        }[kind]
      })}
      css={`
        position: absolute;
        left: 139px;
        top: calc(var(--filtersHeight) + 20px);
        width: calc(100% - 160px);
        height: calc(100% - var(--filtersHeight) - 40px);
        max-height: 100%;
        overflow: auto;
        background: var(--devtools-bg);
        border-radius: 2px;
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.1),
          0 4px 11px rgba(0, 0, 0, 0.1);
        z-index: 1;
        pointer-events: var(--pe);
        opacity: var(--opacity);
        transition: opacity 0.2s;
        &:hover {
          opacity: 1;
        }
      `}
    >
      <div
        css={`
          min-height: 100px;
        `}
      >
        <h4
          css={`
            margin: 10px 85px 0 15px;
            height: 20px;
            display: flex;
            align-items: center;
          `}
        >
          {atom((ctx) => ctx.spy(patch)?.proto.name)}
        </h4>
        <ObservableHQ snapshot={patchState} />
      </div>
      <div>
        <hr />
        <div
          css={`
            position: relative;
          `}
        >
          <h4
            css={`
              margin: 10px 0 0 15px;
            `}
          >
            history
          </h4>
          <button
            on:click={patchHistory.reset}
            css={`
              position: absolute;
              top: 0;
              right: 5px;
              background: none;
              border: none;
              color: gray;
            `}
          >
            clear history
          </button>
        </div>
        <ObservableHQ snapshot={patchHistory} />
      </div>
      <button
        on:click={parse}
        css={`
          position: absolute;
          top: 10px;
          right: 60px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          filter: grayscale(1);
          background: none;
          border: 1px solid gray;
          color: gray;
        `}
        title="Plain JSON"
        aria-details="Convert to plain JSON"
      >
        ✈
      </button>
      <button
        on:click={copy}
        css={`
          position: absolute;
          top: 10px;
          right: 35px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          filter: grayscale(1);
          background: none;
          border: 1px solid gray;
          color: gray;
        `}
        title="Copy"
        aria-details="Copy inspected value"
      >
        💾
      </button>
      <button
        on:click={close}
        css={`
          position: absolute;
          top: 10px;
          right: 10px;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid gray;
          color: gray;
        `}
        title="Close"
        aria-details="Close this inspector"
      >
        x
      </button>
    </div>
  )

  return Object.assign(state, { element, open, fix, hide })
}
