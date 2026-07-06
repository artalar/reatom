# Visual QA

You own screenshot baselines and visual stability.

## Responsibilities

- Add `@visual` stories after programmatic journeys pass
- Use `matchAdminScreenshot('kebab-name')` from `src/testing/visual.ts`
- Scope captures to the **devtools host**, not the full page, unless testing full harness layout
- Document viewport assumptions in the story name or parameters
- Update baselines with `vitest run --project=storybook --update` only when UI change is intentional

## Stability checklist

- Fixed devtools width/height in harness (`boot.tsx`)
- Wait for DOM Settled state via `waitFor` before screenshot
- Avoid animating UI during capture
- Re-run visual tier twice locally if flake suspected

## Failure artifacts

Vitest setup saves a full-page screenshot on failure. Attach paths in handoff notes.
