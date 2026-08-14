import { clearStack, context } from '@reatom/core'
import { mount } from '@reatom/jsx'
import type { Preview } from '@storybook/html'

let unmountFn: (() => void) | null = null

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    a11y: {
      config: {},
      options: {},
      test: 'todo',
    },
  },
  decorators: [
    (Story) => {
      unmountFn?.()
      unmountFn = null

      const frame = context.start()
      const container = document.createElement('div')
      container.id = 'storybook-root'
      container.style.cssText = 'width: 100%; height: 100%;'
      document.body.appendChild(container)

      frame.run(() => {
        const element = Story()
        const result = mount(container, element as HTMLElement)
        unmountFn = result.unmount
      })

      return container
    },
  ],
  beforeEach() {
    clearStack()
    return () => {
      unmountFn?.()
      unmountFn = null
    }
  },
}

export default preview
