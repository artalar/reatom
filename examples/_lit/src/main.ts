import { setupCtx, withReatom } from '@reatom/npm-lit'
import { atom, action, createCtx } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { LitElement, html } from 'lit'

const ctx = createCtx()
setupCtx(ctx)

const count = atom(0, 'count')
const countText = atom((ctx) => `Current count: ${ctx.spy(count)}`, 'countText')
const increment = action((ctx) => {
  count(ctx, (v) => v + 1)
}, 'increment')
onConnect(count, (ctx) => {
  const timer = setInterval(() => increment(ctx), 1000)
  return () => clearInterval(timer)
})

const text = atom('Empty', 'text')

export class AppElement extends withReatom(LitElement) {
  render() {
    return html`<div>
      <input @input="${(event) => text(this.ctx, event.currentTarget.value)}" />
      <p>${this.ctx.spy(text)}</p>
      <button @click="${() => increment(this.ctx)}">Increment</button>
      <p>${this.ctx.spy(countText)}</p>
    </div>`
  }
}

customElements.define('app-element', AppElement)
