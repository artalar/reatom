import type { AtomLike } from '@reatom/core'
import {
  atom,
  clearStack,
  context,
  effect,
  rAF,
  sleep,
  take,
  top,
  wrap,
} from '@reatom/core'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { reatomContext, reatomFactoryComponent } from './'

clearStack()

const tick = async () => {
  await wrap(take(rAF))
  await wrap(take(rAF))
}

beforeEach(() => {
  const root = document.createElement('div')
  root.id = 'root'
  document.body.append(root)
})

afterEach(() => {
  document.getElementById('root')?.remove()
})

describe('reatomFactoryComponent effects in StrictMode', () => {
  const setup = () => {
    let effectCalls = 0

    const Mirror = reatomFactoryComponent<{ source: AtomLike<number> }>(
      ({ source }) => {
        const doubled = atom(source() * 2, 'doubled')

        effect(() => {
          effectCalls++
          doubled.set(source() * 2)
        })

        return () => <div data-testid="doubled">{doubled()}</div>
      },
      'Mirror',
    )

    return {
      Mirror,
      getEffectCalls: () => effectCalls,
      getText: () =>
        document.querySelector('[data-testid="doubled"]')?.textContent,
    }
  }

  const scenario = async (strictMode: boolean) => {
    const source = atom(1, 'source')
    const { Mirror, getEffectCalls, getText } = setup()

    const app = (
      <reatomContext.Provider value={top()}>
        <Mirror source={source} />
      </reatomContext.Provider>
    )

    const root = ReactDOM.createRoot(document.getElementById('root')!)
    root.render(strictMode ? <React.StrictMode>{app}</React.StrictMode> : app)

    await wrap(tick())
    expect(getText()).toBe('2')

    const effectCallsAfterMount = getEffectCalls()

    source.set(21)
    await wrap(sleep())
    await wrap(tick())

    expect(getEffectCalls()).toBeGreaterThan(effectCallsAfterMount)
    expect(getText()).toBe('42')

    const effectCallsBeforeUnmount = getEffectCalls()
    root.unmount()
    await wrap(tick())

    source.set(100)
    await wrap(sleep())
    await wrap(tick())
    expect(getEffectCalls()).toBe(effectCallsBeforeUnmount)
  }

  test('control: effect updates the component without StrictMode', () =>
    context.start(() => scenario(false)))

  test('effect updates the component in StrictMode', () =>
    context.start(() => scenario(true)))
})
