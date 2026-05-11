import { action, atom, effect, getCalls } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'

import { Pre } from '../components/Pre'
import {
  reatomPaneFolder,
  reatomPaneSeparator,
  reatomPaneTab,
  withBinding,
  withButton,
} from '../tweakpane'

export const UIComponentsDemo = reatomFactoryComponent(() => {
  const folder = reatomPaneFolder({ title: 'UI Components' })

  // 1. Buttons
  const buttonFolder = reatomPaneFolder({ title: 'Buttons' }, folder)
  const doAction1 = action(() => void alert('Action 1 triggered!'), 'doAction1') //
    .extend(withButton({ title: 'Do Action 1', index: 0 }, buttonFolder))

  const doAction2 = action(() => void alert('Action 2 triggered!'), 'doAction2') //
    .extend(withButton({ title: 'Do Action 2', index: 2 }, buttonFolder))

  const separator = reatomPaneSeparator({ index: 1 }, buttonFolder)

  const tab = reatomPaneTab(['Parameters', 'Advanced'], folder)

  // Page 1: Parameters
  const volumeAtom = atom(50, 'volume').extend(
    withBinding({ label: 'Volume', min: 0, max: 100 }, tab.pages[0]),
  )

  const muteAction = action(() => {
    volumeAtom.set(0)
  }, 'mute').extend(withButton({ title: 'Mute' }, tab.pages[0]))

  // Page 2: Advanced
  const intervalAtom = atom({ min: 16, max: 48 }, 'interval').extend(
    withBinding(
      {
        label: 'Interval',
        min: 0,
        max: 100,
        step: 1,
      },
      tab.pages[1],
    ),
  )

  effect(() => {
    // Subscription to make button blade rendered in tweakpane
    getCalls(doAction1)
    getCalls(doAction2)
    getCalls(muteAction)
    separator()
  }, 'buttonFolder.subscribe')

  return () => {
    return (
      <section>
        <h3>UI Components</h3>
        <p>
          Basic Tweakpane components: Buttons, Folders, Tabs, and Separators.
        </p>

        <h4>Tabs</h4>
        <Pre label="Volume">{volumeAtom()}</Pre>
        <Pre label="Interval">{JSON.stringify(intervalAtom())}</Pre>
      </section>
    )
  }
}, 'UIComponentsDemo')
