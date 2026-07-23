import type { StandardSchemaV1 } from '@standard-schema/spec'

import type {
  AbortExt,
  AsyncDataExt,
  AsyncExt,
  Atom,
  FieldArrayAtom,
  FieldError,
} from '../'
import {
  type Action,
  action,
  atom,
  type Computed,
  isCausedBy,
  isFieldArrayAtom,
  isFieldAtom,
  isRec,
  linkedListToArray,
  named,
  withAbort,
  withAsync,
  withAsyncData,
  withCallHook,
  withInit,
  wrap,
} from '../'
import { type FieldAtom } from './reatomField'
import type { FieldsAtomize } from './reatomFieldsAtomize'
import type {
  FieldSetInitState,
  FieldSetState,
  FieldSetValidation,
  ValidationlessFieldSetAtom,
} from './reatomFieldSet'
import { reatomFieldSet } from './reatomFieldSet'

/**
 * Type for the form's submit action with async data extensions.
 *
 * Provides access to `submit.data` for the last successful result and
 * `submit.error` for the last error.
 *
 * @example
 *   const form = reatomForm(
 *     { email: '' },
 *     {
 *       onSubmit: async (state, skipDebounce: boolean) => {
 *         if (!skipDebounce) await wrap(sleep(300))
 *         return { success: true }
 *       },
 *     },
 *   )
 *
 *   const result = await wrap(form.submit(true))
 *   console.log(form.submit.data()) // { success: true }
 *
 * @template Params - Parameters passed to the submit action
 * @template Return - Return type of the onSubmit callback
 */
export type SubmitAction<Params extends any[], Return> = Action<
  Params,
  Promise<Return>
> &
  AsyncDataExt<Params, Return, Return | undefined, Error | undefined>

/**
 * Form atom interface extending {@link ValidationlessFieldSetAtom} with
 * validation, submit handling, and submitted state tracking.
 *
 * Form provides:
 *
 * - Aggregated `validation` state from all nested fields
 * - `submit` async action with validation and schema support
 * - `submitted` state tracking
 * - Inherits all fieldset features: `fields`, `focus`, `reset`, `fieldsList`,
 *   etc.
 *
 * @template InitState - Initial state structure for form fields
 * @template SchemaState - Output type from schema validation (undefined if no
 *   schema)
 * @template SubmitReturn - Return type of onSubmit callback
 * @template SubmitParams - Additional parameters for submit action
 * @see {@link reatomForm} for creation
 * @see {@link https://reatom.dev/handbook/forms/concepts/form/|Form documentation}
 * @see {@link https://reatom.dev/handbook/forms/concepts/fieldset/|Fieldset documentation}
 */
export interface FormAtom<
  InitState extends FieldSetInitState = FieldSetInitState,
  SchemaState = any,
  SubmitReturn = void,
  SubmitParams extends any[] = any,
> extends ValidationlessFieldSetAtom<InitState> {
  /**
   * Atom with validation state of the form, computed from all the fields in
   * `fieldsList`
   */
  validation: Computed<FieldSetValidation> & {
    /** Action to trigger form validation. */
    trigger: Action<
      [],
      Promise<
        undefined extends SchemaState ? FieldSetState<InitState> : SchemaState
      >
    > &
      AsyncExt<[], any, Error | undefined> &
      AbortExt
  } & (undefined extends SchemaState
      ? {}
      : {
          triggerSchemaValidation: Action<
            [],
            | StandardSchemaV1.Result<SchemaState>
            | Promise<StandardSchemaV1.Result<SchemaState>>
          > &
            AbortExt
        })

  /**
   * Submit async handler. It checks the validation of all the fields in
   * `fieldsList`, calls the form's `validate` options handler, and then the
   * `onSubmit` options handler.
   *
   * @see {@link https://reatom.dev/handbook/async/#basic-async-actions|Async actions documentation}
   */
  submit: SubmitAction<SubmitParams, SubmitReturn>

  /** Atom with submitted state of the form */
  submitted: Atom<boolean>
}

