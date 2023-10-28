This is an **EXPERIMENTAL** package that allows you to describe native DOM elements using JSX. The cool thing is that you can assign atoms and actions to the native properties, and they will be bound correctly.

## Installation

```sh
npm i @reatom/jsx
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@reatom/jsx"
  }
}
```

`vite.config.js`

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

- `className` (for compatibility with React libraries like [`stylerun`](https://github.com/artalar/stylerun))
- `innerHTML`
- `innerText`

Atom-valued props create a reactive binding to an element's attribute/field. The binding is automatically disposed when the element is disconnected from the DOM.

`children` prop specifies the inner content of an element, which can be one of the following:

- `false`/`null`/`undefined` to render nothing
- a string, a number, or `true` to create a text node
- a DOM node to insert it as-is

Object-valued `style` prop applies styles granularly: `style={{top: 0, display: equalsFalseForNow && 'none'}}` sets `top: 0;`.

`false`, `null` and `undefined` style values remove the property. Non-string style values are stringified (we don't `px` for numeric values automatically).

Use `on*` props to add event handlers. They're automatically bound to a relevant `Ctx` value: `oninput={(ctx, event) => setValue(ctx, event.currentTarget.value)}`.

There's a special `$props` prop which you can use to spread props reactively: `<div someStaticProp $props={atom(ctx => getReactiveProps(ctx))}>`.

## Limitations

- No SSR support
- No keyed lists support

About the last one: When you create an element (`<Element />`), it renders once, binds all passed atoms and actions, and will not render anymore. All changes will be propagated exactly to the element's properties. However, if you need to describe conditional logic, you can put an element in the atom and achieve rerenders through this. There is no "virtual DOM," so the elements will be recreated with each render, but this could be acceptable for some cases.

Here is an example: [https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx](https://github.com/artalar/reatom-jsx/blob/main/src/App.tsx)
