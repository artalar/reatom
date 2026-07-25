# `@reatom/ux` GPT Sol / reatom-review pass

One skeptical review per feature directory, following
[`skills/reatom-review`](../../../skills/reatom-review/SKILL.md), plus
bundle-size notes (inline single-use helpers such as the old
`reportedChecked`).

Reviews live next to this file as `<feature>.md`. Agents applied clear
low-risk fixes in-tree where safe; open items remain in each file.

## Snapshot

| Feature | Review |
| --- | --- |
| checkbox | [checkbox.md](checkbox.md) — inlined `reportedChecked`; typing/disabled click fixes |
| collection | [collection.md](collection.md) |
| combobox | [combobox.md](combobox.md) |
| command | [command.md](command.md) |
| composite | [composite.md](composite.md) — typeahead included |
| composite-overflow | [composite-overflow.md](composite-overflow.md) |
| dialog | [dialog.md](dialog.md) |
| disclosure | [disclosure.md](disclosure.md) |
| focusable | [focusable.md](focusable.md) |
| hovercard | [hovercard.md](hovercard.md) |
| interactions | [interactions.md](interactions.md) |
| menu | [menu.md](menu.md) |
| menubar | [menubar.md](menubar.md) |
| popover | [popover.md](popover.md) |
| radio | [radio.md](radio.md) |
| select | [select.md](select.md) |
| tab | [tab.md](tab.md) |
| tag | [tag.md](tag.md) |
| toolbar | [toolbar.md](toolbar.md) |
| tooltip | [tooltip.md](tooltip.md) |

Verification after the pass: `pnpm -F @reatom/ux typecheck` clean;
`test:unit` 1105; `test:browser` 176.
