import {
  Action,
  Atom,
  AtomMaybe,
  Ctx,
  action,
  atom,
  isAtom,
} from '@reatom/core'
import { ctx, h } from '@reatom/jsx'
import styled from 'stylerun'
import * as model from './devtools-filters-model'
import { t } from './t'
import { match } from '@reatom/lens'
import { buttonStyles } from './devtools-button'
import { onConnect } from '@reatom/hooks'
import { DevtoolsIconDelete, DevtoolsIconPlus } from './devtools-icon'

export const DevtoolsFilters = () => {
  return atom((ctx) =>
    t.div({
      ...filtersStyles({}),
      children: [
        FilterMenuDraft(),
        match((ctx) => ctx.spy(model.filters).length).truthy(
          t.div(draftHrStyles({})),
        ),
        ...ctx.spy(model.filters).map((filter) => {
          return FilterView({
            checked: filter.enabled,
            setChecked: filter.enabled,
            checkedLabel: 'Filter enabled?',
            action: filter.action,
            setAction: filter.action,
            code: filter.code,
            setCode: filter.code,
            buttonChildren: DevtoolsIconDelete(),
            buttonClicked: action((ctx) => model.filterSplice(ctx, filter)),
          })
        }),
      ],
    }),
  )
}

const FilterMenuDraft = () => {
  return FilterView({
    checkedIndeterminate: model.filtersEnabledIndeterminate,
    action: model.draftAction,
    setAction: model.draftAction,
    code: model.draftCode,
    setCode: model.draftCode,
    checked: model.filtersEnabledGet,
    setChecked: model.filtersEnabledSet,
    checkedLabel: 'Filters enabled?',
    buttonChildren: DevtoolsIconPlus(),
    buttonClicked: model.draftCreate,
  })
}

const FilterView = ({
  checkedIndeterminate,
  checked,
  setChecked,
  checkedLabel,
  action: actionAtom,
  setAction,
  code,
  setCode,
  buttonChildren,
  buttonClicked,
}: {
  checkedIndeterminate?: Atom<boolean>
  checked: AtomMaybe<boolean>
  setChecked: (ctx: Ctx, next: boolean) => void
  checkedLabel: string
  action: Atom<model.FilterAction>
  setAction: (ctx: Ctx, next: model.FilterAction) => void
  code: AtomMaybe<string>
  setCode: (ctx: Ctx, next: string) => void
  buttonChildren: Element
  buttonClicked: (ctx: Ctx) => void
}) => {
  const input = t.input({
    ...filterEnabledStyles({}),
    type: 'checkbox',
    checked: checked,
    title: checkedLabel,
    oninput: action((ctx, event) =>
      setChecked(ctx, event.target.checked),
    ) as any,
  }) as HTMLInputElement

  const viewAtom = atom((ctx) =>
    h('div', listItemStyles({}), [
      input,
      FilterActionView({
        value: actionAtom,
        setValue: action((ctx, action) => setAction(ctx, action)),
      }),
      t.input({
        ...filterCodeStyles({}),
        type: 'string',
        placeholder: 'filter code',
        value: code,
        min: 1,
        minLength: 1,
        size: 50,
        // FIXME types
        oninput: action((ctx, event) =>
          setCode(ctx, event.target.value),
        ) as any,
      }),
      t.button({
        ...buttonStyles({}),
        onclick: action((ctx) => buttonClicked(ctx)),
        children: [buttonChildren],
      }),
    ]),
  )

  if (checkedIndeterminate) {
    onConnect(viewAtom, (ctx) => {
      return ctx.subscribe(checkedIndeterminate, (state) => {
        input.indeterminate = state
      })
    })
  }

  return viewAtom
}

const FilterActionView = ({
  value,
  setValue,
}: {
  value: Atom<model.FilterAction>
  setValue: (ctx: Ctx, action: model.FilterAction) => void
}) => {
  return t.select({
    ...buttonStyles({}),
    title: 'Filter action',
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

const filtersStyles = styled('')`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const draftHrStyles = styled('')`
  width: 100%;
  border-bottom: 1px solid #c5c6de88;
  margin: 2px 0;
`

const listItemStyles = styled('')`
  display: flex;
  gap: 4px;
`

const filterEnabledStyles = styled('')``

const filterCodeStyles = styled('')`
  font: var(--mono_fonts);
  width: 100%;
`
