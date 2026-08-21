# `@reatom/ux` — React

The same headless `reatomCheckbox` model as
[`reatom-ux-vanilla`](../reatom-ux-vanilla), bound with **React** through
[`@reatom/react`](../../packages/react) instead of raw DOM.

- **What:** three checkboxes backed by one `reatomCheckbox` group; the shared
  array value is printed below and stays in sync.
- **Why:** proves `@reatom/ux` models are view-agnostic — the model file is
  identical to the no-framework example; only the binding (`reatomComponent` +
  a plain React spread of `item(value).props.control()`) differs.
- **Run:** from the repo root — `pnpm install` ·
  `pnpm --filter @reatom/ux run build` · `pnpm --filter reatom-ux-react run dev`.

The point of comparison: open `src/App.tsx` next to
`reatom-ux-vanilla/src/main.ts`. The `reatomCheckbox(...)` line is the same; the
prop record just reaches the element a different way.
