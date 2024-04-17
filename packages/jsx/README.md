An **EXPERIMENTAL** JSX runtime for describing dynamic DOM UIs with Reatom.

## Core benefits

- No extra build step needed; we use plain TSX (JSX), which is currently supported in various tools.
- Nice integrations with the platform; `<div />` returns the real element.
- Rerender-less architecture with direct reactive bindings, which means extreme performance!
- Only 1kb runtime script (excluding the tiny core package).
- Built-in CSS management with a simple API and efficient CSS variables usage.

## Installation

You can use [@reatom/core](https://reatom.dev/packages/core) instead of the [@reatom/framework](https://reatom.dev/packages/framework), but we highly recommend using the framework to access the most features of Reatom.

<Tabs>
<TabItem label="npm">

  ```sh
npm install @reatom/framework @reatom/jsx
  ```

</TabItem>
<TabItem label="pnpm">

  ```sh
pnpm add @reatom/framework @reatom/jsx
  ```

</TabItem>
<TabItem label="yarn">

  ```sh
yarn add @reatom/framework @reatom/jsx
  ```

</TabItem>
<TabItem label="bun">

  ```sh
bun add @reatom/framework @reatom/jsx
  ```

</TabItem>
</Tabs>


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

### Using with different framework.

You can use different JSX pragmas in different files. For example, if you have a React project and want to speedup some of you components, you can write them with reatom/jsx with a couple of simple steps:

- create a separate package for you Reatom components
- insert `tsconfig.json` as described above, you can use [extends](https://www.typescriptlang.org/tsconfig#extends) property, to use your project configurations
- in every `*.tsx` file use the following code:

```tsx
// @jsxRuntime classic
// @jsx h
import { h } from '@reatom/jsx';
```

## Example

> Advanced example with dynamic entities you can find here: https://github.com/artalar/reatom/tree/v3/examples/reatom-jsx

Define a component:

```ts
import { atom, action } from '@reatom/core'

export const inputAtom = atom('')
const onInput = action((ctx, event) =>
  inputAtom(ctx, event.currentTarget.value),
)
export const Input = () => <input value={inputAtom} on:input={onInput} />
```

Render it:

```tsx
import { connectLogger } from '@reatom/framework'
import { ctx, mount } from '@reatom/jsx'
import { App } from './App'

if (import.meta.env.MODE === 'development') {
  connectLogger(ctx)
}

mount(document.getElementById('app')!, <App />)
```

You can create `ctx` manually and use it to create a scoped render instance with `reatomJsx`.

## Reference

This library implements a common TypeScript JSX factory that creates and configures **native** DOM elements.

By default, props passed to the JSX factory are set as properties. Add `attr:` prefix to the name to set element attribute instead of property.

For all kinds of properties you can pass a primitive value or an atom with a primitive value.

The `children` prop specifies the inner content of an element, which can be one of the following:

- `false`/`null`/`undefined` to render nothing
- a string or a number to create a text node
- a native DOM node to insert it as-is
- an atom or a function returning any option listed above

### Handling events

Use `on:*` props to add event handlers. Passed functions are automatically bound to a relevant `Ctx` value: `on:input={(ctx, event) => setValue(ctx, event.currentTarget.value)}`.

### Models

For simple `AtomMut` bindings to the native input you can use `model:value` syntax, where "value" could be: `value`, `valueAsNumber`, `checked`.

```tsx
export const inputAtom = atom('')
export const Input = () => <input model:value={inputAtom} />
```

By the way, you can safely create any needed resources inside a component body, as it calls only once when it created.

```tsx
export const Input = () => {
  export const input = atom('')
  return <input model:value={input} />
}
```

### Styles

Object-valued `style` prop applies styles granularly: `style={{top: 0, display: equalsFalseForNow && 'none'}}` sets `top: 0;`.

`false`, `null` and `undefined` style values remove the property. Non-string style values are stringified (we don't add `px` to numeric values automatically).

### CSS-in-JS

We have a minimal, intuitive, and efficient styling engine tightly integrated with components. You can set a styles in `css` prop and all relative css-variables to `css:variable-name` prop.

> The example below is correctly formatted by Prettier and has syntax highlighting provided by the 'vscode-styled-components' extension

```tsx
export const HeaderInput = ({ size = 0 }) => {
  const input = atom('')
  const size = atom((ctx) => ctx.spy(input).length)
  return (
    <input
      model:value={input}
      css:size={size}
      css={`
        font-size: calc(1em + var(--size) * 0.1em);
      `}
    />
  )
}
```

Under the hood, it will create a unique class name and will be converted to this code:

```tsx
export const HeaderInput = ({ size = 0 }) => {
  const input = atom('')
  const size = atom((ctx) => ctx.spy(input).length)
  return (
    <input
      className={createAndInsertClass(`
        font-size: calc(1em + var(--size) * 0.1em);
      `)}
      style={atom((ctx) => ({
        '--size': ctx.spy(size),
      }))}
    />
  )
}
```

### Components

Components in `@reatom/jsx` are just functions returning JSX elements. They neither have state nor any lifecycle associated with them. Because component instantiation boils down into function calls, features like `$spread` are not supported in them.

You can put an atom with a list of other elements as a children of an element to archive rendering of a dynamic list. But be note that you can't put a as children a few atoms with a list and other elements, as the [fragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment) is not supported to replace itself.

> You should know that when you create a component which uses some atoms, it creates a subscription to those atoms immediately. The subscription will disposed only after you will put the elements to the `mount`ed node and if it will be unused after some condition rendering. Do not put the same elements as a children to other elements a few times! Recreate them with a component instead.

### Spreads

In Reatom, there is no concept of "rerender" like React. Instead, we have a special `$spread` prop that can be used to spread props reactively.

```tsx
<div
  $spread={atom((ctx) =>
    ctx.spy(valid)
      ? { disabled: true, readonly: true }
      : { disabled: false, readonly: false },
  )}
/>
```

### SVG

To create elements with names within the SVG namespace, you should prepend `svg:` to the tag name:

```tsx
const anSvgElement = (
  <svg:svg>
    <svg:path d="???" />
  </svg:svg>
)
```

<!-- ### Lifecycle

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
``` -->

## Limitations

These limitations will be fixed in the feature

- No DOM-less SSR (requires a DOM API implementation like `linkedom` to be provided)
- No keyed lists support
