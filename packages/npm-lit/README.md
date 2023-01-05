# What is Lit?

Lit is a simple library for building fast, lightweight web components.

At Lit's core is a boilerplate-killing component base class that provides reactive state, scoped styles, and a declarative template system that's tiny, fast and expressive

## About

Package provide 2 functions:

- setupCtx(ctx) - set context
- withReatom(el: LitElement) - mixin for subscribes to atom changes

```Javascript
withReatom(LitElement)
```

## Example

```Javascript
import { setupCtx, withReatom } from "@reatom/npm-lit";
import { atom, action, createCtx } from "@reatom/core";
import { LitElement, html } from "lit";

const ctx = createCtx();
setupCtx(ctx);

const count = atom(0);
const text = atom('Empty');
const countText = atom((ctx) => `Current count: ${ctx.spy(count)}`);
const increment = action((ctx) => {
  count(ctx, (v) => v + 1);
});

setTimeout(() => text(ctx, 'Not Empty'), 5000)
setInterval(() => increment(ctx), 1000);


export class Test extends withReatom(LitElement) {
  render() {
    return html`<div>
      TextAtom: ${this.ctx.spy(text)} <br />
      Render: ${this.ctx.spy(countText)} <br />
      <button @click="${() => increment(ctx)}">Inc</button>
    </div>`;
  }
}

if (!customElements.get("test-element")) {
  customElements.define("test-element", Test);
}

```
