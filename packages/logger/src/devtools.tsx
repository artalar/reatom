import { Ctx } from '@reatom/core'
import { noop } from '@reatom/utils'
import { mount } from '@reatom/jsx'

export function devtoolsCreate(app: Ctx) {
  if (typeof window === 'undefined') {
    return noop
  }

  const root = document.createElement('div')
  root.id = 'reatom-logger-devtools'
  document.body.appendChild(root)

  mount(root, <Rld app={app} />)

  return () => {
    // mount(root, <></>)
    root.remove()
  }
}
