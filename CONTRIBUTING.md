# Contributing

Code style and development conventions

## Comments

- `TODO:` - proposal for rectification
- `FIXME:` - need to do ASAP

> Please, use exactly `TODO:` and `FIXME:` prefix notation for correct [highlight](https://marketplace.visualstudio.com/items?itemName=wayou.vscode-todo-highlight).

### Tags

> TODO: add linter

"Tag" - is related to commit's types part of comment for feature improvements

- **`test/add`**: need to add tests
- **`doc/fix`**: need to fix documentation
- **`deps/del`**: need to delete legacy dependencies

#### Examples

- `// FIXME: type/add: prop-types`
- `// TODO: style/mod: replace by flex-box`

### Commit's naming

> TODO: add linter

```js
const commitMessage = `${featureName}.${subFeatureName}/${techType}/${changeType}: ${issueNumber} ${description}`;
```

#### Examples

- `auth/feat/add: #1 restore page`
- `auth.restore/style/fix: #2 mobile view`
- `auth/deps/mod: #3 replace redux by mobx`

#### Tech types

- **feat** - some user feature
- **logic** - business logic of user feature
- **style** - view (UI) of user feature
- **util** - utility functions and services
- **type** - types definition
- **test** - tests for functional
- **doc** - description and specification
- **example** - storybook, docz, etc
- **deps** - third party dependency changes (replaces, forks, API improves)
- **perf** - performance changes
- **pretty** - prettify formating, white-space, missing semi-colons, etc
- **config**: changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm), configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)

#### Change types

- **add** - new functional
- **mod** - modifying functional **with** behavior changes
- **fix** - correcting functional **without** behavior changes (refactor, iterface updates)
- **del** - delete functional

### Branch's naming

> TODO: add linter

> wait for https://github.com/isaacs/github/issues/1125

```js
const branchName = `i${issueNumber}/${shortDescription}`;
```

#### Examples

- `i1/auth`
- `i5/doc`
