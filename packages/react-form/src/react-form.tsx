import { createAtom } from '@reatom/core'
import { memo, isShallowEqual } from '@reatom/core/experiments'
import { useAction, useAtom } from '@reatom/react'
import React, { ReactElement, ReactNode, useContext } from 'react'
import {
  createForm,
  CreateFormParams,
  FieldConfig,
  FieldMetaState,
  FieldValidator,
  FormState,
  mapFieldToMeta,
} from '@reatom/form'

export type FieldInputProps<FieldValue> = {
  name: string
  onBlur: () => void
  onChange: (value: any) => void
  onFocus: () => void
  value: FieldValue
}

export type FieldRenderProps<FieldValue> = {
  input: FieldInputProps<FieldValue>
  meta: FieldMetaState<FieldValue>
  [otherProp: string]: any
}

const mapStoreToFormState = (state: FormState<any, any>) => {
  return {
    initialValues: state.initialValues,
    valid: state.valid,
    invalid: state.invalid,
    values: state.values,
    pristine: state.pristine,
    submitting: state.submitting,
    validating: state.validating,
  }
}
export const useForm = () => {
  const form = useContext(Context)
  return React.useMemo(
    () => ({
      atom: form,
      submit: () =>
        new Promise<undefined>((resolve) =>
          form.submit.dispatch(() => resolve(undefined)),
        ),
      getState: (): FormState<any, any> => mapStoreToFormState(form.getState()),
      change: form.change.dispatch,
      resetFieldState: (name: string) => form.reset.dispatch(name),
      getFieldState: (name: string) => mapFormToField(form.getState(), name),
    }),
    [form],
  )
}
export interface FormSubscription {
  subscription?: {
    submitting?: boolean
    initialValues?: boolean
    invalid?: boolean
    pristine?: boolean
    touched?: boolean
    valid?: boolean
    validating?: boolean
    values?: boolean
  }
}

export const useFormState = (
  config?: FormSubscription,
): FormState<any, any> => {
  const form = useContext(Context)
  const formState = React.useMemo(
    () =>
      createAtom(
        { form },
        ({ onChange, get }, state = mapStoreToFormState(get('form'))) => {
          onChange('form', (newState, oldState) => {
            if (
              oldState === undefined ||
              !config?.subscription ||
              Object.keys(config.subscription).some(
                (prop) =>
                  //@ts-ignore
                  newState[prop] !== oldState[prop],
              )
            ) {
              state = mapStoreToFormState(newState)
            }
          })
          return state
        },
        { decorators: [memo()] },
      ),
    [form],
  )
  return useAtom(formState)[0]
}

export interface FieldSubscription {
  subscription?: {
    error?: boolean
    touched?: boolean
    validating?: boolean
    value?: boolean
  }
}

// @ts-ignore
const mapFormToField = (form, name: string) => {
  const field = form.fields[name]
  return {
    input: {
      value: field.value,
      name,
    },
    meta: mapFieldToMeta(field),
  }
}

export const useField = (
  name: string,
  config?: FieldConfig & FieldSubscription,
): FieldRenderProps<any> => {
  const form = useContext(Context)
  // @ts-ignore
  if (form.getState().fields[name] === undefined) {
    form.addField.dispatch(name)
    if (config) {
      form.setConfig.dispatch(name, config)
    }
  }
  const destroyView = useAction(() => form.destroyView(name), [name])
  const createView = useAction(() => form.createView(name), [name])
  React.useEffect(() => {
    if (form.getState().fields[name] !== undefined) {
      createView()
    }
    return () => {
      destroyView()
    }
  }, [destroyView, createView, name, form])
  const onBlur = useAction(() => form.blur(name), [name])
  const onFocus = useAction(() => form.focus(name), [name])
  const onChange = useAction((value: any) => form.change(name, value), [name])
  // @ts-ignore
  const newAtom = React.useMemo(() => {
    return createAtom(
      {
        form,
      },
      // @ts-ignore
      ({ onChange, get }, state = mapFormToField(get('form'), name)) => {
        let newState = state
        onChange('form', (newStateForm, oldState) => {
          if (
            oldState === undefined ||
            !config?.subscription ||
            Object.keys(config.subscription).some(
              (prop) =>
                //@ts-ignore
                newStateForm.fields[name][prop] !== oldState.fields[name][prop],
            )
          ) {
            newState = mapFormToField(newStateForm, name)
          }
        })

        return newState
      },
      {
        decorators: [
          memo((a, b) => {
            return (
              isShallowEqual(a.input, b.input) && isShallowEqual(a.meta, b.meta)
            )
          }),
        ],
      },
    )
  }, [form, name])

  const [state] = useAtom(newAtom)
  return React.useMemo(
    () => ({
      ...state,
      input: {
        ...state.input,
        onBlur,
        onFocus,
        onChange,
      },
    }),
    [state, onBlur, onFocus, onChange],
  )
}

export const Context = React.createContext(
  createForm({ onSubmit: () => {}, initialValues: {} }),
)

export const Form: React.VFC<
  CreateFormParams &
    FormSubscription & {
      debug?: boolean
      createForm?: typeof createForm
      component?: React.FC
      children?: (
        formState: FormState<any> & { form: ReturnType<typeof useForm> },
      ) => ReactElement
    }
> = ({
  onSubmit,
  initialValues,
  children,
  createForm: createFormCertain = createForm,
  component: Component,
  subscription,
  debug = false,
  ...props
}) => {
  const submitMemo = React.useRef(onSubmit)
  submitMemo.current = onSubmit
  const [form] = React.useState(() =>
    createFormCertain({
      onSubmit: (values: object) => submitMemo.current(values),
      initialValues,
    }),
  )
  React.useEffect(() => {
    if (debug) {
      return form.subscribe(console.log)
    }
  }, [debug, form])
  let render = null
  if (Component) {
    render = <Component {...props} />
  } else if (typeof children === 'function') {
    render = (
      // @ts-ignore
      <RenderChildren subscription={subscription}>{children}</RenderChildren>
    )
  }
  return <Context.Provider value={form}>{render}</Context.Provider>
}

const RenderChildren = ({
  children,
  subscription,
}: FormSubscription & { children: (value: any) => Element }): Element => {
  const formState = useFormState({ subscription })
  const form = useForm()
  const props = React.useMemo(() => ({ ...formState, form }), [formState, form])
  return children(props) ?? null
}

export type FieldProps<T> = {
  component?: React.FC<FieldRenderProps<T>>
  name: string
  children?:
    | ReactNode
    | ((fieldState: FieldRenderProps<T>) => ReactElement<any, any> | null)
  validate?: FieldValidator<T>
  [key: string]: any
}

export const Field = function Field<T>({
  name,
  component: Component,
  subscription,
  validate,
  children,
  ...props
}: FieldProps<T> & FieldSubscription) {
  const field = useField(name, {
    validate: validate ?? null,
    subscription,
  })
  let render = null
  if (Component) {
    render = (
      <Component {...field} {...props}>
        {children}
      </Component>
    )
  } else if (typeof children === 'function') {
    render = children(field)
  }
  return render
}
