import { Ctx } from '@reatom/core'
import { noop } from '@reatom/utils'
import { h, hf, mount } from '@reatom/jsx'
import { Rld } from './rld'

export function devtoolsCreate(app: Ctx) {
  if (typeof window === 'undefined') {
    return noop
  }

  const root = document.createElement('div')
  root.id = 'reatom-logger-devtools'
  document.body.appendChild(root)

  mount(root, h(Rld, { app }))

  return () => {
    mount(root, h(hf, {}))
    root.remove()
  }
}
