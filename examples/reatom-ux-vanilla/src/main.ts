import type { Computed } from '@reatom/core'
import { reatomCheckbox } from '@reatom/ux'

/**
 * The whole point of `@reatom/ux`: the models carry no view dependency, so a
 * plain-DOM app binds them with a few lines and no framework.
 *
 * A ux model exposes reactive **prop records** — `computed` values of plain
 * objects with `checked`, `aria-*`, `ref`, and the event handlers, taken from
 * `model.props`. `@reatom/jsx` spreads them with `$spread`, React with a plain
 * spread; here `spread` does the same by hand.
 */
const spread = (
  element: HTMLElement,
  props: Computed<Record<string, any>>,
): void => {
  const record = props()
  record.ref?.(element)

  // Handlers keep a stable identity across records, so they attach once.
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), value)
    }
  }

  props.subscribe((next) => {
    for (const [key, value] of Object.entries(next)) {
      if (key === 'ref' || key.startsWith('on')) continue
      // `checked` is a property, not an attribute — the browser reflects it.
      if (key === 'checked') {
        ;(element as HTMLInputElement).checked = Boolean(value)
        continue
      }
      const attribute = key === 'tabIndex' ? 'tabindex' : key
      if (value == null) element.removeAttribute(attribute)
      else element.setAttribute(attribute, String(value))
    }
  })
}

// One model, shared by every checkbox: the group value is an array of the
// checked item values.
const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
const options = ['apple', 'orange', 'pear']

const app = document.querySelector<HTMLDivElement>('#app')!
app.append(el('h1', '@reatom/ux — no framework'))

for (const value of options) {
  const input = document.createElement('input')
  input.type = 'checkbox'
  spread(input, fruits.item(value).props.control)

  const label = el('label', ` ${value}`)
  label.style.display = 'block'
  label.prepend(input)
  app.append(label)
}

// A reactive read: the model atom pushes the current value to the page.
const output = el('pre')
app.append(output)
fruits.subscribe((value) => {
  output.textContent = `checked: ${JSON.stringify(value)}`
})

function el(tag: string, text = ''): HTMLElement {
  const node = document.createElement(tag)
  node.textContent = text
  return node
}
