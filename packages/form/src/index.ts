import {
  action,
  Action,
  Atom,
  atom,
  AtomMut,
  Ctx,
  Fn,
} from '@reatom/core'
import { RecordAtom, reatomRecord } from '@reatom/primitives'

export type FieldFocus = {
  active: boolean
  touched: boolean
}

export type FieldValidation = {
  error: undefined | string
  valid: boolean
  validating: boolean
}

export type FieldActions<State = any> = {
  blur: Action
  change: Action<[State], State>
  focus: Action
  reset: Action
  validate: Action<[], FieldValidation>
}

export type FieldAtom<State = any> = AtomMut<State> &
  FieldActions<State> & {
    focusAtom: Atom<FieldFocus>
    initState: State
    validationAtom: RecordAtom<FieldValidation>
  }

export type FieldOptions<State = any> = {
  filter?: Fn<[Ctx, State], boolean>
  initState: State
  name?: string
  validate?: Fn<
    [Ctx, { state: State; focus: FieldFocus; validation: FieldValidation }],
    undefined | string | Promise<undefined | string>
  >
  validationTrigger?: 'change' | 'blur' | 'submit'
}

export const fieldInitFocus: FieldFocus = {
  active: false,
  touched: false,
}

export const fieldInitValidation: FieldValidation = {
  error: undefined,
  valid: true,
  validating: false,
}

export const reatomField: {
  <State>(options: FieldOptions<State>): FieldAtom<State>
} = ({
  filter = () => true,
  initState,
  name,
  validate: validateFn,
  validationTrigger = 'blur',
}) => {
  const dataAtom = atom(initState, name?.concat('.dataAtom'))
  const focusAtom = reatomRecord(fieldInitFocus, name?.concat('.focusAtom'))
  const validationAtom = reatomRecord(
    fieldInitValidation,
    name?.concat('.validationAtom'),
  )

  const validate = action((ctx) => {
    let validation = ctx.get(validationAtom)

    if (validateFn !== undefined) {
      const state = ctx.get(dataAtom)
      const focus = ctx.get(focusAtom)
      const err = validateFn(ctx, { state, focus, validation })

      if (err instanceof Promise) {
        validation = validationAtom.merge(ctx, { validating: true })

        err.then(
          (error) =>
            state === ctx.get(dataAtom) &&
            validationAtom.merge(ctx, {
              error,
              valid: !error,
              validating: false,
            }),
          () =>
            state === ctx.get(dataAtom) &&
            validationAtom.merge(ctx, { validating: false }),
        )
      } else {
        validation = validationAtom.merge(ctx, {
          validating: false,
          error: err,
          valid: !err,
        })
      }
    }

    return validation
  }, name?.concat('.validate'))

  const focus = action((ctx) => {
    focusAtom.merge(ctx, { active: true, touched: true })
  }, name?.concat('.focus'))

  const blur = action((ctx) => {
    focusAtom.merge(ctx, { active: false })
    if (validationTrigger === 'blur') validate(ctx)
  }, name?.concat('.blur'))

  const change = action((ctx, input) => {
    if (!filter(ctx, input)) return ctx.get(dataAtom)

    const state = dataAtom(ctx, input)
    focusAtom.merge(ctx, { touched: true })

    if (validationTrigger === 'change') validate(ctx)

    return state
  }, name?.concat('.change'))

  const reset = action((ctx) => {
    dataAtom(ctx, initState)
    focusAtom(ctx, fieldInitFocus)
    validationAtom(ctx, fieldInitValidation)
  }, name?.concat('.reset'))

  return Object.assign(dataAtom, {
    blur,
    change,
    focus,
    focusAtom,
    initState,
    reset,
    validate,
    validationAtom,
  })
}

export type FormOptions = {
  name?: string
  onSubmit: Fn<[Ctx, Form]>
  onSubmitError?: Fn<[Ctx]>
}

export type Form = {
  fieldsListAtom: Atom<Array<FieldAtom>>
  onSubmit: Action
  reatomField: typeof reatomField
  reset: Action
  validationAtom: Atom<FieldValidation>
}

export const reatomForm = ({
  name,
  onSubmit,
  onSubmitError,
}: FormOptions): Form => {
  const fieldsListAtom = atom<Array<FieldAtom>>(
    [],
    name?.concat('.fieldsListAtom'),
  )
  const validationAtom = atom((ctx) => {
    const formValid = { ...fieldInitValidation }
    for (const fieldAtom of ctx.spy(fieldsListAtom)) {
      const { valid, validating, error } = ctx.spy(fieldAtom.validationAtom)
      formValid.valid &&= valid
      formValid.validating ||= validating
      formValid.error ||= error
    }

    // TODO replace by isEqual
    if (
      formValid.valid === fieldInitValidation.valid &&
      formValid.validating === fieldInitValidation.validating &&
      formValid.error === fieldInitValidation.error
    ) {
      return fieldInitValidation
    }

    return formValid
  }, name?.concat('.validationAtom'))

  const reset = action(
    (ctx) =>
      ctx.get(fieldsListAtom).forEach((fieldAtom) => fieldAtom.reset(ctx)),
    name?.concat('.reset'),
  )

  const handleSubmit = action((ctx) => {
    // FIXME `validationTrigger === 'blur'`
    for (const fieldAtom of ctx.get(fieldsListAtom)) {
      fieldAtom.validate(ctx)
    }
    const { valid, validating } = ctx.get(validationAtom)
    if (valid && !validating) onSubmit(ctx, form)
    else onSubmitError?.(ctx)
  }, name?.concat('.onSubmit'))

  const reatomFieldForm: typeof reatomField = (options) => {
    // TODO ?
    // if (name && options.name) options.name = `${name}[${options.name}]

    const atomField = reatomField(options)

    // TODO onConnect, onDisconnect
    const connectHooks = (atomField.__reatom.connectHooks ??= new Set())
    const disconnectHooks = (atomField.__reatom.disconnectHooks ??= new Set())

    connectHooks.add((ctx) =>
      fieldsListAtom(ctx, (state) => [...state, atomField]),
    )
    disconnectHooks.add((ctx) =>
      fieldsListAtom(ctx, (state) =>
        state.filter((anAtom) => anAtom !== atomField),
      ),
    )

    return atomField
  }

  const form = {
    fieldsListAtom,
    onSubmit: handleSubmit,
    reatomField: reatomFieldForm,
    reset,
    validationAtom,
  }

  return form
}
