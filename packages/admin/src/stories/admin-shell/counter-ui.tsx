import { mount } from '@reatom/jsx'

import { createCounterApp } from '../../fixtures/counterApp'

export function mountCounterApplication(target: HTMLElement): () => void {
  const counterApp = createCounterApp()

  const mounted = mount(
    target,
    <section aria-label="Counter demo">
      <h1>Counter demo</h1>
      <p data-testid="counter-value">Count: {() => counterApp.count()}</p>
      <div>
        <button type="button" on:click={counterApp.decrement}>
          Decrement
        </button>
        <button type="button" on:click={counterApp.increment}>
          Increment
        </button>
      </div>
    </section>,
  )

  return mounted.unmount
}