/**
 * Base options shared between schema and non-schema form variants.
 *
 * These options define form-level defaults that propagate to all fields unless
 * overridden at the field level.
 *
 * @see {@link FormOptionsWithSchema}
 * @see {@link FormOptionsWithoutSchema}
 */
export interface BaseFormOptions {
  name?: string

  /**
   * Should reset the state after success submit?
   *
   * @default false
   */
  resetOnSubmit?: boolean

  /**
   * Defines the default reset behavior of the validation state during async
   * validation for all fields.
   *
   * @default false
   */
  keepErrorDuringValidating?: boolean

  /**
   * Defines the default reset behavior of the validation state on field change
   * for all fields. Useful if the validation is triggered on blur or submit
   * only.
   *
   * @default !validateOnChange
   */
  keepErrorOnChange?: boolean

  /**
   * Defines if the validation should be triggered with every field change by
   * default for all fields.
   *
   * @default false
   */
  validateOnChange?: boolean

  /**
   * Defines if the validation should be triggered on the field connect by
   * default for all fields.
   *
   * @default false
   */
  validateOnConnect?: boolean

  /**
   * Defines if the validation should be triggered on the field blur by default
   * for all fields.
   *
   * @default false
   */
  validateOnBlur?: boolean
}

/**
 * Form options when using a Standard Schema for validation.
 *
 * When a schema is provided, the `onSubmit` callback receives the validated and
 * transformed output type from the schema, not the raw field values.
 *
 * @example
 *   const form = reatomForm(
 *     { email: '', age: 0 },
 *     {
 *       schema: z.object({
 *         email: z.string().email(),
 *         age: z.number().min(18, 'Must be 18+'),
 *       }),
 *       onSubmit: (state) => {
 *         // state is typed as { email: string; age: number }
 *         console.log(state.email, state.age)
 *       },
 *     },
 *   )
 *
 * @template State - The output type from schema validation
 * @template SubmitReturn - Return type of onSubmit callback
 * @template SubmitParams - Additional parameters for submit action
 * @see {@link https://standardschema.dev|Standard Schema documentation}
 */
export interface FormOptionsWithSchema<
  State,
  SubmitReturn,
  SubmitParams extends any[],
> extends BaseFormOptions {
  /** The callback to process valid form data, typed according to the schema */
  onSubmit?: (
    state: State,
    ...params: SubmitParams
  ) => SubmitReturn | Promise<SubmitReturn>

  /**
   * The callback to validate form fields before submit, typed according to the
   * schema
   */
  validateBeforeSubmit?: (state: State) => any

  /**
   * The schema which supports StandardSchemaV1 specification to validate form
   * fields.
   */
  schema: StandardSchemaV1<unknown, State>
}

/**
 * Form options without schema validation.
 *
 * The `onSubmit` callback receives the raw field values typed according to the
 * form's initial state structure.
 *
 * @example
 *   const form = reatomForm(
 *     { email: '', age: 0 },
 *     {
 *       onSubmit: (state) => {
 *         // state is typed as { email: string; age: number }
 *         sendToServer(state)
 *       },
 *       validateBeforeSubmit: (state) => {
 *         if (!state.email.includes('@')) throw new Error('Invalid email')
 *       },
 *     },
 *   )
 *
 * @template InitState - Initial state structure for form fields
 * @template SubmitReturn - Return type of onSubmit callback
 * @template SubmitParams - Additional parameters for submit action
 */
export interface FormOptionsWithoutSchema<
  InitState extends FieldSetInitState,
  SubmitReturn,
  SubmitParams extends any[],
> extends BaseFormOptions {
  /**
   * The callback to process valid form data, typed according to the raw form
   * state
   */
  onSubmit?: (
    state: FieldSetState<InitState>,
    ...params: SubmitParams
  ) => SubmitReturn | Promise<SubmitReturn>

  /**
   * The callback to validate form fields before submit, typed according to the
   * raw form state
   *
   * @deprecated Renamed to `validateBeforeSubmit`
   */
  validate?: (state: FieldSetState<InitState>) => any

  /**
   * The callback to validate form fields before submit, typed according to the
   * raw form state
   */
  validateBeforeSubmit?: (state: FieldSetState<InitState>) => any

  /** Schema is explicitly disallowed or undefined in this variant */
  schema?: undefined
}

