import {
  action,
  Action,
  Atom,
  atom,
  AtomMut,
  Ctx,
  Fn,
  Rec,
  throwReatomError,
  Unsubscribe,
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

// ------------------------------------------------------------------------------------------------

// @reatom/form-web

// ------------------------------------------------------------------------------------------------

export const UNSUPPORTED_INPUT_TYPES = [
  'button',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'submit',
  'datetime',
] as const

export const INPUT_TEXT_TYPES = [
  'color',
  'date',
  'datetime-local',
  'email',
  'month',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week',
] as const
export type INPUT_TEXT_TYPES = typeof INPUT_TEXT_TYPES[number]

export type HTMLFieldAtom<
  T = string,
  El extends HTMLElement = HTMLInputElement,
> = FieldAtom<T> & {
  attributesAtom: RecordAtom<Partial<El>>
  elementAtom: Atom<null | El>
  register: Action<[null | El]>
}

export type HTMLInputAttributes<T extends string = string> = {
  type?: T
} & Partial<Omit<HTMLInputElement, 'type'>>

const getType = (initState: unknown) => {
  const stateType = typeof initState

  if (stateType === 'number') return 'number'
  if (stateType === 'boolean') return 'checkbox'

  return 'text'
}

const getElementValue = (
  el: HTMLInputElement | HTMLSelectElement,
  type: string,
) => {
  if (type === 'number') return +(el as HTMLInputElement).value
  if (type === 'checkbox') return (el as HTMLInputElement).checked
  if (type === 'select') {
    const res = []
    for (const { value } of (el as HTMLSelectElement).selectedOptions) {
      res.push(value)
    }
    return res
  }
  return el.value
}
const setElementValue = (el: HTMLElement, type: string, value: any) => {
  if (type === 'checkbox') {
    ;(el as HTMLInputElement).checked = value
  }
  if (type === 'select') {
    for (const option of (el as HTMLSelectElement).selectedOptions) {
      if (value.includes(option.value)) option.selected = true
    }
  } else {
    ;(el as HTMLInputElement).value = value
  }
}

const getAttributes = (el: HTMLElement) =>
  Object.keys(el).reduce((acc, k) => {
    if (!k.startsWith('_')) {
      // @ts-expect-error
      const v = el[k]
      acc[k] = v
    }
    return acc
  }, {} as Rec)

// TODO
// @ts-ignore
export const withHtmlRegistration: {
  (attributes?: HTMLInputAttributes<INPUT_TEXT_TYPES>): Fn<
    [FieldAtom<string>],
    HTMLFieldAtom<string>
  >
  (attributes?: HTMLInputAttributes<'number'>): Fn<
    [FieldAtom<number>],
    HTMLFieldAtom<number>
  >
  (attributes?: HTMLInputAttributes<'checkbox'>): Fn<
    [FieldAtom<boolean>],
    HTMLFieldAtom<boolean>
  >
  (attributes?: Partial<HTMLSelectElement>): Fn<
    [FieldAtom<string[]>],
    HTMLFieldAtom<string[], HTMLSelectElement>
  >
  // TODO
  // <T extends FieldAtom<[]>>(options: { multiple?: boolean }): Fn<[T], HTMLFieldAtom<HTMLSelectElement, T>>
  // <T extends FieldAtom<string>>(options: { multiple?: boolean }): Fn<[T], HTMLFieldAtom<HTMLTextAreaElement, T>>
  // radio
} =
  (attributes: HTMLInputAttributes | Partial<HTMLSelectElement> = {}) =>
  (fieldAtom: FieldAtom) => {
    const type = Array.isArray(fieldAtom.initState)
      ? 'select'
      : ((attributes as HTMLInputAttributes).type ??= getType(
          fieldAtom.initState,
        ))
    const name = fieldAtom.__reatom.name?.replace('.dataAtom', '')
    // TODO onUpdate(fieldAtom.reset, (ctx) => attributesAtom(ctx, attributes))
    const attributesAtom = reatomRecord(
      attributes,
      name?.concat('.attributesAtom'),
    )
    const elementAtom = atom<null | HTMLElement>(
      null,
      name?.concat('.elementAtom'),
    )
    const unsubscribeAtom = atom<null | Unsubscribe>(null)

    const register: HTMLFieldAtom['register'] = action((ctx, el) => {
      // TODO warn?
      if (el === ctx.get(elementAtom)) return

      if (el === null) {
        const un = ctx.get(unsubscribeAtom)
        unsubscribeAtom(ctx, null)
        un?.()
        return
      }
      // TODO
      // throwReatomError(
      //   !(el instanceof HTMLInputElement),
      //   'unsupported element kind',
      // )
      if (
        [HTMLInputElement, HTMLTextAreaElement, HTMLSelectElement].every(
          (HTMLElement) => el instanceof HTMLElement === false,
        )
      ) {
        throw new Error('Unsupported element kind')
      }

      let lastInput = ctx.get(fieldAtom)
      if (type === 'select' && lastInput.length === 0) {
        lastInput = fieldAtom(ctx, getElementValue(el, type))
      }

      const validateNative = action((ctx) => {
        const meta = ctx.get(fieldAtom.validationAtom)
        if (meta.validating || !meta.valid || el.checkValidity()) return

        fieldAtom.validationAtom(ctx, (state) => ({
          ...state,
          valid: false,
          error: el.validationMessage,
        }))
      }, name?.concat('.validateNative'))

      elementAtom(ctx, el)
      attributesAtom.merge(ctx, getAttributes(el))

      const handleFocus = () => fieldAtom.focus(ctx)
      const handleBlur = () => fieldAtom.blur(ctx)
      const changeInput = action((ctx) => {
        const _lastInput = lastInput
        ctx.schedule(
          () => setElementValue(el, type, (lastInput = _lastInput)),
          -1,
        )

        const input = getElementValue(el, type)

        if (ctx.get(fieldAtom) !== fieldAtom.change(ctx, input)) {
          lastInput = input
        } else {
          setElementValue(el, type, lastInput)
        }
      }, name?.concat('.changeInput'))
      const handleChange = () => changeInput(ctx)
      const handleChangeAttributes = (
        ctx: Ctx,
        { state }: { state: typeof attributes },
      ) => {
        Object.assign(el, state)
        ctx.schedule(() => {
          // TODO
          console.warn('Element assign rollback is not implemented')
        }, -1)
      }

      // TODO codestyle
      const un = ctx.subscribe(fieldAtom, () => {})
      ctx.schedule(un, -1)

      ctx.schedule(() => {
        // TODO el to attributesAtom by MutationObserver (optional)
        // TODO addOnUpdate
        // FIXME ctx origin!
        ;(fieldAtom.validate.__reatom.updateHooks ??= new Set()).add(
          validateNative,
        )
        ;(attributesAtom.__reatom.updateHooks ??= new Set()).add(
          handleChangeAttributes,
        )

        Object.assign(el, ctx.get(attributesAtom))
        setElementValue(el, type, lastInput)

        el.addEventListener('focus', handleFocus)
        el.addEventListener('blur', handleBlur)
        el.addEventListener('input', handleChange)
      })

      unsubscribeAtom(ctx, () => () => {
        fieldAtom.validate.__reatom.updateHooks!.delete(validateNative)
        attributesAtom.__reatom.updateHooks!.delete(handleChangeAttributes)

        el.removeEventListener('focus', handleFocus)
        el.removeEventListener('blur', handleBlur)
        el.removeEventListener('input', handleChange)

        ctx.get(() => {
          un()
          elementAtom(ctx, null)
        })
      })
    }, name?.concat('.register'))

    ;(fieldAtom.reset.__reatom.updateHooks ??= new Set()).add((ctx) => {
      const el = ctx.get(elementAtom)
      if (el) {
        setElementValue(el, type, fieldAtom.initState)
        // FIXME: do not work
        el.dispatchEvent(new Event('formReset', { bubbles: false }))
      }
    })

    return Object.assign(fieldAtom, {
      attributesAtom,
      elementAtom,
      register,
    })
  }

export type HTMLForm = Form & {
  elementAtom: Atom<null | HTMLFormElement>
  onHTMLSubmit: Action<[event: SubmitEvent]>
  reatomHTMLField: {
    (initState: string): HTMLFieldAtom<string>
    (initState: number): HTMLFieldAtom<number>
    (initState: boolean): HTMLFieldAtom<boolean>
    (initState: string[]): HTMLFieldAtom<string[], HTMLSelectElement>
    (
      options: FieldOptions<string> & HTMLInputAttributes<INPUT_TEXT_TYPES>,
    ): HTMLFieldAtom<string>
    (
      options: FieldOptions<number> & HTMLInputAttributes<'number'>,
    ): HTMLFieldAtom<number>
    (
      options: FieldOptions<boolean> & HTMLInputAttributes<'checkbox'>,
    ): HTMLFieldAtom<boolean>
    (
      options: FieldOptions<string[]> & Partial<HTMLSelectElement>,
    ): HTMLFieldAtom<string[], HTMLSelectElement>
  }
  register: Action<[null | HTMLFormElement]>
}

export type HTMLFormOptions = FormOptions & {
  focusOnError?: boolean
  preventDefault?: boolean
}

export const reatomHTMLForm = ({
  focusOnError = true,
  preventDefault = true,
  ...options
}: HTMLFormOptions): HTMLForm => {
  const { name, onSubmitError } = options

  if (focusOnError) {
    options = {
      ...options,
      onSubmitError(ctx) {
        let htmlFieldAtom
        for (const fieldAtom of ctx.get(form.fieldsListAtom)) {
          const { valid, validating } = ctx.get(fieldAtom.validationAtom)

          if (!valid) {
            htmlFieldAtom = fieldAtom as HTMLFieldAtom
            break
          }

          if (validating) htmlFieldAtom = fieldAtom as HTMLFieldAtom
        }

        if (htmlFieldAtom?.elementAtom) {
          ctx.get(htmlFieldAtom.elementAtom)?.focus()
        }

        onSubmitError?.(ctx)
      },
    }
  }

  const form = reatomForm(options)

  const elementAtom = atom<null | HTMLFormElement>(
    null,
    name?.concat('.elementAtom'),
  )
  const unsubscribeAtom = atom<null | Unsubscribe>(null)

  const register: HTMLForm['register'] = action((ctx, el) => {
    if (el === null) {
      const un = ctx.get(unsubscribeAtom)
      unsubscribeAtom(ctx, null)
      un?.()
      return
    }

    throwReatomError(ctx.get(elementAtom), 'form already registered')

    elementAtom(ctx, el)

    const handleSubmit = (event: SubmitEvent) => {
      onHTMLSubmit(ctx, event)
    }

    ctx.schedule(() => {
      el.addEventListener('submit', handleSubmit)
    })

    unsubscribeAtom(ctx, () => () => {
      el.removeEventListener('submit', handleSubmit)
      elementAtom(ctx, null)
    })
  }, name?.concat('.register'))

  // @ts-expect-error
  const reatomHTMLField: HTMLForm['reatomHTMLField'] = (options) => {
    // @ts-expect-error
    const {
      filter,
      initState,
      validate,
      validationTrigger,
      ...attributes
    }: FieldOptions =
      typeof options === 'object' && !Array.isArray([])
        ? options
        : { initState: options }
    /* prettier-ignore */ return form.reatomField({ filter, initState, name: name ? `${name}.${attributes.name}` : attributes.name, validate, validationTrigger }).pipe(withHtmlRegistration(attributes))
  }

  const onHTMLSubmit = action((ctx, event: SubmitEvent) => {
    preventDefault && event.preventDefault()
    form.onSubmit(ctx)
  }, name?.concat('.onHTMLSubmit'))

  return {
    ...form,
    elementAtom,
    onHTMLSubmit,
    reatomHTMLField,
    register,
  }
}
