import { atom, context, effect, sleep, wrap } from '@reatom/core'
import { beforeEach, expect, test } from 'vitest'

import {
  disclosureProps,
  isDisclosureContentHidden,
  withDisclosureProps,
} from './props'
import {
  disclosureContentId,
  reatomDisclosure,
  withDisclosure,
} from './reatomDisclosure'
import {
  getAnimationTimeout,
  parseCssTime,
  withDisclosureAnimation,
} from './reatomDisclosureDom'

beforeEach(() => context.reset())

// --- model ------------------------------------------------------------------

test('defaults match the Ariakit disclosure store initial state', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  expect(disclosure()).toBe(false)
  expect(disclosure.animated()).toBe(false)
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)
  expect(disclosure.contentElement()).toBe(null)
  expect(disclosure.disclosureElement()).toBe(null)
  expect(disclosure.contentId()).toBe('d-content')
})

test('every unit is named after the model', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  expect(disclosure.name).toBe('d')
  expect(disclosure.animated.name).toBe('d.animated')
  expect(disclosure.animating.name).toBe('d.animating')
  expect(disclosure.mounted.name).toBe('d.mounted')
  expect(disclosure.contentId.name).toBe('d.contentId')
  expect(disclosure.contentElement.name).toBe('d.contentElement')
  expect(disclosure.disclosureElement.name).toBe('d.disclosureElement')
  expect(disclosure.show.name).toBe('d.show')
  expect(disclosure.hide.name).toBe('d.hide')
  expect(disclosure.toggle.name).toBe('d.toggle')
})

test('anonymous models get a unique name and a DOM-safe content id', () => {
  const first = reatomDisclosure()
  const second = reatomDisclosure()

  expect(first.name).not.toBe(second.name)
  expect(first.contentId()).not.toBe(second.contentId())
  // `named()` produces `disclosure#1`, which is a poor CSS selector target
  expect(first.contentId()).not.toContain('#')
  expect(disclosureContentId('menu#3.popover')).toBe('menu-3-popover-content')
})

test('show, hide, and toggle drive the open state', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  expect(disclosure.show()).toBe(true)
  expect(disclosure()).toBe(true)
  expect(disclosure.hide()).toBe(false)
  expect(disclosure()).toBe(false)
  expect(disclosure.toggle()).toBe(true)
  expect(disclosure.toggle()).toBe(false)
  // "controlled" is just someone else writing the atom
  disclosure.set(true)
  expect(disclosure.mounted()).toBe(true)
})

test('without animation the content unmounts immediately', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  disclosure.show()
  expect(disclosure.mounted()).toBe(true)
  expect(disclosure.animating()).toBe(false)

  disclosure.hide()
  expect(disclosure.mounted()).toBe(false)
})

test('mounted stays true while animating', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })
  const un = disclosure.mounted.subscribe(() => {})

  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)

  disclosure.show()
  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)

  // the enter animation ended, the content stays mounted because it is open
  disclosure.animating.set(false)
  expect(disclosure.mounted()).toBe(true)

  disclosure.hide()
  expect(disclosure()).toBe(false)
  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)

  // the leave animation ended, now it can be unmounted
  disclosure.animating.set(false)
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('mounted stays true while animating without a subscription', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })

  disclosure.show()
  expect(disclosure.mounted()).toBe(true)
  disclosure.hide()
  expect(disclosure.mounted()).toBe(true)
  disclosure.animating.set(false)
  expect(disclosure.mounted()).toBe(false)
})

test('an unobserved open and close round trip does not animate', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })

  // `animating` is a derivation, so it only knows about the `open` changes that
  // something observed. Nothing read the model between these two writes, which
  // means no view ever rendered the open state — there is nothing to animate
  // out, and the content must not stay mounted.
  disclosure.show()
  disclosure.hide()

  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)
})

test('animating starts as true when the model opens animated', () => {
  const disclosure = reatomDisclosure({
    open: true,
    animated: true,
    name: 'd',
  })

  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)
})

test('disabling animation resets animating', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })

  disclosure.show()
  expect(disclosure.animating()).toBe(true)

  // ariakit-components/src/disclosure/disclosure-store.ts:49-55
  disclosure.animated.set(false)
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(true)

  disclosure.hide()
  expect(disclosure.mounted()).toBe(false)
})

test('enabling animation while closed does not start an animation', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  // Ariakit only sets `animating` from a `subscribe(['open'])` listener, so
  // toggling `animated` (which the content element does on mount) must not
  // mount the content: ariakit-components/src/disclosure/disclosure-store.ts:57-62
  disclosure.animated.set(true)
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)

  disclosure.show()
  expect(disclosure.animating()).toBe(true)
})

