import './main.css'

import {
  action,
  assert,
  atom,
  clearStack,
  connectLogger,
  context,
  effect,
  getCalls,
  peek,
  withChangeHook,
  withLocalStorage,
} from '@reatom/core'
import { reatomContext } from '@reatom/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app'
import { settableAction } from './settableAction'
import {
  reatomPaneFolder,
  withBinding,
  withButton,
  withEffect,
} from './tweakpane'

clearStack()

const rootFrame = context.start()
if (import.meta.env.DEV) {
  rootFrame.run(connectLogger)
}

const rootElement = atom(() => {
  const el = document.getElementById('root')
  assert(el, 'Root element not found')
  return el
}, 'rootElement')

const appSettings = reatomPaneFolder({ title: 'App Settings' })

const unmount = settableAction<() => void>({
  name: 'app.unmount',
  init: null,
  runOnce: true,
}).extend(withButton({ title: 'Unmount App', hidden: true }, appSettings))

unmount.button.extend(
  withEffect((button) => {
    peek(button).hidden = !unmount.impl()
  }),
)

const hideAppSettings = action(() => {
  appSettings().hidden = true
}).extend(withButton({ title: 'Hide App Settings', hidden: true }, appSettings))

hideAppSettings.button.extend(
  withEffect((button) => {
    peek(button).hidden = !unmount.impl()
  }),
)

const mount = action(() => {
  unmount()
  const root = createRoot(rootElement())
  root.render(
    <reatomContext.Provider value={rootFrame}>
      {strictMode() ? (
        <StrictMode>
          <App />
        </StrictMode>
      ) : (
        <App />
      )}
    </reatomContext.Provider>,
  )
  unmount.impl.set(() => () => root.unmount())
}, 'renderApp').extend(withButton({ title: 'Mount App' }, appSettings))

mount.button.extend(
  withEffect((button) => {
    peek(button).title = unmount.impl() ? 'Remount App' : 'Mount App'
  }),
)

const strictMode = atom(false, 'app.strictMode').extend(
  withLocalStorage('app.strictMode'),
  withChangeHook(() => {
    if (unmount.impl()) mount()
  }),
  withBinding({ label: 'Strict Mode' }, appSettings),
)

const mountAtStart = atom(true, 'app.mountAtStart').extend(
  withLocalStorage('app.mountAtStart'),
  withBinding({ label: 'Mount at start' }, appSettings),
)

rootFrame.run(() => {
  effect(() => {
    mountAtStart()
    strictMode()

    getCalls(unmount)
    getCalls(mount)
    getCalls(hideAppSettings)
  }, 'appSettings.subscribe')

  effect(() => {
    if (peek(() => mountAtStart())) {
      mount()
    }
  }, 'mountAtStart')
})
