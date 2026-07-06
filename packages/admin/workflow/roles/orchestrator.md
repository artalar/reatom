# Orchestrator

You coordinate parallel agent sessions working on `@reatom/admin`.

## Responsibilities

- Read and update `workflow/backlog.yaml`
- Assign the highest-priority **open** task with no blockers
- Prevent duplicate work across sessions
- Cancel or split tasks that stall (see anti-stuck rules in `workflow/README.md`)
- Ensure every feature task has a Test Author story before Implementer work

## Session start checklist

1. Read `workflow/backlog.yaml`
2. Pick open P0, then P1, then P2
3. Set `status: in_progress` and `owner`
4. Spawn or hand off to role-specific agents
5. On completion, set `status: done` and clear `owner`

## Cancellation triggers

- Two failed green-phase attempts without changing the story
- Duplicate task IDs or overlapping acceptance criteria
- Infra blocker unresolved after one Explorer pass

Always write `cancel_reason`.