test('animating survives a reconnect without a new animation', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })
  const un = disclosure.mounted.subscribe(() => {})
  disclosure.show()
  disclosure.animating.set(false)
  un()

  const un2 = disclosure.mounted.subscribe(() => {})
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(true)
  un2()
})

test('numeric animated is kept as the animation duration', () => {
  const disclosure = reatomDisclosure({ animated: 250, name: 'd' })

  expect(disclosure.animated()).toBe(250)
  disclosure.show()
  expect(disclosure.animating()).toBe(true)
})

test('withDisclosure adopts a caller-owned atom', () => {
  const open = atom(false, 'my.flag')
  const disclosure = open.extend(withDisclosure({ animated: true }))

  expect(disclosure).toBe(open)
  expect(disclosure.mounted.name).toBe('my.flag.mounted')
  expect(disclosure.contentId()).toBe('my-flag-content')

  // an outside write is a first-class transition
  open.set(true)
  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)
})

test('withDisclosure keeps an already open atom mounted', () => {
  const open = atom(true, 'my.flag')
  const disclosure = open.extend(withDisclosure({ animated: true }))

  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)
})

test('element handles are model-owned atoms', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const content = { id: 'x' } as unknown as HTMLElement
  const button = { id: 'y' } as unknown as HTMLElement

  disclosure.contentElement.set(content)
  disclosure.disclosureElement.set(button)

  expect(disclosure.contentElement()).toBe(content)
  expect(disclosure.disclosureElement()).toBe(button)
})

test('contentId can be provided for SSR-stable markup', () => {
  const disclosure = reatomDisclosure({ contentId: 'faq-panel', name: 'd' })

  expect(disclosure.contentId()).toBe('faq-panel')
  disclosure.contentId.set('faq-panel-2')
  expect(disclosure.props.content()['id']).toBe('faq-panel-2')
})

// --- prop records -----------------------------------------------------------

test('isDisclosureContentHidden is pure and total', () => {
  // ariakit-react-components/src/disclosure/disclosure-content.tsx:52-58
  expect(isDisclosureContentHidden(false)).toBe(true)
  expect(isDisclosureContentHidden(true)).toBe(false)
  expect(isDisclosureContentHidden(true, true)).toBe(true)
  expect(isDisclosureContentHidden(false, false)).toBe(false)
  expect(isDisclosureContentHidden(false, undefined, true)).toBe(false)
  expect(isDisclosureContentHidden(false, true, true)).toBe(false)
})

test('button props expose the ARIA contract', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  expect(disclosure.props.button()).toMatchObject({
    type: 'button',
    'aria-expanded': false,
    'aria-controls': 'd-content',
  })

  disclosure.show()
  expect(disclosure.props.button()['aria-expanded']).toBe(true)
})

test('button props are memoized per state', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const first = disclosure.props.button()

  expect(disclosure.props.button()).toBe(first)
  disclosure.show()
  expect(disclosure.props.button()).not.toBe(first)
})

test('button onClick toggles and remembers the disclosure element', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const button = { id: 'button' } as unknown as HTMLElement

  disclosure.props.button().onClick({ currentTarget: button })
  expect(disclosure()).toBe(true)
  expect(disclosure.disclosureElement()).toBe(button)

  disclosure.props.button().onClick()
  expect(disclosure()).toBe(false)
})

test('button onClick respects a prevented event', () => {
  // ariakit-react-components/src/disclosure/disclosure.tsx:71-78
  const disclosure = reatomDisclosure({ name: 'd' })

  disclosure.props.button().onClick({ defaultPrevented: true })
  expect(disclosure()).toBe(false)
})

test('button ref assigns the disclosure element', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const button = { id: 'button' } as unknown as HTMLElement

  disclosure.props.button().ref(button)
  expect(disclosure.disclosureElement()).toBe(button)
  disclosure.props.button().ref(null)
  expect(disclosure.disclosureElement()).toBe(null)
})

test('content props hide the element until it is mounted', () => {
  const disclosure = reatomDisclosure({ name: 'd' })

  expect(disclosure.props.content()).toMatchObject({
    id: 'd-content',
    hidden: true,
    style: { display: 'none' },
    'data-open': undefined,
  })

  disclosure.show()
  expect(disclosure.props.content()).toMatchObject({
    hidden: false,
    style: undefined,
    'data-open': true,
  })
})

