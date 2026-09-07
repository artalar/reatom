> [!NOTE]
> We prefer English language for all communication.

## Creating an issue

Before creating an issue please ensure that the problem is not [already reported](https://github.com/reatom/reatom/issues).

If you want to report a bug, create a reproduction using StackBlitz or CodeSandbox. If you want to request a feature, add motivation section and some usage examples.

## Sending a Pull Request

> [!TODO]
> Update requirements for development

1. fork and clone the repository
2. create a development branch from `v1001`
3. install dependencies from the root of the repo (Node 24.2.0 and `pnpm@10.25.0` are recommended):
   ```sh
   pnpm install
   ```
   Note: this command installs dependencies for all packages, but only builds `@reatom/core`.
4. build the package you are editing from the root of the repo:
   ```sh
   pnpm --filter <PACKAGE_NAME> run build
   ```
   Replace `<PACKAGE_NAME>` with the relevant package name like `@reatom/react`
5. [make changes](#coding-guide) and [commit them](#commit-messages)
6. upload feature branch and create a [Pull Request](https://github.com/reatom/reatom/compare) to merge changes to `v1001`
7. link your PR to the issue using a [closing keyword](https://help.github.com/en/articles/closing-issues-using-keywords) or provide changes description with motivation and explanation in the comment (example: `fix #74`)
8. wait until a team member responds

## Creating a package

The goal of Reatom ecosystem is to provide adapters for Web APIs and popular npm modules. Therefore, the process of creating a new package is almost identical to editing an existing one ([Sending a Pull Request](#sending-a-pull-request)), but you should also create the package using an interactive script ran in the repository root:

```sh
pnpm run package-generator
```

Add needed dependencies by running `pnpm install` in the repository root. To add a dependency to a specific package, use `pnpm --filter <PACKAGE_NAME> add <LIBRARY>` or update the package's `package.json` and then run `pnpm install` from the repository root. If you're making an adapter for a particular npm library (like `@reatom/react` for React), add the library as a peer dependency using `pnpm --filter <PACKAGE_NAME> add --save-peer <LIBRARY>`.

<!-- ??? -->
<!-- To add dependencies, add them manually to the `package.json` of the new package and install them from the root of the repo. -->

<!-- ??? -->
<!-- To add new Package naming rule. -->

## Agent skills

Agent skills for AI coding assistants live in [`plugin/skills/`](plugin/skills/). This is the only directory you should edit; the root `skills/` symlink opens the same files.

| Path                               | Role                                                    |
| ---------------------------------- | ------------------------------------------------------- |
| `plugin/skills/`                   | Canonical skill files (edit here)                       |
| `skills/`                          | Symlink → `plugin/skills/` (historical path)            |
| `.cursor/skills/`                  | Symlink → `plugin/skills/` (Cursor discovery)           |
| `.agents/skills/`                  | Symlink → `plugin/skills/` (Codex discovery)            |
| `.claude/skills/`                  | Symlink → `plugin/skills/` (Claude Code project skills) |
| `.claude-plugin/marketplace.json`  | Claude Code marketplace catalog                         |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog                               |
| `.cursor-plugin/marketplace.json`  | Cursor marketplace catalog                              |
| `plugin/.claude-plugin/`           | Claude Code plugin manifest                             |
| `plugin/.codex-plugin/`            | Codex plugin manifest                                   |
| `plugin/.cursor-plugin/`           | Cursor plugin manifest                                  |
| `CLAUDE.md`                        | Symlink → `AGENTS.md` (Claude Code instructions)        |

A new skill directory under `plugin/skills/` is published everywhere at once — none of the manifests list skills by name.

Skills live under `plugin/` rather than at the repository root because every client copies the whole plugin directory into its cache on install: `plugin/` is ~170 KB, the repository is ~250 MB.

Each skill has a `SKILL.md` entrypoint. Bundled reference docs use `REFERENCE.md` (not `README.md` or `summary.md`).

External files symlink to skill references — edit the skill file, not the symlink target:

| Symlink                            | Canonical source                        |
| ---------------------------------- | --------------------------------------- |
| `summary.md`                       | `plugin/skills/reatom/REFERENCE.md`     |
| `docs/src/content/docs/summary.md` | `plugin/skills/reatom/REFERENCE.md`     |
| `packages/core/README.md`          | `plugin/skills/reatom/REFERENCE.md`     |
| `packages/jsx/README.md`           | `plugin/skills/reatom-jsx/REFERENCE.md` |

**Do not diff, merge, or sync symlink targets.** If you see the same content at `summary.md`, `packages/core/README.md`, and `plugin/skills/reatom/REFERENCE.md`, that is expected — they are one file. Comparing or copying between them wastes review time and agent tokens.

The `reatom-review` skill has no bundled reference — it instructs the agent to also load the `reatom` skill.

See also [`AGENTS.md`](AGENTS.md) and [`plugin/skills/README.md`](plugin/skills/README.md) for the layout diagram.

## Coding guide

- bug fixes should also add tests that reproduce the addressed bug
- all new features should be tested and documented
<!-- - always use `@ts-expect-error` instead of `@ts-ignore` -->
- use `// @ts-ignore` if you're not sure why an error appears or you think it's acceptable to suppress it temporarily. Use `// @ts-expect-error` if you're certain the error is a false positive and you want TypeScript to expect it.

## Commit messages

Commit messages should follow the [Conventional Commits](https://conventionalcommits.org) specification:

```
<type>[optional scope]: <description>
```

### Allowed `<type>`

- `chore`: any repository maintainance changes
- `feat`: code change that adds a new feature
- `fix`: bug fix
- `perf`: code change that improves performance
- `refactor`: code change that is neither a feature addition nor a bug fix nor a performance improvement
- `docs`: documentation only changes
- `ci`: a change made to CI configurations and scripts
- `style`: cosmetic code change
- `test`: change that only adds or corrects tests
- `revert`: change that reverts previous commits

### Allowed `<scope>`

Package directory name. Eg: `/packages/react` is scoped as `react`.

### `<description>` rules

- should be written in English
- should be in imperative mood (like `change` instead `changed` or `changes`)
- should not be capitalized
- should not have period (`.`) at the end

### Commit message examples

```
docs: fix typo in react
fix(core): add check for atoms with equal ids
```
