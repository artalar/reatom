An **EXPERIMENTAL** JSX runtime for describing dynamic DOM UIs with Reatom.

## Installation

```sh
npm install @reatom/jsx
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@reatom/jsx"
  }
}
```

`vite.config.js`:

```js
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'hf',
    jsxInject: `import { h, hf } from "@reatom/jsx";`,
  },
})
```

## Example

Define a component:

```ts
import { atom, action } from '@reatom/core'

export const inputAtom = atom('')
const onInput = action((ctx, event) =>
  inputAtom(ctx, event.currentTarget.value),
)
export const Input = () => <input value={inputAtom} oninput={onInput} />
```

Render it:

```tsx
import { connectLogger } from '@reatom/framework'
import { ctx, mount } from '@reatom/jsx'
import { App } from './App'

if (import.meta.env.DEV) {
  const disconnect = connectLogger(ctx)
}

mount(document.getElementById('app')!, <App />)
```

## Reference

This library implements a common TypeScript JSX factory that creates and configures **native** DOM elements.

By default, props passed to the JSX factory are set as attributes. Add `field:` prefix to a prop name to set element fields instead of attributes. It can be used to set stuff like `HTMLInputElement..indeterminate` and `SVGPathElement..d`. There are props that treated as fields by default:

- `innerHTML`
- `innerText`

Atom- or function-valued props can be used to create reactive bindings to an element's attributes/fields. The binding is automatically disposed when the element is disconnected from the DOM.

`children` prop specifies the inner content of an element, which can be one of the following:

- `false`/`null`/`undefined` to render nothing
- a string, a number, or `true` to create a text node
- a native DOM node to insert it as-is
- an atom or a function returning any option listed above

### Handling events

Use `on*` props to add event handlers. Passed functions are automatically bound to a relevant `Ctx` value: `oninput={(ctx, event) => setValue(ctx, event.currentTarget.value)}`.

### Styles

Object-valued `style` prop applies styles granularly: `style={{top: 0, display: equalsFalseForNow && 'none'}}` sets `top: 0;`.

`false`, `null` and `undefined` style values remove the property. Non-string style values are stringified (we don't add `px` to numeric values automatically).

### Spreads

There's a special `$props` prop which can be used to spread props reactively: `<div someStaticProp $props={ctx => getDynamicProps(ctx)}>`. Valid `$props` values are the following:

- a plain props record
- a function returning a record
- an atom storing a record
- an array of options listed above

### SVG

To create elements with names within the SVG namespace, you should prepend `svg:` to the tag name:

```tsx
const anSvgElement = (
  <svg:svg>
    <svg:path field:d="???" />
  </svg:svg>
)
```

### Lifecycle

In Reatom, every atom has lifecycle events to which you can subscribe with `onConnect`/`onDisconnect` functions. By default, components don't have an atom associated with them, but you may wrap the component code in an atom manually to achieve the same result:

```tsx
import { onConnect, onDisconnect } from '@reatom/hooks'

const MyWidget = () => {
  const lifecycle = atom((ctx) => <div>Something inside</div>)

  onConnect(lifecycle, (ctx) => console.log('component connected'))
  onDisconnect(lifecycle, (ctx) => console.log('component disconnected'))

  return lifecycle
}
```

Because the pattern used above is somewhat verbose, `@reatom/jsx` has a built-in convenience component called `Lifecycle` that creates an atom for you:

```tsx
import { Lifecycle } from '@reatom/jsx'

const MyWidget = () => {
  return (
    <Lifecycle
      onConnect={(ctx) => console.log('component connected')}
      onDisconnect={(ctx) => console.log('component disconnected')}
    >
      Something inside
    </Lifecycle>
  )
}
```

### CSS-in-JS

This module implements a minimal, intuitive and efficient styling engine.

```tsx
import { css } from '@reatom/jsx'

const colorHovered = atom('red', 'colorHovered')

const Box = () => {
  return (
    <div
      css:color-default="some-default-value"
      css:color-hovered={colorHovered}
      css={`
        width: 64px;
        height: 64px;
        background-color: var(--color-default);
        &:hover {
          background-color: var(--color-hovered);
        }
      `}
    />
  )
}
```

The example above is correctly formatted by Prettier and has syntax highlighting provided by `vscode-styled-components` extension.

### Components

Components in `@reatom/jsx` are just functions returning JSX elements. They neither have state nor any lifecycle associated with them. Because component instantiation boils down into function calls, features like `$props` are not supported in them.

## Limitations

- No DOM-less SSR (requires a DOM API implementation like `linkedom` to be provided)
- No keyed lists support