/**
 * Resolves a field atom by its path within a form's field set. Useful for
 * mapping backend validation errors to the corresponding form fields,
 * especially when the error format follows the {@link StandardSchemaV1.Issue}
 * interface.
 *
 * Recursively traverses nested fields and field arrays to find the target
 * field. Path segments that are `symbol` values are not supported and will
 * cause the function to return `null`.
 *
 * @example
 *   for (const error of response.errors) {
 *     const field = resolveFieldByPath(error.path, registerForm.fields)
 *     if (field) {
 *       field.validation.errors.unshift({
 *         source: 'submission',
 *         message: error.message,
 *       })
 *     }
 *   }
 *
 * @param path - The path segments from a {@link StandardSchemaV1.Issue}. Each
 *   segment can be a string, number, or an object with a `key` property.
 * @param fields - The form's field set to search in (e.g. `form.fields`).
 * @returns The resolved {@link FieldAtom} or {@link FieldArrayAtom}, or `null` if
 *   the path is empty, contains a `symbol` segment, or no matching field is
 *   found.
 */
export const resolveFieldByPath = (
  path: StandardSchemaV1.Issue['path'],
  fields: FieldsAtomize<any>,
): FieldAtom | FieldArrayAtom | null => {
  if (!path?.length) return null

  const shiftedPath = [...path]
  const pathSegment = shiftedPath.shift()!
  if (typeof pathSegment === 'symbol') return null

  const key =
    typeof pathSegment === 'object' && 'key' in pathSegment
      ? pathSegment.key.toString()
      : pathSegment.toString()

  const field = fields[key]
  if (!field) return null

  if (isFieldArrayAtom(field)) {
    if (!shiftedPath.length) return field
    else return resolveFieldByPath(shiftedPath, field.array())
  } else if (isFieldAtom(field)) {
    return field as FieldAtom
  } else {
    return resolveFieldByPath(shiftedPath, field)
  }
}

/**
 * Creates a reactive form with validation, submit handling, and field
 * management.
 *
 * `reatomForm` is a wrapper over {@link reatomFieldSet} that adds:
 *
 * - Submit action with validation flow
 * - Standard Schema validation support (Zod, Valibot, ArkType, etc.)
 * - Form-level validation via `validateBeforeSubmit`
 * - Default field options propagation
 *
 * ## Field Initialization
 *
 * Fields can be initialized with:
 *
 * - Primitive values (creates `reatomField` automatically)
 * - `reatomField` instances (for custom options)
 * - `reatomFieldArray` instances (for dynamic lists)
 *
 * ## Submit Flow
 *
 * When `submit` is called:
 *
 * 1. All field validations are triggered
 * 2. Schema validation runs (if defined)
 * 3. `validateBeforeSubmit` callback runs (if defined)
 * 4. `onSubmit` callback runs with validated state
 * 5. `submitted` atom becomes `true`
 *
 * @example
 *   // Basic form with schema validation
 *   import { z } from 'zod'
 *
 *   const form = reatomForm(
 *     { email: '', age: 0 },
 *     {
 *       schema: z.object({
 *         email: z.string().email(),
 *         age: z.number().min(18, 'Must be 18+'),
 *       }),
 *       onSubmit: async (state) => {
 *         await api.register(state)
 *       },
 *     },
 *   )
 *
 *   // Access fields
 *   form.fields.email.change('user@example.com')
 *   form.fields.age.change(25)
 *
 *   // Submit with error handling
 *   await wrap(form.submit()).catch(noop)
 *   if (form.submit.error()) console.log('Submit failed')
 *
 * @example
 *   // Form with field-level validation
 *   const form = reatomForm({
 *     email: reatomField('', {
 *       validate: ({ value }) => {
 *         if (!value.includes('@')) return 'Invalid email'
 *       },
 *       validateOnChange: true,
 *     }),
 *     password: reatomField('', {
 *       validate: async ({ value }) => {
 *         if (value.length < 8) throw new Error('Too short')
 *       },
 *     }),
 *   })
 *
 * @example
 *   // Form with dynamic field arrays
 *   const form = reatomForm({
 *     name: '',
 *     items: reatomFieldArray({
 *       initState: ['initial'],
 *       create: (param) => reatomField(param),
 *     }),
 *   })
 *
 *   form.fields.items.create('new item')
 *   form.fields.items.clear()
 *
 * @example
 *   // Submit with custom params and return type
 *   const form = reatomForm(
 *     { email: '' },
 *     {
 *       onSubmit: async (state, skipDebounce: boolean) => {
 *         return { state, skipDebounce }
 *       },
 *     },
 *   )
 *
 *   const result = await wrap(form.submit(true))
 *   // result: { state: { email: '' }, skipDebounce: true }
 *
 * @param initState - Initial form state or factory function
 * @param options - Form options or name string
 * @returns Form atom with fields, validation, submit, and focus management
 * @see {@link https://reatom.dev/handbook/forms/concepts/form/|Form documentation}
 * @see {@link https://reatom.dev/handbook/forms/concepts/fieldset/|Fieldset documentation}
 */
