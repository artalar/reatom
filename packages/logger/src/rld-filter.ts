import { Action, Atom, AtomMaybe, Ctx, action, atom } from '@reatom/core'
import { h } from '@reatom/jsx'
import styled from 'stylerun'
import * as model from './rld-filter-model'
import { t } from './t'
import { match } from '@reatom/lens'
import { buttonStyles } from './rld'

export function RldFilterMenu() {
  return atom((ctx) =>
    t.div({
      ...menuStyles({}),
      children: [
        RldFilterMenuDraft(),
        match(ctx.get(model.filters).length, t.div(draftHrStyles({}))),
        ...ctx.spy(model.filters).map((filter) =>
          FilterView({
            persist: atom((ctx) =>
              ctx.spy(model.filtersLocal).includes(filter),
            ),
            setPersist: action((ctx, next) =>
              model.filterPersistSet(ctx, filter, next),
            ),
            action: filter.action,
            setAction: filter.action,
            code: filter.code,
            setCode: filter.code,
            buttonLabel: 'remove',
            buttonClicked: action((ctx) => model.filterSplice(ctx, filter)),
          }),
        ),
      ],
    }),
  )
}

function RldFilterMenuDraft() {
  return FilterView({
    action: model.draftAction,
    setAction: model.draftAction,
    code: model.draftCode,
    setCode: model.draftCode,
    persist: model.draftPersist,
    setPersist: model.draftPersist,
    buttonLabel: 'create',
    buttonClicked: model.draftCreate,
  })
}

function FilterView({
  persist,
  setPersist,
  action: actionAtom,
  setAction,
  code,
  setCode,
  buttonLabel,
  buttonClicked,
}: {
  persist: AtomMaybe<boolean>
  setPersist: (ctx: Ctx, next: boolean) => void
  action: Atom<model.FilterAction>
  setAction: (ctx: Ctx, next: model.FilterAction) => void
  code: AtomMaybe<string>
  setCode: (ctx: Ctx, next: string) => void
  buttonLabel: string
  buttonClicked: (ctx: Ctx) => void
}) {
  return h('div', listItemStyles({}), [
    t.input({
      ...filterPersistStyles({}),
      type: 'checkbox',
      title: 'Persist filter?',
      checked: persist,
      oninput: action((ctx, event) =>
        setPersist(ctx, event.target.checked),
      ) as any,
    }),
    FilterActionView({
      value: actionAtom,
      setValue: action((ctx, action) => setAction(ctx, action)),
    }),
    t.input({
      ...filterCodeStyles({}),
      type: 'string',
      placeholder: 'filter code',
      value: code,
      size: 50,
      // FIXME types
      oninput: action((ctx, event) => setCode(ctx, event.target.value)) as any,
    }),
    t.button({
      ...buttonStyles({}),
      onclick: action((ctx) => buttonClicked(ctx)),
      children: [buttonLabel],
    }),
  ])
}

function FilterActionView({
  value,
  setValue,
}: {
  value: Atom<model.FilterAction>
  setValue: (ctx: Ctx, action: model.FilterAction) => void
}) {
  return t.select({
    ...buttonStyles({}),
    value,
    onchange: action((ctx, event) =>
      setValue(ctx, event.target.value as model.FilterAction),
    ) as any,
    children: model.FilterActions.map((action) =>
      t.option({
        value: action,
        selected: atom((ctx) => ctx.spy(value) === action),
        children: [action],
      }),
    ),
  })
}

const menuStyles = styled('')`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const draftHrStyles = styled('')`
  width: 100%;
  border-bottom: 1px solid #c5c6de88;
  margin: 0.25rem 0;
`

const listItemStyles = styled('')`
  display: flex;
  gap: 0.25rem;
`

const filterPersistStyles = styled('')``

const filterCodeStyles = styled('')`
  font: var(--mono_fonts);
`

const filterActionStyles = styled('')``

const filterButtonStyles = styled('')``
