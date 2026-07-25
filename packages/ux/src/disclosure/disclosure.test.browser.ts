import { context, sleep, wrap } from '@reatom/core'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { reatomDisclosure } from './reatomDisclosure'
import {
  getAnimationTimeout,
  withDisclosureAnimation,
} from './reatomDisclosureDom'

/**
 * Bucket B: the animation end can only be measured against a real layout.
 *
 * Ariakit derives it from the computed transition and animation timings instead
 * of `transitionend`, because those events are not guaranteed to fire — the
 * element may be removed before the animation ends, or the animation may never
 * start at all
 * (`ariakit-react-components/src/disclosure/disclosure-content.tsx:166-202`).
 */

let root: HTMLElement

beforeEach(() => {
  context.reset()
  root = document.createElement('div')
  document.body.append(root)
})

afterEach(() => root.remove())

const renderContent = (css: string) => {
  const style = document.createElement('style')
  style.textContent = `.content { ${css} }`
  const element = document.createElement('div')
  element.className = 'content'
  root.append(style, element)
  return element
}

test('a real CSS transition is measured from the computed style', () => {
  const element = renderContent('transition: opacity 150ms linear 50ms;')

  expect(getAnimationTimeout(getComputedStyle(element))).toBe(200)
})

test('the content stays mounted until a real transition ends', async () => {
  const element = renderContent('transition: opacity 120ms linear;')
  const disclosure = reatomDisclosure({ animated: true, name: 'd' }).extend(
    withDisclosureAnimation(),
  )
  const un = disclosure.mounted.subscribe(() => {})
  disclosure.contentElement.set(element)

  disclosure.show()
  expect(disclosure.animating()).toBe(true)
  await wrap(sleep(60))
  // still inside the enter transition
  expect(disclosure.animating()).toBe(true)

  await wrap(sleep(120))
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(true)

  disclosure.hide()
  expect(disclosure.mounted()).toBe(true)
  await wrap(sleep(60))
  // the leave transition keeps the element in the DOM
  expect(disclosure.mounted()).toBe(true)

  await wrap(sleep(120))
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('an element without a transition unmounts without waiting', async () => {
  const element = renderContent('opacity: 1;')
  const disclosure = reatomDisclosure({ animated: true, name: 'd' }).extend(
    withDisclosureAnimation(),
  )
  const un = disclosure.mounted.subscribe(() => {})
  disclosure.contentElement.set(element)

  disclosure.show()
  await wrap(sleep(60))
  expect(disclosure.animating()).toBe(false)

  disclosure.hide()
  await wrap(sleep(60))
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('the prop records drive real elements through a real click', async () => {
  const disclosure = reatomDisclosure({ name: 'faq' })
  const button = document.createElement('button')
  const content = document.createElement('div')
  root.append(button, content)

  const render = () => {
    const buttonProps = disclosure.props.button()
    const contentProps = disclosure.props.content()

    button.type = buttonProps.type
    button.setAttribute('aria-expanded', String(buttonProps['aria-expanded']))
    button.setAttribute('aria-controls', buttonProps['aria-controls'])
    button.onclick = buttonProps.onClick
    buttonProps.ref(button)

    content.id = contentProps.id
    content.hidden = contentProps.hidden
    content.style.display = contentProps.style?.display ?? ''
    content.toggleAttribute('data-open', !!contentProps['data-open'])
    contentProps.ref(content)
  }

  const un = disclosure.props.content.subscribe(render)

  expect(button.type).toBe('button')
  expect(button.getAttribute('aria-expanded')).toBe('false')
  expect(button.getAttribute('aria-controls')).toBe('faq-content')
  expect(content.id).toBe('faq-content')
  expect(content.hidden).toBe(true)
  expect(getComputedStyle(content).display).toBe('none')
  expect(disclosure.disclosureElement()).toBe(button)
  expect(disclosure.contentElement()).toBe(content)

  button.click()
  await wrap(sleep(0))

  expect(disclosure()).toBe(true)
  expect(button.getAttribute('aria-expanded')).toBe('true')
  expect(content.hidden).toBe(false)
  expect(content.hasAttribute('data-open')).toBe(true)
  expect(getComputedStyle(content).display).toBe('block')

  button.click()
  await wrap(sleep(0))

  expect(disclosure()).toBe(false)
  expect(content.hidden).toBe(true)
  expect(content.hasAttribute('data-open')).toBe(false)

  un()
})
