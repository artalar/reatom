# Storybook interaction testing with Kahraman

`@reatom/admin` follows
[Kahraman's recommended Storybook testing style](https://github.com/apphane-dev/kahraman):
stories are executable user journeys, accessible actor/locator assertions are
the default, and asynchronous tests stabilize on observable UI lifecycle
signals.

This document is the complete project-local guide for writing and reviewing
Admin stories. It inlines the relevant Kahraman style and adds the conventions
specific to this repository.

## Core approach

A story supplies a reproducible application state. Its test documents what a
user can perceive and do in that state.

- Before editing, read a nearby story plus its `boot.tsx` and `testing.ts`;
  preserve that story family's CSF shape and fixture lifecycle.
- Put browser interaction journeys in stories and keep pure model behavior in
  unit tests.
- Prefer a small number of clear scenarios over one test that branches through
  unrelated states.
- Name tests after user-visible outcomes, not implementation details.
- Keep steps in causal order: act, wait for the visible transition, then assert
  the result.
- Prefer programmatic assertions. A screenshot freezes an already-verified
  state; it does not replace behavior checks.
- Tag PR-gating journeys with `@smoke` and intentional screenshot contracts with
  `@visual`.
- Keep application workflows inline in the story so a reader can understand the
  scenario without opening helper files.

## Project actor contract

Import the actor and locators from the project adapter:

```ts
import {
  button,
  createActor,
  heading,
  link,
  role,
  text,
} from '../../../.storybook/helpers'
```

Create one actor per story module, or reuse the actor exported by that story
family's shared journey module:

```ts
const I = createActor()
```

Initialize it from Storybook's `beforeEach` context:

```ts
const meta = preview.meta({
  title: 'Integration/Feature',
  component: App,
  beforeEach: (context) => void I.init(context),
})
```

Every actor call must happen after `I.init(context)`. Initialization binds the
story canvas and `userEvent` and resets Kahraman's step trace.

The adapter applies a 500 ms click delay during manual Storybook playback and no
delay under WebDriver. Stories should not add their own interaction sleeps.

## Address the UI as a user would

Prefer roles, accessible names, and visible text:

```ts
await I.see(heading('Counter demo').wait())
await I.click(button('Increment'))
await I.see(text('Count: 1'))
```

Use:

- `heading(name)` for headings;
- `button(name)` and `link(name)` for controls and navigation;
- `role(role, name?)` for other semantic elements;
- `text(value)` for genuinely non-semantic visible content.

Do not use CSS selectors, test IDs, DOM traversal, or raw text-content matching
when a role and accessible name express the intent. Low-level DOM access is
reserved for boundaries the actor cannot address, such as the Admin shadow root,
geometry, browser history, screenshot hosts, and external panels.

### Locator modifiers

Modifiers return a new locator:

```ts
heading('Activity').wait() // wait for entry
button('Delete').maybe() // optional nullable lookup
role('row').all() // collection
text('Details').within(role('main')) // one scoped query
role('heading').options({ level: 2 }) // Testing Library options
```

Use them deliberately:

- `.wait()` waits for an element that will appear.
- `.maybe()` is for truly optional UI that may need an action, such as a
  one-time overlay. Do not use it to hide a missing required element.
- `.all()` resolves a collection.
- `.within(container)` limits one query to a locator, captured `HTMLElement`, or
  `'global'`.
- `.options(...)` supplies Testing Library query options.

### Scoping

Scope assertions to the feature region so global Admin chrome, fixture UI, and
toasts cannot produce false matches:

```ts
await I.within(role('main'), async () => {
  await I.click(link('Timeline'))
  await I.waitExit(role('status'))
  await I.see(heading('Timeline'))
})
```

`I.scope` is an alias of `I.within`. Use locator `.within(...)` when only one
query needs the scope. Use `'global'` for portal-rendered content attached to
`document.body`.

When a stable panel swaps between states, capture it once and assert both sides
of the transition:

```ts
const panel = await I.see(role('main'))
await I.see(text('Select a frame').within(panel))
await I.dontSee(heading('Frame details').within(panel))

await I.click(button('Inspect frame'))
await I.dontSee(text('Select a frame').within(panel))
await I.see(heading('Frame details').within(panel))
```

## Actor methods used in stories

Common assertions and interactions:

```ts
await I.see(locator)
await I.dontSee(locator)
await I.waitExit(locator)
await I.seeInField(locator, value)
await I.seeChecked(locator)
await I.seeDisabled(locator)
await I.seeAttribute(locator, 'aria-current', 'page')
await I.seeNumberOfElements(locator.all(), 3)

await I.click(locator)
await I.fill(locator, 'value')
await I.clear(locator)
await I.selectOption(locator, 'Option')
await I.press('{Enter}')
```

Extraction methods include `grabTextFrom`, `grabTextFromAll`, and
`grabValueFrom`. `tryTo` is for optional actions, `retryTo` for documented
eventual transitions with no better lifecycle signal, and `hopeThat` for soft
assertions that are concluded with `I.hopeThat.noErrors()`.

When an actor call fails, Kahraman reports the actor step trace and points the
stack at the story or helper call site. Set `VITE_TEST_STEPS=true` when live step
logging helps diagnose a journey.

## Stabilize on observable lifecycle signals

Do not add arbitrary sleeps. Wait for visible state transitions:

```ts
await I.click(button('Load details'))
await I.waitExit(role('status', 'Loading details'))
await I.see(heading('Details'))
```

Use `.wait()` when waiting for a specific element to enter is the clearest
signal:

```ts
await I.see(role('alert', 'Connection lost').wait())
```

Use `I.retryTo` only when the UI has a documented eventual transition with no
better observable lifecycle signal. Add a comment explaining why retrying is
necessary; retries must not conceal broken synchronization.

A persistent-loading story intentionally keeps its request pending. Assert the
named loading UI and do not call a broad `waitExit(role('status'))`. If another
parent guard also loads, wait only for that named parent status.

## Model meaningful states with stories

Use separate stories for meaningful reproducible states instead of branching
inside one test. Existing MSW handlers provide deterministic success, error, and
persistent-loading behavior. Override only the handler relevant to the story:

```ts
export const GithubStarsFetchFailure: Story = {
  loaders: [mswLoader],
  parameters: {
    msw: { handlers: { githubStars: githubStars.error } },
  },
  play: async () => {
    await waitForXoHarnessReady()
    await refreshGithubStarsRequest().catch(() => undefined)
    await waitFor(() => expect(getAdminText()).toContain('1 error'))
  },
}
```

Do not create a mandatory success/error/loading/mobile matrix. Add a state or
viewport variant only when it proves distinct behavior worth preserving.

For responsive stories, use the viewport names and global shape already defined
in `.storybook/viewports.ts`. The preview applies the selected viewport to the
real browser test page. Reuse related story parameters so request and fixture
configuration cannot drift.

## Keep journeys readable

Write the user-visible workflow directly:

```ts
play: async () => {
  await waitForAdminHarnessReady()
  await I.see(heading('Counter demo').wait())
  await startFreshAdminSession()

  await I.click(button('Increment'))
  await I.click(button('Increment'))

  await waitFor(() => {
    expect(getVisibleLogs().some((item) => item.name === 'count')).toBe(true)
  })

  await searchAdminLogs('count')
}
```

Direct `storybook/test` assertions and browser APIs are appropriate for behavior
outside the actor's semantic DOM scope: Admin shadow-root content, browser
history, geometry, keyboard focus, and screenshots. Keep that code local and
use `waitFor` around its observable condition.

Shared helpers are limited to system mechanics:

- `src/testing/admin-navigation.ts` — Admin shadow-DOM navigation;
- `src/testing/admin-log-dom.ts` — log extraction and parsing;
- `src/testing/visual.ts` — screenshot assertions;
- story-family `testing.ts` files — fixture lifecycle and low-level controls.

Do not hide domain workflows in helpers such as `playWinningGame()`,
`assertGalleryCuration()`, or `reproduceRollbackFlow()`. Start a fresh Admin
session when a journey must prove capture from zero rather than inheriting
activity from story boot.

## Visual assertions

Reach and verify the intended state programmatically before taking a screenshot.
Use the existing screenshot helper and naming convention. Do not accept newly
generated platform baselines without reviewing them.

Treat a missing local platform baseline separately from an interaction failure:
a journey that reaches its screenshot assertion has validated a different layer
than a journey that fails during actor steps.

## Review checklist

- The actor is initialized in `beforeEach` and follows the nearby story-family
  structure.
- The test name describes a user-visible outcome.
- Steps appear in causal order and domain behavior remains visible in the story.
- Locators use roles and accessible names; scopes prevent accidental global
  matches.
- Async assertions wait on visible lifecycle state rather than timeouts.
- Optional UI uses `.maybe()` intentionally; required UI fails loudly.
- MSW overrides are narrow and distinct stories represent meaningful states.
- Responsive and visual variants exist because they protect useful behavior,
  not to fill a matrix.
- Raw DOM/browser code is limited to boundaries outside the actor's scope.
- Programmatic assertions establish state before screenshot assertions.
- Test-generated screenshots and unrelated editor files are absent from the
  final diff.

## Commands

```sh
pnpm --filter @reatom/admin test:unit
pnpm --filter @reatom/admin test:stories
pnpm --filter @reatom/admin test:stories:watch
pnpm --filter @reatom/admin storybook
```

Use Vitest's `-t` option for a local test-name filter. `--grep` is not supported
by the current Vitest CLI.
