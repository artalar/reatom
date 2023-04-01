import { action, Action, Atom, atom, AtomMut, Ctx, Fn, __count } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { RecordAtom, reatomRecord } from '@reatom/primitives'
import { isShallowEqual } from '@reatom/utils'

export type FieldFocus = {
  active: boolean
  dirty: boolean
  touched: boolean
}

export type FieldValidation = {
  error: undefined | string
  valid: boolean
  validating: boolean
}

export type FieldActions<State = any, Value = State> = {
  blur: Action
  change: Action<[State], State>
  focus: Action
  reset: Action
  validate: Action<[], FieldValidation> & {
    enforce: (ctx: Ctx) => Value
  }
}

export type FieldAtom<State = any, Value = State> = AtomMut<State> &
  FieldActions<State, Value> & {
    focusAtom: Atom<FieldFocus>
    initState: State
    validationAtom: RecordAtom<FieldValidation>
  }

export type FieldOptions<State = any, Value = State> = {
  filter?: Fn<[Ctx, State], boolean>
  initState: State
  name?: string
  validate?: Fn<
    [Ctx, { state: State; focus: FieldFocus; validation: FieldValidation }],
    Value | Promise<Value>
  >
  validationTrigger?: 'change' | 'blur' | 'submit'
}

export const fieldInitFocus: FieldFocus = {
  active: false,
  dirty: false,
  touched: false,
}

export const fieldInitValidation: FieldValidation = {
  error: undefined,
  valid: true,
  validating: false,
}

export const reatomField: {
  <State, Value = State>(options: FieldOptions<State, Value>): FieldAtom<
    State,
    Value
  >
} = ({
  filter = () => true,
  initState,
  name = __count(`${typeof initState}Field`),
  validate: validateFn,
  validationTrigger = 'blur',
}) => {
  const dataAtom = atom(initState, `${name}.dataAtom`)
  const focusAtom = reatomRecord(fieldInitFocus, name?.concat('.focusAtom'))
  const validationAtom = reatomRecord(
    fieldInitValidation,
    name?.concat('.validationAtom'),
  )

  // @ts-expect-error
  const validate: FieldActions['validate'] = action((ctx) => {
    let validation = ctx.get(validationAtom)

    if (validateFn !== undefined) {
      const state = ctx.get(dataAtom)
      const focus = ctx.get(focusAtom)

      try {
        var promise = validateFn(ctx, { state, focus, validation })
      } catch (error) {
        var { message } = error as Error
      }

      if (promise! instanceof Promise) {
        validation = validationAtom.merge(ctx, { validating: true })

        promise.then(
          () =>
            state === ctx.get(dataAtom) &&
            validationAtom.merge(ctx, {
              error: undefined,
              valid: true,
              validating: false,
            }),
          (error) => {
            if (error instanceof Error) ({ message } = error)
            if (state === ctx.get(dataAtom)) {
              validationAtom.merge(ctx, {
                validating: false,
                error: message,
                valid: !message,
              })
            }
          },
        )
      } else {
        validation = validationAtom.merge(ctx, {
          validating: false,
          error: message!,
          valid: !message!,
        })
      }
    }

    return validation
  }, name?.concat('.validate'))
  validate.enforce = (ctx) => {
    validate(ctx)
    const validation = ctx.get(validationAtom)
    // TODO promise??
    if (validation.validating) throw new Promise(() => {})
    if (!validation.valid) throw new Error(validation.error)
    return ctx.get(dataAtom)
  }

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
    focusAtom.merge(ctx, { touched: true, dirty: true })

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
  // TODO
  // isSubmittedAtom: Atom<boolean>
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

    return isShallowEqual(formValid, fieldInitValidation)
      ? fieldInitValidation
      : formValid
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

    onConnect(atomField, (ctx) => {
      fieldsListAtom(ctx, (state) => [...state, atomField])
      return () =>
        fieldsListAtom(ctx, (state) =>
          state.filter((anAtom) => anAtom !== atomField),
        )
    })

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
