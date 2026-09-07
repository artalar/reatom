# Agent instructions

## Skills and symlinks

Agent skills live in [`plugin/skills/`](plugin/skills/). **Edit only that directory.** The root `skills/` is a directory symlink to it, so both paths open the same files.

`plugin/` is the installable plugin — small on purpose, so installing it does not copy the whole monorepo into an agent's cache. Its per-client manifests are `plugin/.claude-plugin/plugin.json`, `plugin/.codex-plugin/plugin.json`, and `plugin/.cursor-plugin/plugin.json`; the catalogs pointing at it are `.claude-plugin/marketplace.json` (Claude Code), `.agents/plugins/marketplace.json` (Codex), and `.cursor-plugin/marketplace.json` (Cursor) in the repository root. All of them resolve to `plugin/skills/`. Add a skill there and every entry point picks it up; no manifest edit is needed.

`.cursor/skills/`, `.agents/skills/`, and `.claude/skills/` are directory symlinks to `plugin/skills/`. They are not separate copies.

`CLAUDE.md` is a file symlink to this file — edit `AGENTS.md`.

Several external readmes are file symlinks to skill references:

| Symlink                            | Canonical source                        |
| ---------------------------------- | --------------------------------------- |
| `summary.md`                       | `plugin/skills/reatom/REFERENCE.md`     |
| `docs/src/content/docs/summary.md` | `plugin/skills/reatom/REFERENCE.md`     |
| `packages/core/README.md`          | `plugin/skills/reatom/REFERENCE.md`     |
| `packages/jsx/README.md`           | `plugin/skills/reatom-jsx/REFERENCE.md` |

**Do not diff, merge, or sync these paths.** Identical content at multiple paths is expected — they are the same file via symlinks.

See [`plugin/skills/README.md`](plugin/skills/README.md) for the full layout diagram and skill list.

Contributors: see [Agent skills](CONTRIBUTING.md#agent-skills) in `CONTRIBUTING.md`.
