import { action, atom } from '@reatom/core'

import type { Admin } from '../../index'
import type {
  CausePredicate,
  FilterKind,
  FilterPredicate,
  FilterTarget,
} from '../../types'
import {
  buttonBase,
  buttonGhost,
  card,
  colors,
  flex,
  flexWrap,
  gap,
  inputLike,
  p,
  panelTitle,
} from '../styles'

export interface PredicateBuilderProps {
  admin: Admin
}

const FILTER_TYPES: Array<FilterPredicate['type']> = [
  'text',
  'regex',
  'timeRange',
  'error',
  'cause',
  'session',
  'kind',
]

const FILTER_TARGETS: Array<FilterTarget> = ['name', 'state', 'params', 'payload']
const FILTER_KINDS: Array<FilterKind> = [
  'reactive',
  'action',
  'async',
  'reject',
  'fulfill',
]

function createPredicateId(): string {
  return `predicate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createDraftPredicate(type: FilterPredicate['type'] = 'text'): FilterPredicate {
  if (type === 'cause') {
    const causePredicate: CausePredicate = {
      id: createPredicateId(),
      type,
      value: '',
      direction: '>',
      referencePattern: '',
      target: 'name',
    }
    return causePredicate
  }

  if (type === 'timeRange') {
    return {
      id: createPredicateId(),
      type,
      value: [0, 0],
      target: 'name',
    }
  }

  if (type === 'error') {
    return {
      id: createPredicateId(),
      type,
      value: true,
      target: 'name',
    }
  }

  if (type === 'kind') {
    return {
      id: createPredicateId(),
      type,
      value: 'action',
      target: 'name',
    }
  }

  return {
    id: createPredicateId(),
    type,
    target: 'name',
    value: '',
  }
}

function isTimeRangeValue(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  )
}

function getTimeRangeValue(value: unknown): [number, number] {
  return isTimeRangeValue(value) ? value : [0, 0]
}

function isTargetValue(value: unknown): value is FilterTarget {
  return (
    value === 'name' ||
    value === 'state' ||
    value === 'params' ||
    value === 'payload'
  )
}

function isKindValue(value: unknown): value is FilterKind {
  return (
    value === 'reactive' ||
    value === 'action' ||
    value === 'async' ||
    value === 'reject' ||
    value === 'fulfill'
  )
}

function isCausePredicate(
  predicate: FilterPredicate,
): predicate is CausePredicate {
  return predicate.type === 'cause'
}

function getTextValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

// Module-scoped draft state — creating/writing atoms during render causes
// "Stuck in recursion" when the Filters route mounts.
const editingTagId = atom<string | null>(
  null,
  '_Admin.view.predicateBuilder.tagId',
)
const draftName = atom('', '_Admin.view.predicateBuilder.name')
const draftPredicates = atom<Array<FilterPredicate>>(
  [createDraftPredicate('text')],
  '_Admin.view.predicateBuilder.predicates',
)

const setDraft = action(
  (name: string, predicates: Array<FilterPredicate>, tagId?: string) => {
    editingTagId.set(tagId ?? null)
    draftName.set(name)
    draftPredicates.set(predicates.map((predicate) => ({ ...predicate })))
  },
  '_Admin.view.predicateBuilder.setDraft',
)

const resetDraft = action(() => {
  editingTagId.set(null)
  draftName.set('')
  draftPredicates.set([createDraftPredicate('text')])
}, '_Admin.view.predicateBuilder.resetDraft')

const updatePredicate = action(
  (
    predicateId: string,
    updater: (predicate: FilterPredicate) => FilterPredicate,
  ) => {
    draftPredicates.set(
      draftPredicates().map((predicate) =>
        predicate.id === predicateId ? updater(predicate) : predicate,
      ),
    )
  },
  '_Admin.view.predicateBuilder.updatePredicate',
)

export const PredicateBuilder = ({ admin }: PredicateBuilderProps) => {
  return (
    <section
      data-reatom-name="PredicateBuilder"
      css={`
        ${card}
        ${p(3)}
        display: grid;
        gap: 1rem;
      `}
    >
      <div
        css={`
          ${flex}
          ${gap(1)}
          ${flexWrap}
          justify-content: space-between;
          align-items: center;
        `}
      >
        <div>
          <h3
            css={`
              ${panelTitle}
            `}
          >
            Tag studio
          </h3>
          <p
            css={`
              margin: 0.35rem 0 0;
              color: ${colors.textMuted};
              font-size: 0.8rem;
              line-height: 1.5;
            `}
          >
            Build reusable tags from multiple predicates, then reference them in
            nested expressions.
          </p>
        </div>
        <button type="button" css={buttonGhost} on:click={() => resetDraft()}>
          New tag
        </button>
      </div>

      <div
        css={`
          ${flex}
          ${gap(1)}
          ${flexWrap}
        `}
      >
        {() =>
          admin.filters.tags.tags().map((tag) => (
            <button
              type="button"
              css={buttonGhost}
              on:click={() =>
                setDraft(
                  tag.name,
                  tag.predicates,
                  tag.builtIn ? undefined : tag.id,
                )
              }
            >
              {tag.name}
            </button>
          ))
        }
      </div>

      <label
        css={`
          display: grid;
          gap: 0.35rem;
          color: ${colors.textMuted};
          font-size: 0.76rem;
        `}
      >
        Tag name
        <input
          type="text"
          model:value={draftName}
          placeholder="Async errors in checkout flow"
          css={inputLike}
        />
      </label>

      <div
        css={`
          display: grid;
          gap: 0.85rem;
        `}
      >
        {() =>
          draftPredicates().map((predicate) => {
            const type = predicate.type
            const timeRange = getTimeRangeValue(predicate.value)
            const target = isTargetValue(predicate.target) ? predicate.target : 'name'
            const kind = isKindValue(predicate.value) ? predicate.value : 'action'
            const causePredicate = isCausePredicate(predicate) ? predicate : null

            return (
              <div
                css={`
                  ${card}
                  ${p(2)}
                  display: grid;
                  gap: 0.75rem;
                `}
              >
                <div
                  css={`
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
                    gap: 0.75rem;
                  `}
                >
                  <label
                    css={`
                      display: grid;
                      gap: 0.35rem;
                      color: ${colors.textMuted};
                      font-size: 0.74rem;
                    `}
                  >
                    Predicate type
                    <select
                      value={type}
                      on:change={(event: Event) => {
                        const target = event.currentTarget
                        if (!(target instanceof HTMLSelectElement)) return
                        const nextType =
                          FILTER_TYPES.find((value) => value === target.value) ??
                          'text'
                        updatePredicate(predicate.id, () =>
                          createDraftPredicate(nextType),
                        )
                      }}
                      css={inputLike}
                    >
                      {FILTER_TYPES.map((predicateType) => (
                        <option value={predicateType}>{predicateType}</option>
                      ))}
                    </select>
                  </label>

                  {(type === 'text' || type === 'regex') && (
                    <label
                      css={`
                        display: grid;
                        gap: 0.35rem;
                        color: ${colors.textMuted};
                        font-size: 0.74rem;
                      `}
                    >
                      Target
                      <select
                        value={target}
                        on:change={(event: Event) => {
                          const targetElement = event.currentTarget
                          if (!(targetElement instanceof HTMLSelectElement)) return
                          const nextTarget = isTargetValue(targetElement.value)
                            ? targetElement.value
                            : 'name'
                          updatePredicate(predicate.id, (currentPredicate) => ({
                            ...currentPredicate,
                            target: nextTarget,
                          }))
                        }}
                        css={inputLike}
                      >
                        {FILTER_TARGETS.map((targetOption) => (
                          <option value={targetOption}>{targetOption}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {(type === 'text' || type === 'regex' || type === 'session') && (
                    <label
                      css={`
                        display: grid;
                        gap: 0.35rem;
                        color: ${colors.textMuted};
                        font-size: 0.74rem;
                      `}
                    >
                      Value
                      <input
                        type="text"
                        value={getTextValue(predicate.value)}
                        on:input={(event: Event) => {
                          const targetElement = event.currentTarget
                          if (!(targetElement instanceof HTMLInputElement)) return
                          updatePredicate(predicate.id, (currentPredicate) => ({
                            ...currentPredicate,
                            value: targetElement.value,
                          }))
                        }}
                        css={inputLike}
                      />
                    </label>
                  )}

                  {type === 'kind' && (
                    <label
                      css={`
                        display: grid;
                        gap: 0.35rem;
                        color: ${colors.textMuted};
                        font-size: 0.74rem;
                      `}
                    >
                      Kind
                      <select
                        value={kind}
                        on:change={(event: Event) => {
                          const targetElement = event.currentTarget
                          if (!(targetElement instanceof HTMLSelectElement)) return
                          const nextKind = isKindValue(targetElement.value)
                            ? targetElement.value
                            : 'action'
                          updatePredicate(predicate.id, (currentPredicate) => ({
                            ...currentPredicate,
                            value: nextKind,
                          }))
                        }}
                        css={inputLike}
                      >
                        {FILTER_KINDS.map((kindOption) => (
                          <option value={kindOption}>{kindOption}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {type === 'timeRange' && (
                    <>
                      <label
                        css={`
                          display: grid;
                          gap: 0.35rem;
                          color: ${colors.textMuted};
                          font-size: 0.74rem;
                        `}
                      >
                        From
                        <input
                          type="number"
                          value={timeRange[0]}
                          on:input={(event: Event) => {
                            const targetElement = event.currentTarget
                            if (!(targetElement instanceof HTMLInputElement)) return
                            const nextValue = Number.parseInt(targetElement.value, 10)
                            if (Number.isNaN(nextValue)) return
                            updatePredicate(predicate.id, (currentPredicate) => ({
                              ...currentPredicate,
                              value: [nextValue, getTimeRangeValue(currentPredicate.value)[1]],
                            }))
                          }}
                          css={inputLike}
                        />
                      </label>
                      <label
                        css={`
                          display: grid;
                          gap: 0.35rem;
                          color: ${colors.textMuted};
                          font-size: 0.74rem;
                        `}
                      >
                        To
                        <input
                          type="number"
                          value={timeRange[1]}
                          on:input={(event: Event) => {
                            const targetElement = event.currentTarget
                            if (!(targetElement instanceof HTMLInputElement)) return
                            const nextValue = Number.parseInt(targetElement.value, 10)
                            if (Number.isNaN(nextValue)) return
                            updatePredicate(predicate.id, (currentPredicate) => ({
                              ...currentPredicate,
                              value: [getTimeRangeValue(currentPredicate.value)[0], nextValue],
                            }))
                          }}
                          css={inputLike}
                        />
                      </label>
                    </>
                  )}

                  {type === 'cause' && (
                    <>
                      <label
                        css={`
                          display: grid;
                          gap: 0.35rem;
                          color: ${colors.textMuted};
                          font-size: 0.74rem;
                        `}
                      >
                        Direction
                        <select
                          value={causePredicate?.direction ?? '>'}
                          on:change={(event: Event) => {
                            const targetElement = event.currentTarget
                            if (!(targetElement instanceof HTMLSelectElement)) return
                            const nextDirection = targetElement.value === '<' ? '<' : '>'
                            updatePredicate(predicate.id, (currentPredicate) => ({
                              ...currentPredicate,
                              ...(isCausePredicate(currentPredicate)
                                ? { direction: nextDirection }
                                : {}),
                            }))
                          }}
                          css={inputLike}
                        >
                          <option value=">">caused by</option>
                          <option value="<">caused</option>
                        </select>
                      </label>
                      <label
                        css={`
                          display: grid;
                          gap: 0.35rem;
                          color: ${colors.textMuted};
                          font-size: 0.74rem;
                        `}
                      >
                        Reference pattern
                        <input
                          type="text"
                          value={causePredicate?.referencePattern ?? ''}
                          on:input={(event: Event) => {
                            const targetElement = event.currentTarget
                            if (!(targetElement instanceof HTMLInputElement)) return
                            updatePredicate(predicate.id, (currentPredicate) => {
                              if (!isCausePredicate(currentPredicate)) {
                                return currentPredicate
                              }

                              return {
                                ...currentPredicate,
                                referencePattern: targetElement.value,
                                value: targetElement.value,
                              }
                            })
                          }}
                          css={inputLike}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div
                  css={`
                    ${flex}
                    ${gap(1)}
                    ${flexWrap}
                  `}
                >
                  <button
                    type="button"
                    css={buttonGhost}
                    on:click={() =>
                      draftPredicates.set(
                        draftPredicates().filter(
                          (currentPredicate) => currentPredicate.id !== predicate.id,
                        ),
                      )
                    }
                  >
                    Remove predicate
                  </button>
                </div>
              </div>
            )
          })
        }
      </div>

      <div
        css={`
          ${flex}
          ${gap(1)}
          ${flexWrap}
        `}
      >
        <button
          type="button"
          css={buttonGhost}
          on:click={() =>
            draftPredicates.set([...draftPredicates(), createDraftPredicate('text')])
          }
        >
          Add text predicate
        </button>
        <button
          type="button"
          css={buttonGhost}
          on:click={() =>
            draftPredicates.set([...draftPredicates(), createDraftPredicate('kind')])
          }
        >
          Add kind predicate
        </button>
        <button
          type="button"
          css={buttonGhost}
          on:click={() =>
            draftPredicates.set([...draftPredicates(), createDraftPredicate('cause')])
          }
        >
          Add cause predicate
        </button>
      </div>

      <div
        css={`
          ${flex}
          ${gap(1)}
          ${flexWrap}
          justify-content: space-between;
        `}
      >
        <div
          css={`
            color: ${colors.textSubtle};
            font-size: 0.74rem;
          `}
        >
          {() =>
            editingTagId()
              ? 'Updating existing tag'
              : 'Creating a new custom tag'
          }
        </div>
        <div
          css={`
            ${flex}
            ${gap(1)}
            ${flexWrap}
          `}
        >
          <button type="button" css={buttonGhost} on:click={() => resetDraft()}>
            Reset
          </button>
          <button
            type="button"
            css={buttonBase}
            on:click={() => {
              const name = draftName().trim()
              if (!name) return

              const predicates = draftPredicates()
              const tagId = editingTagId()
              if (tagId) {
                admin.filters.tags.updateTag(tagId, { name, predicates })
              } else {
                admin.filters.tags.createTag(name, predicates)
              }
              resetDraft()
            }}
          >
            {() => (editingTagId() ? 'Save tag' : 'Create tag')}
          </button>
        </div>
      </div>
    </section>
  )
}
