import { atom } from '@reatom/framework'
import { withUndo } from '@reatom/undo'
import { reatomComponent } from '@reatom/npm-react'
import { withLocalStorage } from '@reatom/persist-web-storage'

const inputAtom = atom('', 'inputAtom').pipe(
  withUndo({
    shouldReplace: (ctx, state) => !state.endsWith(' '),
    withPersist: withLocalStorage,
  }),
)

export const App = reatomComponent(
  ({ ctx }) => (
    <main>
      <button disabled={!ctx.spy(inputAtom.isUndoAtom)} onClick={ctx.bind(inputAtom.undo)}>
        {'<'}
      </button>
      {` ${ctx.spy(inputAtom.positionAtom)} / ${ctx.spy(inputAtom.historyAtom).length - 1} `}
      <button disabled={!ctx.spy(inputAtom.isRedoAtom)} onClick={ctx.bind(inputAtom.redo)}>
        {'>'}
      </button>
      <p>
        <input value={ctx.spy(inputAtom)} onChange={(e) => inputAtom(ctx, e.currentTarget.value)} />
      </p>
    </main>
  ),
  'App',
)
