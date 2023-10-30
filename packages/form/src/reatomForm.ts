import { action, Action, Atom, atom, Ctx, Fn, __count } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { isShallowEqual } from '@reatom/utils'
import {
  FieldAtom,
  FieldFocus,
  FieldValidation,
  fieldInitFocus,
  fieldInitValidation,
  reatomField,
} from './reatomField'
import { take } from '@reatom/effects'
import { AsyncAction, reatomAsync, withAbort } from '@reatom/async'
import { reatomRecord } from '@reatom/primitives'
import { toError } from './utils'

export interface Form {
  fieldsListAtom: Atom<Array<FieldAtom>>
  focusAtom: Atom<FieldFocus>
  onSubmit: AsyncAction<[], void>
  reatomField: typeof reatomField
  reset: Action<[], void>
  validationAtom: Atom<FieldValidation>
  formValidationAtom: Atom<FieldValidation>
}

export interface FormOptions {
  name?: string
  onSubmit: (ctx: Ctx, form: Form) => void | Promise<void>
  onSubmitError?: Fn<[ctx: Ctx]>
  validate?: (ctx: Ctx, form: Form) => any
}

export const reatomForm = (
  { name: optionsName, onSubmit, onSubmitError, validate }: FormOptions,
  // this is out of the options for eslint compatibility
  name = optionsName ?? __count('form'),
): Form => {
  const fieldsListAtom = atom<Array<FieldAtom>>([], `${name}.fieldsListAtom`)
  const focusAtom = atom((ctx, state = fieldInitFocus) => {
    const formFocus = { ...fieldInitFocus }
    for (const fieldAtom of ctx.spy(fieldsListAtom)) {
      const { active, dirty, touched } = ctx.spy(fieldAtom.focusAtom)
      formFocus.active ||= active
      formFocus.dirty ||= dirty
      formFocus.touched ||= touched
    }
    return isShallowEqual(formFocus, state) ? state : formFocus
  }, `${name}.focusAtom`)
  const formValidationAtom: FieldAtom['validationAtom'] = reatomRecord(
    fieldInitValidation,
    `${name}.formValidationAtom`,
  )
  const validationAtom = atom((ctx, state = fieldInitValidation) => {
    const formValid = { ...fieldInitValidation }

    const check = ({ valid, validating, error }: FieldValidation) => {
      formValid.valid &&= valid
      formValid.validating ||= validating
      formValid.error ||= error
    }

    check(ctx.spy(formValidationAtom))

    for (const fieldAtom of ctx.spy(fieldsListAtom)) {
      check(ctx.spy(fieldAtom.validationAtom))
    }

    return isShallowEqual(formValid, state) ? state : formValid
  }, `${name}.validationAtom`)

  const reset = action((ctx) => {
    formValidationAtom.reset(ctx)
    ctx.get(fieldsListAtom).forEach((fieldAtom) => fieldAtom.reset(ctx))
    if (ctx.get(handleSubmit.pendingAtom)) handleSubmit.abort(ctx)
  }, `${name}.reset`)

  const handleSubmit = reatomAsync(async (ctx) => {
    for (const fieldAtom of ctx.get(fieldsListAtom)) {
      if (ctx.get(fieldAtom.validationAtom) === fieldInitValidation) {
        fieldAtom.validate(ctx)
      }
    }

    let { valid, validating } = ctx.get(validationAtom)

    if (validating) {
      valid = await take(
        ctx,
        validationAtom,
        (ctx, { validating, valid }, skip) => (validating ? skip : valid),
      )
    }

    if (valid) {
      if (validate) {
        try {
          formValidationAtom.merge(ctx, {
            error: undefined,
            valid,
            validating: true,
          })
          const promise = validate(ctx, form)
          if (promise instanceof promise) {
            await ctx.schedule(() => promise)
          }
          formValidationAtom.merge(ctx, { valid, validating: false })
        } catch (error) {
          formValidationAtom.merge(ctx, {
            error: toError(error),
            valid: false,
            validating: false,
          })
          throw error
        }
      }

      await ctx.schedule(() => onSubmit(ctx, form))
    } else {
      onSubmitError?.(ctx)
    }
  }, `${name}.onSubmit`).pipe(withAbort())

  const reatomFormField: typeof reatomField = (
    options,
    fieldName = options.name ?? __count(`${typeof options.initState}Field`),
  ) => {
    const atomField = reatomField(options, `${name}.${fieldName}`)

    onConnect(atomField, (ctx) => {
      fieldsListAtom(ctx, (state) => [...state, atomField])
      return () =>
        fieldsListAtom(ctx, (state) =>
          state.filter((anAtom) => anAtom !== atomField),
        )
    })

    return atomField
  }

  const form: Form = {
    fieldsListAtom,
    focusAtom,
    onSubmit: handleSubmit,
    reatomField: reatomFormField,
    reset,
    validationAtom,
    formValidationAtom,
  }

  return form
}
