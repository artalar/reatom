---
name: reatom-jsx
description: Implements and documents @reatom/jsx — reactive native DOM JSX. Use when writing JSX components, mount/unmount, props (prop:/attr:/on:), css prop, models, refs, SVG, Bind, or TypeScript JSX typings with Reatom.
---

# Reatom JSX

Use this skill when implementing or explaining `@reatom/jsx`. Treat [REFERENCE.md](REFERENCE.md) as the canonical reference bundled with this skill.

## How to use

1. Read the relevant sections of [REFERENCE.md](REFERENCE.md) — do not assume React/Vue JSX semantics (no virtual DOM, no diffing, no component re-renders).
2. For Reatom core (atoms, wrap, async, routing), use the `reatom` skill.
3. For pull requests and skeptic validation, use `reatom-review` plus this skill for JSX-specific patterns.

## Section map

Use this map to open only the relevant parts of [REFERENCE.md](REFERENCE.md):

| Topic                        | Section                                               |
| ---------------------------- | ----------------------------------------------------- |
| Install, tsconfig, Vite      | Installation, Framework compatibility                 |
| Bootstrapping the app        | Example, Hot module replacement                       |
| Props, children, bindings    | Reference → Props, Children, Models                   |
| Inline and css-prop styles   | Reference → `style` props, `style:*`, CSS-in-JS       |
| Class names                  | Reference → `class` or `className`, `reatomClassName` |
| Components and lists         | Reference → Components                                |
| Bulk prop binding            | Reference → `$spread`                                 |
| SVG and raw markup           | Reference → SVG                                       |
| Mount side effects           | Reference → `ref` props                               |
| Errors, boundaries, jsxError | Error handling                                        |
| Utilities                    | Utilities → `reatomClassName`, `css`, `<Bind>`        |
| TypeScript                   | TypeScript                                            |
| SSR and keyed lists          | Limitations                                           |

## Implementation defaults

- Components are plain functions evaluated once at mount; use atoms and reactive props for updates.
- Reads: zero-arg atom call. Writes: `.set(...)`.
- `on:*` handlers that touch Reatom state are wrapped automatically; do not wrap manually in JSX.
- Never reuse a JSX element instance in multiple places — call the component function or factory each time.
- Plain writable atoms: `model:value` / `model:checked` for search, toggles, linked-list row atoms.
- Real forms: `reatomForm` from `@reatom/core` with `<form model={form}>` and `model:field={form.fields.x}` — never `model:value` on field atoms (bypasses `field.change`).
- Form submit loader: style `[data-submitting]` on the form (set automatically by `model={form}`); CSS-only spinner on `[type='submit']::after`.
- For SPA navigation use `reatomRoute`: links via `href={route.path(params)}`, programmatic moves via `route.go(params)` — see the `reatom` skill Routing section.
- Use `prop:*` for DOM properties, `attr:*` for attributes when semantics matter.
- Mount with `mount(root, <App />)`; call `unmount()` on teardown (including Vite HMR). Prefer `@reatom/vite` (`reatom()` plugin) so mount/route HMR dispose is automatic.
- For dynamic lists, store elements in atoms or map inside reactive children — no keyed reconciliation.
- Isolate UI failures with `<ErrorBoundary fallback={...}>` and lazy children `{() => <Child />}`; track globally via `jsxError` / `addCallHook(jsxError, ...)`.

When [REFERENCE.md](REFERENCE.md) and local examples disagree, prefer the reference and fix the example if it is wrong.