export function reatomForm<
  InitState extends FieldSetInitState,
  SchemaState = unknown,
  SubmitReturn = unknown,
  SubmitParams extends any[] = any,
>(
  initState: InitState | ((name: string) => InitState),
  optionsWithSchema: FormOptionsWithSchema<
    SchemaState,
    SubmitReturn,
    SubmitParams
  >,
): FormAtom<InitState, SchemaState, SubmitReturn, SubmitParams>

export function reatomForm<
  InitState extends FieldSetInitState,
  SubmitReturn = unknown,
  SubmitParams extends any[] = any,
>(
  initState: InitState | ((name: string) => InitState),
  options?: FormOptionsWithoutSchema<InitState, SubmitReturn, SubmitParams>,
): FormAtom<InitState, undefined, SubmitReturn, SubmitParams>

export function reatomForm<InitState extends FieldSetInitState>(
  initState: InitState | ((name: string) => InitState),
  name?: string,
): FormAtom<InitState, undefined, void, []>

export function reatomForm<
  InitState extends FieldSetInitState,
  SchemaState,
  SubmitReturn,
  SubmitParams extends any[],
>(
  initState: InitState | ((name: string) => InitState),
  options:
    | string
    | FormOptionsWithSchema<SchemaState, SubmitReturn, SubmitParams>
    | FormOptionsWithoutSchema<InitState, SubmitReturn, SubmitParams> = {},
): FormAtom<InitState, SchemaState, SubmitReturn, SubmitParams> {
  if (typeof options === 'string') {
    options = { name: options }
  }
  const {
    name = named('form'),
    onSubmit,
    resetOnSubmit = false,
    validateBeforeSubmit,
    validateOnBlur = false,
    validateOnChange = false,
    validateOnConnect = false,
    keepErrorDuringValidating = false,
    keepErrorOnChange = !validateOnChange,
    schema,
  } = options

  const setupField = (field: FieldAtom | FieldArrayAtom) => {
    field.options.extend(
      withInit((options) => {
        return {
          validateOnChange: options.validateOnChange ?? validateOnChange,
          validateOnBlur: options.validateOnBlur ?? validateOnBlur,
          validateOnConnect: options.validateOnConnect ?? validateOnConnect,
          keepErrorDuringValidating:
            options.keepErrorDuringValidating ?? keepErrorDuringValidating,
          keepErrorOnChange: options.keepErrorOnChange ?? keepErrorOnChange,
          shouldValidate: !!schema || options.shouldValidate,
        }
      }),
    )

    if (schema) {
      field.validation.trigger.extend(
        withCallHook(() => {
          if (!isCausedBy(submit)) triggerSchemaValidation()
        }),
      )
    }
  }

  const fieldSet = reatomFieldSet<InitState>(initState, name)

  const setupFields = (element: unknown, insideHook = false) => {
    if (isFieldArrayAtom(element)) {
      setupField(element)
      if (insideHook) element.array().forEach((el) => setupFields(el, true))
      else {
        element.extend(
          withInit((state) => {
            linkedListToArray(state).forEach((node) => setupFields(node))
            return state
          }),
        )
      }
    } else if (isRec(element)) {
      Object.values(element).forEach((element) => setupFields(element))
    } else if (isFieldAtom(element)) {
      setupField(element as FieldAtom)
    }
  }

  setupFields(fieldSet.fields)
  fieldSet.experimental_onFieldCreated?.extend(
    withCallHook((field) => setupFields(field, true)),
  )

  const submitted = atom(false, `${name}.submitted`)

  fieldSet.reset.extend(
    withCallHook(() => {
      submitted.set(false)
      submit.error.set(undefined)
      submit.data.set(undefined)

      if (!isCausedBy(submit)) submit.abort(`${name}.reset`)
    }),
  )

  const triggerSchemaValidation = action(() => {
    if (!schema) throw new Error('Triggering schema validation without schema')

    const state = fieldSet()
    const validation = schema['~standard'].validate(state)

    const placeErrors = (result: StandardSchemaV1.Result<SchemaState>) => {
      const touched = new Map<FieldAtom | FieldArrayAtom, FieldError[]>()

      if (result.issues) {
        for (const issue of result.issues) {
          const field = resolveFieldByPath(issue.path, fieldSet.fields)
          if (!field) continue

          const fieldErrors = touched.get(field) ?? [
            ...field.validation.errors().filter((e) => e.source !== 'schema'),
          ]
          fieldErrors.unshift({
            source: 'schema',
            message: issue.message,
          })
          touched.set(field, fieldErrors)
        }
      }

      for (const field of [
        ...fieldSet.fieldsList(),
        ...fieldSet.fieldArraysList(),
      ]) {
        const placedErrors = touched.get(field)
        if (!placedErrors) {
          if (field.validation.errors().find((e) => e.source == 'schema'))
            field.validation.clearErrors('schema')
        } else {
          field.validation.errors.set(placedErrors)
        }
      }

      return result
    }

    return validation instanceof Promise
      ? validation.then(wrap(placeErrors))
      : placeErrors(validation)
  }, `${name}.triggerSchemaValidation`).extend(withAbort())

  const origTriggerValidation = fieldSet.validation.trigger
  const triggerValidation = action(async () => {
    const status = origTriggerValidation()
    const validationResult = status.validating
      ? await wrap(status.validating)
      : status
    const { errors } = validationResult
    if (errors.length) throw new Error(errors[0]!.message)

    let state: any

    if (schema) {
      const promise = triggerSchemaValidation()
      const schemaValidationResult =
        promise instanceof Promise ? await wrap(promise) : promise
      if (schemaValidationResult.issues)
        throw new Error(
          schemaValidationResult.issues[0]?.message ?? 'Unknown schema error',
        )

      state = schemaValidationResult.value
    } else {
      state = fieldSet()
    }

    if (validateBeforeSubmit) {
      const promise = validateBeforeSubmit(state)
      if (promise instanceof Promise) await wrap(promise)
    }

    return state
  }, `${name}.validation.trigger`).extend(
    withAsync({ status: true }),
    withAbort(),
  )

  const submit = action((...params: SubmitParams) => {
    return wrap(triggerValidation())
      .then(
        wrap((state) => {
          if (!onSubmit) return undefined as SubmitReturn
          return onSubmit(state, ...params)
        }),
      )
      .then(
        wrap((result) => {
          submitted.set(true)
          if (resetOnSubmit) fieldSet.reset()
          return result as SubmitReturn
        }),
      )
  }, `${name}.submit`).extend(withAsyncData({ resetError: 'onFulfill' }))

  const validation = Object.assign(fieldSet.validation, {
    trigger: triggerValidation,
    triggerSchemaValidation,
  })

  return Object.assign(fieldSet, {
    submit,
    submitted,
    validation,
  })
}

/** @deprecated Renamed. Use FormAtom instead */
export type Form<
  InitState extends FieldSetInitState = FieldSetInitState,
  SchemaState = any,
  SubmitReturn = any,
  SubmitParams extends any[] = any,
> = FormAtom<InitState, SchemaState, SubmitReturn, SubmitParams>
