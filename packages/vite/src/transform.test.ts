import { describe, expect, test } from 'vitest'

import { transformReatomModule } from './transform.ts'

describe('transformReatomModule', () => {
  test('wraps reatomRoute and nested .reatomRoute calls', () => {
    const input = `
import { reatomRoute } from '@reatom/core'

export const layoutRoute = reatomRoute({
  path: 'app',
  render: (self) => self.outlet(),
})

export const homeRoute = layoutRoute.reatomRoute('')
`

    const result = transformReatomModule(input, { filename: 'routes.ts' })
    expect(result).not.toBeNull()
    expect(result!.routes).toBe(true)
    expect(result!.jsx).toBe(false)
    expect(result!.code).toContain('__REATOM_VITE_trackRoute(reatomRoute({')
    expect(result!.code).toContain(
      "__REATOM_VITE_trackRoute(layoutRoute.reatomRoute(''))",
    )
    expect(result!.code).toContain('import.meta.hot.dispose')
    expect(result!.code).toContain('import.meta.hot.accept()')
    expect(result!.code).toContain(
      'retryComputed as __REATOM_VITE_retryComputed',
    )
    expect(result!.code).toContain('delete parent.routes[route.name]')
    expect(result!.code).toContain(
      'delete __REATOM_VITE_urlAtom.routes[route.name]',
    )
  })

  test('wraps mount from @reatom/jsx', () => {
    const input = `
import { mount } from '@reatom/jsx'
import { App } from './App'

const { unmount } = mount(document.getElementById('app')!, <App />)
`

    const result = transformReatomModule(input, { filename: 'main.tsx' })
    expect(result).not.toBeNull()
    expect(result!.jsx).toBe(true)
    expect(result!.routes).toBe(false)
    expect(result!.code).toContain('__REATOM_VITE_trackMount(mount(')
    expect(result!.code).toContain('mounted.unmount()')
    expect(result!.code).not.toContain('@reatom/core')
  })

  test('handles routes and mount in one module', () => {
    const input = `
import { reatomRoute } from '@reatom/core'
import { mount } from '@reatom/jsx'

const rootRoute = reatomRoute({ render: () => null })
mount(document.body, <div />)
`

    const result = transformReatomModule(input, { filename: 'app.tsx' })
    expect(result).not.toBeNull()
    expect(result!.routes).toBe(true)
    expect(result!.jsx).toBe(true)
    expect(result!.code).toContain('__REATOM_VITE_trackRoute(reatomRoute({')
    expect(result!.code).toContain('__REATOM_VITE_trackMount(mount(')
  })

  test('skips modules that already define import.meta.hot', () => {
    const input = `
import { reatomRoute } from '@reatom/core'
const route = reatomRoute('x')
if (import.meta.hot) import.meta.hot.accept()
`
    expect(transformReatomModule(input, { filename: 'routes.ts' })).toBeNull()
  })

  test('skips when routes and jsx options are disabled', () => {
    const input = `
import { reatomRoute } from '@reatom/core'
import { mount } from '@reatom/jsx'
const route = reatomRoute('x')
mount(document.body, null)
`
    expect(
      transformReatomModule(input, {
        filename: 'app.tsx',
        routes: false,
        jsx: false,
      }),
    ).toBeNull()
  })

  test('does not wrap unrelated mount identifiers', () => {
    const input = `
import { atom } from '@reatom/core'

const mount = () => {}
mount()
`
    expect(transformReatomModule(input, { filename: 'x.ts' })).toBeNull()
  })

  test('tracks aliased mount imports', () => {
    const input = `
import { mount as mountApp } from '@reatom/jsx'
mountApp(document.body, <div />)
`
    const result = transformReatomModule(input, { filename: 'main.tsx' })
    expect(result).not.toBeNull()
    expect(result!.code).toContain('__REATOM_VITE_trackMount(mountApp(')
  })
})
