import { expectTypeOf, test } from 'test'

import { onEvent } from './onEvent'

interface OrbitChangeEvent {
  type: 'change'
}

interface ThreeStyleEventDispatcher {
  addEventListener<T extends 'change'>(
    type: T,
    listener: (event: OrbitChangeEvent) => void,
  ): void
  removeEventListener<T extends 'change'>(
    type: T,
    listener: (event: OrbitChangeEvent) => void,
  ): void
}

declare const button: HTMLButtonElement
declare const controls: ThreeStyleEventDispatcher

test('accepts DOM event targets', () => {
  if (false) {
    onEvent(button, 'click', (event) => {
      expectTypeOf(event).toEqualTypeOf<HTMLElementEventMap['click']>()
    })
  }
})

test('accepts structurally compatible event dispatchers', () => {
  if (false) {
    const un = onEvent(controls, 'change', (event) => {
      expectTypeOf(event).toEqualTypeOf<OrbitChangeEvent>()
    })

    expectTypeOf(un).toBeFunction()
    expectTypeOf(onEvent(controls, 'change')).toEqualTypeOf<
      Promise<OrbitChangeEvent>
    >()
  }
})
