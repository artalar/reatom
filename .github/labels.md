# Labels used in repository

Labels are divided in three main categories (label count assignable for one issue/PR):
1. Type (exactly one) -- used to mark issues type
2. Part (at most one) -- used to mark affected project component
3. Meta (any number) -- are used by bots and other functionality

## Type labels
Type labels are prefixed with `T -` and have the following meaning:
- `T - Defect` -- Things are not working in a way they are *meant* to be working. They way they should work are either defined by tests, documentation, reference implementation (for adapter packages), the system design, or common sense. Part label is **mandatory** with this label.
- `T - Proposal` -- Entirely new functionality, package or design approach. Part label **may be skipped**.  
- `T - Enhancement` -- There's a way to make something work in a better way in existing functionality. Improvement of usability, new feature. Part label is **mandatory** with this label.
- `T - Task` -- Some work to do to proceed with other tasks. General for refactoring or chores like releases.

## Part labels
Part labels are prefixed with `P -` and are associated primarily with packages.

Every package published in npm and located in `packages/<package-name>` should have corresponding `P - <package-name>` label.

Special parts are: 
- `P - CI` -- CI and repository automation
- `P - Tools` -- Tools used by developers, such as eslint, publishing scripts, etc.
- `P - Docs` -- Documentation website

## Meta labels
- `Hacktoberfest`, `hacktoberfest-accepted` are used to attend [Hacktoberfest](https://hacktoberfest.com/).
- `duplicate` is used to mark issues and pull requests that already exist
- `good first issue` is used to mark issues that can be solved by newcommers and are shown at [/contribute](https://github.com/artalar/reatom/contribute) page
- `dependencies` is used by [Dependabot](https://github.com/apps/dependabot)
- `wontfix` this will not be worked on
- `need info` description is partial and describe only the topic 
