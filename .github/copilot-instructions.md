# Reatom — GitHub Copilot instructions

We prefer English for all communication and files.

This repo already ships rich agent knowledge. Prefer reading it over guessing:

- [`AGENTS.md`](../AGENTS.md) — skills, symlink layout, and what not to touch.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — full contributor guide.
- [`plugin/skills/`](../plugin/skills/) — canonical Reatom v1001 knowledge. VS Code
  does not auto-load these, so open the relevant `SKILL.md` / `REFERENCE.md` yourself:
  - `plugin/skills/reatom` — core API, models, actions, forms, routing, persistence.
  - `plugin/skills/reatom-async` — `wrap`, `withAsync`/`withAsyncData`, abort, sampling, Suspense.
  - `plugin/skills/reatom-jsx` — `@reatom/jsx` native DOM JSX.
  - `plugin/skills/reatom-review` — v1001 review checklist; load it before reviewing changes.

## Hard rules

- Branch from `v1001` and open pull requests against `v1001` (not `main`).
- Commit with Conventional Commits: `<type>(<scope>): <description>`, where
  `<scope>` is the package directory name (e.g. `react`, `core`, `jsx`).
  Description is imperative, lowercase, no trailing period. Example:
  `fix(core): add check for atoms with equal ids`.
- Bug fixes must add a test that reproduces the bug.
- New features must be tested and documented.
- Use `@ts-expect-error` for known false positives; `@ts-ignore` only for
  errors you are unsure about and want to suppress temporarily.

## Skills and symlinks

Edit agent skills only in [`plugin/skills/`](../plugin/skills/). The root
`skills/`, `.cursor/skills/`, `.agents/skills/`, and `.claude/skills/` are
directory symlinks to it. Several readmes are file
symlinks to skill references (`summary.md`, `docs/src/content/docs/summary.md`,
`packages/core/README.md`, `packages/jsx/README.md`). **Do not diff, merge, or
sync symlink targets** — identical content at these paths is expected.

## Build and test

- Install once from the repo root (Node 24.2.0, `pnpm@10.32.1` recommended):
  `pnpm install` (installs all packages, builds only `@reatom/core`).
- Build the package you edit: `pnpm --filter <PACKAGE_NAME> run build`.
- Test it: `pnpm --filter <PACKAGE_NAME> run test`.

## After meaningful changes

Sync the change with the relevant JSDoc and the docs handbook
(`docs/src/content/docs/handbook`).