test('content props keep the element visible while animating out', () => {
  const disclosure = reatomDisclosure({ animated: true, name: 'd' })

  disclosure.show()
  disclosure.animating.set(false)
  disclosure.hide()

  expect(disclosure.props.content()).toMatchObject({
    hidden: false,
    'data-open': undefined,
  })

  disclosure.animating.set(false)
  expect(disclosure.props.content().hidden).toBe(true)
})

test('content ref assigns the content element', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const content = { id: 'content' } as unknown as HTMLElement

  disclosure.props.content().ref(content)
  expect(disclosure.contentElement()).toBe(content)
})

test('alwaysVisible keeps the content rendered for exit animations', () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const props = disclosureProps(disclosure, { alwaysVisible: true })

  expect(props.content()).toMatchObject({ hidden: false, style: undefined })
})

test('withDisclosureProps names the records after the model', () => {
  const disclosure = atom(false, 'my.flag')
    .extend(withDisclosure())
    .extend(withDisclosureProps())

  expect(disclosure.props.button.name).toBe('my.flag.props.button')
  expect(disclosure.props.content.name).toBe('my.flag.props.content')
})

// --- animation layer --------------------------------------------------------

test('parseCssTime takes the longest CSS time in seconds or milliseconds', () => {
  // ariakit-react-components/src/disclosure/disclosure-content.tsx:37-50
  expect(parseCssTime('0s')).toBe(0)
  expect(parseCssTime('0.15s')).toBe(150)
  expect(parseCssTime('150ms')).toBe(150)
  expect(parseCssTime('0.1s, 0.3s')).toBe(300)
  expect(parseCssTime('0.1s', '250ms')).toBe(250)
  expect(parseCssTime('')).toBe(0)
  expect(parseCssTime(undefined)).toBe(0)
})

test('getAnimationTimeout sums the longest delay and duration', () => {
  const style = {
    transitionDuration: '0.2s',
    animationDuration: '0s',
    transitionDelay: '50ms',
    animationDelay: '0s',
  }

  expect(getAnimationTimeout(style)).toBe(250)
  expect(
    getAnimationTimeout(style, {
      transitionDuration: '0.5s',
      animationDuration: '0s',
      transitionDelay: '0s',
      animationDelay: '0s',
    }),
  ).toBe(550)
  expect(getAnimationTimeout()).toBe(0)
})

test('the animation layer stops a numeric animation after its timeout', async () => {
  const disclosure = reatomDisclosure({ animated: 20, name: 'd' }).extend(
    withDisclosureAnimation(),
  )
  const un = disclosure.mounted.subscribe(() => {})

  disclosure.show()
  expect(disclosure.animating()).toBe(true)
  expect(disclosure.mounted()).toBe(true)

  await wrap(sleep(60))
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(true)

  disclosure.hide()
  expect(disclosure.mounted()).toBe(true)
  await wrap(sleep(60))
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('the animation layer restarts on a new transition', async () => {
  const disclosure = reatomDisclosure({ animated: 200, name: 'd' }).extend(
    withDisclosureAnimation(),
  )
  const un = disclosure.mounted.subscribe(() => {})

  disclosure.show()
  await wrap(sleep(50))
  // closing in the middle of the enter animation restarts the wait, so the
  // leave animation gets its full duration
  disclosure.hide()

  await wrap(sleep(150))
  expect(disclosure.animating()).toBe(true)

  await wrap(sleep(150))
  expect(disclosure.animating()).toBe(false)
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('the animation layer does nothing while the model is not animated', async () => {
  const disclosure = reatomDisclosure({ name: 'd' }).extend(
    withDisclosureAnimation(),
  )
  const un = disclosure.mounted.subscribe(() => {})

  disclosure.show()
  expect(disclosure.animating()).toBe(false)
  await wrap(sleep(20))
  disclosure.hide()
  expect(disclosure.mounted()).toBe(false)

  un()
})

test('the animation layer is lazy: it works only while subscribed', async () => {
  const disclosure = reatomDisclosure({ animated: 20, name: 'd' }).extend(
    withDisclosureAnimation(),
  )

  disclosure.show()
  await wrap(sleep(60))
  // nothing is connected, so no animation flow has started
  expect(disclosure.animating()).toBe(true)

  const un = disclosure.mounted.subscribe(() => {})
  await wrap(sleep(60))
  expect(disclosure.animating()).toBe(false)
  un()
})

test('the model stays usable as a plain boolean atom', async () => {
  const disclosure = reatomDisclosure({ name: 'd' })
  const seen: Array<boolean> = []
  const track = effect(() => void seen.push(disclosure()), 'd.track')

  disclosure.show()
  await null
  disclosure.show()
  await null
  disclosure.hide()
  await null

  track.unsubscribe()
  expect(seen).toEqual([false, true, false])
})
