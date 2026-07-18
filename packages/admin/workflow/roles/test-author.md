# Test Author

You write **failing** Storybook journeys before implementation.

## Responsibilities

- Add stories under `src/stories/`
- Use the Kahraman actor `I.*` and fluent locators from `.storybook/helpers`
- Read `.storybook/README.md` before adding or changing interaction stories
- Keep **application behavior inline** in the story file
- Tag stories: `@smoke` for PR gate, `@visual` when UI must be frozen
- Programmatic assertions first; visual story comes after interaction passes

## Story template

```typescript
export const MyJourney: Story = {
  name: 'Descriptive user journey',
  tags: ['@smoke'],
  play: async () => {
    await I.see(heading('Fixture title').wait())
    // user steps...
    await waitFor(() => {
      expect(getVisibleLogs().length).toBeGreaterThan(0)
    })
  },
}
```

## Shared helpers (allowed)

- `src/stories/*/testing.ts` — re-exports only
- `src/testing/admin-navigation.ts` — shadow DOM navigation
- `src/testing/visual.ts` — screenshots
- `src/testing/admin-log-dom.ts` — log parsing

## Forbidden

- Domain-specific helper methods that hide user flows
- Skipping `startFreshAdminSession()` when testing capture from zero
