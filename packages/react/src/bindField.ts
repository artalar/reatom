import type { FieldAtom, FieldElementRef, Rec } from '@reatom/core'
import { abortVar, memoKey, notify, wrap } from '@reatom/core'
import type { ChangeEvent, FocusEvent, Ref } from 'react'

type ChangeArg<Value> =
  | Value
  | {
      currentTarget: Value extends boolean
        ? { checked: Value }
        : { value: Value }
    }
  | ChangeEvent<{ value: Value }>

export interface BindFieldOptions<Value = any> {
  /** Called after the field state is updated, with the original change argument. */
  onChange?: (value: ChangeArg<Value>) => void
  /** Called after the field focus is released. */
  onBlur?: (event?: FocusEvent<Element>) => void
  /** Called after the field gains focus. */
  onFocus?: (event?: FocusEvent<Element>) => void
  /**
   * The user element ref, called in addition to writing the element to
   * `field.elementRef`. Accepts a callback ref or a ref object.
   */
  ref?: Ref<FieldElementRef>
}

type Handlers<Value> = {
  onChange: (event: ChangeArg<Value>) => void
  onBlur: (event?: FocusEvent<Element>) => void
  onFocus: (event?: FocusEvent<Element>) => void
  ref: (element: FieldElementRef | null) => void
}

export function bindField<Value = any>(
  field: FieldAtom<any, Value>,
  options?: BindFieldOptions<Value>,
): {
  value: Value extends boolean ? undefined : Value
  checked: Value extends boolean ? boolean : undefined
  onChange: (value: ChangeArg<Value>) => void
  onBlur: () => void
  onFocus: () => void
  ref: (element: FieldElementRef | null) => void
  error: undefined | string
} {
  const memo = memoKey(field.name, () => ({
    field,
    controller: undefined as undefined | ReturnType<typeof abortVar.get>,
    options: undefined as BindFieldOptions<Value> | undefined,
    handlers: undefined as Handlers<Value> | undefined,
  }))

  // Keep the latest user options so the memoized wrappers below read fresh
  // closures at call time instead of capturing a stale one at creation.
  memo.options = options

  const createHandlers = (): Handlers<Value> => {
    const onChange = wrap((event: ChangeArg<Value>) => {
      const target = (event as unknown as { currentTarget?: HTMLInputElement })
        .currentTarget
      const value = target?.addEventListener
        ? ((target.type === 'checkbox'
            ? target.checked
            : target.value) as Value)
        : (event as Value)

      field.change(value)
      notify()
      memo.options?.onChange?.(event)
    })

    const onBlur = wrap((event?: FocusEvent<Element>) => {
      field.focus.out()
      notify()
      memo.options?.onBlur?.(event)
    })
    const onFocus = wrap((event?: FocusEvent<Element>) => {
      field.focus.in()
      notify()
      memo.options?.onFocus?.(event)
    })

    const ref = wrap((element: FieldElementRef | null) => {
      field.elementRef.set(element ?? undefined)
      const userRef = memo.options?.ref
      if (typeof userRef === 'function') userRef(element)
      else if (userRef) userRef.current = element
    })

    return { onChange, onBlur, onFocus, ref }
  }

  if (
    !memo.handlers ||
    memo.controller?.signal.aborted ||
    memo.field !== field
  ) {
    memo.field = field
    memo.controller = abortVar.get()
    memo.handlers = createHandlers()
  }

  const { onChange, onBlur, onFocus, ref } = memo.handlers

  const value = field.value()
  const { error } = field.validation()

  const result: Rec = {
    onChange,
    onBlur,
    onFocus,
    ref,
    error,
  }

  if (typeof value === 'boolean') {
    result.checked = value
  } else {
    result.value = value
  }

  // @ts-expect-error generic overloads
  return result
}
