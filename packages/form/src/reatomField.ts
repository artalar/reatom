import { action, Action, Atom, atom, AtomMut, Ctx, __count } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { RecordAtom, reatomRecord } from '@reatom/primitives'
import { isDeepEqual, noop } from '@reatom/utils'
import { toError } from './utils'

export interface FieldFocus {
  /** The field is focused. */
  active: boolean
  /** The filed state is not equal to the initial state. */
  dirty: boolean
  /** The field has ever gained and lost focus */
  touched: boolean
}

export interface FieldValidation {
  error: undefined | string
  valid: boolean
  validating: boolean
}

export interface FieldActions<Value = any> {
  blur: Action<[], void>
  change: Action<[Value], Value>
  focus: Action<[], void>
  reset: Action<[], void>
  validate: Action<[], FieldValidation>
}

export interface FieldAtom<State = any, Value = State>
  extends AtomMut<State>,
    FieldActions<Value> {
  focusAtom: RecordAtom<FieldFocus>
  initState: State
  validationAtom: RecordAtom<FieldValidation>
  valueAtom: Atom<Value>
}

export interface FieldValidateOption<State = any, Value = State> {
  (
    ctx: Ctx,
    meta: {
      state: State
      value: Value
      focus: FieldFocus
      validation: FieldValidation
    },
  ): any
}

export interface FieldOptions<State = any, Value = State> {
  filter?: (ctx: Ctx, newValue: Value, prevValue: Value) => boolean
  fromState?: (ctx: Ctx, state: State) => Value
  initState: State
  isDirty?: (ctx: Ctx, newValue: Value, prevValue: Value) => boolean
  name?: string
  toState?: (ctx: Ctx, value: Value) => State
  validate?: FieldValidateOption<State, Value>
  /** @deprecated use boolean flags instead */
  validationTrigger?: 'change' | 'blur' | 'submit'
  validateOnChange?: boolean
  validateOnBlur?: boolean
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

export const reatomField = <State, Value>(
  {
    filter = () => true,
    fromState = (ctx, state) => state as unknown as Value,
    initState,
    isDirty = (ctx, newValue, prevValue) => !isDeepEqual(newValue, prevValue),
    name: optionsName,
    toState = (ctx, value) => value as unknown as State,
    validate: validateFn,
    validationTrigger = 'blur',
    validateOnChange = validationTrigger === 'change',
    validateOnBlur = validationTrigger === 'blur',
  }: FieldOptions<State, Value>,
  // this is out of the options for eslint compatibility
  name = optionsName ?? __count(`${typeof initState}Field`),
): FieldAtom<State, Value> => {
  interface This extends FieldAtom<State, Value> {}
  const fieldAtom = atom(initState, `${name}.fieldAtom`) as This
  const valueAtom: This['valueAtom'] = atom(
    (ctx) => fromState(ctx, ctx.spy(fieldAtom)),
    `${name}.valueAtom`,
  )
  const focusAtom: This['focusAtom'] = reatomRecord(
    fieldInitFocus,
    `${name}.focusAtom`,
  )
  const validationAtom: This['validationAtom'] = reatomRecord(
    fieldInitValidation,
    `${name}.validationAtom`,
  )

  const validate: This['validate'] = action((ctx) => {
    let validation = ctx.get(validationAtom)

    if (validateFn !== undefined) {
      const state = ctx.get(fieldAtom)
      const value = ctx.get(valueAtom)
      const focus = ctx.get(focusAtom)

      try {
        var promise = validateFn(ctx, {
          state,
          value,
          focus,
          validation,
        })
      } catch (error) {
        var message = toError(error)
      }

      if (promise instanceof Promise) {
        const actualizeValidation = (validation: FieldValidation) =>
          ctx.get(
            (read) =>
              // this is the last validation call
              ctx.cause === read(ctx.cause.proto) &&
              state === ctx.get(fieldAtom) &&
              // the validation isn't reset
              validation === ctx.get(validationAtom) &&
              validationAtom.merge(ctx, validation),
          )

        validation = validationAtom.merge(ctx, { validating: true })

        __thenReatomed(
          ctx,
          promise,
          () => {
            actualizeValidation({
              error: undefined,
              valid: true,
              validating: false,
            })
          },
          (error) => {
            actualizeValidation({
              error: toError(error),
              valid: false,
              validating: false,
            })
          },
        ).catch(noop)
      } else {
        validation = validationAtom.merge(ctx, {
          validating: false,
          error: String(message!),
          valid: !message!,
        })
      }
    }

    return validation
  }, `${name}.validate`)

  const focus: This['focus'] = action((ctx) => {
    focusAtom.merge(ctx, { active: true })
  }, `${name}.focus`)

  const blur: This['blur'] = action((ctx) => {
    focusAtom.merge(ctx, { active: false, touched: true })
    if (validateOnBlur) validate(ctx)
  }, `${name}.blur`)

  const change: This['change'] = action((ctx, newValue) => {
    const prevValue = ctx.get(valueAtom)

    if (!filter(ctx, newValue, prevValue)) return prevValue

    fieldAtom(ctx, toState(ctx, newValue))
    newValue = ctx.get(valueAtom)

    focusAtom.merge(ctx, {
      touched: true,
      dirty: isDirty(ctx, newValue, prevValue),
    })

    if (validateOnChange) validate(ctx)

    return newValue
  }, `${name}.change`)

  const reset: This['reset'] = action((ctx) => {
    fieldAtom(ctx, initState)
    focusAtom(ctx, fieldInitFocus)
    validationAtom(ctx, fieldInitValidation)
  }, `${name}.reset`)

  return Object.assign(fieldAtom, {
    blur,
    change,
    focus,
    reset,
    validate,

    focusAtom,
    initState,
    validationAtom,
    valueAtom,
  })
}
