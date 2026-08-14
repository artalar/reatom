import {
  _read,
  abortVar,
  action,
  assert,
  bind,
  type Fn,
  type Frame,
  named,
  notify,
  type ReatomAbortController,
  reatomAbstractRender,
  ReatomError,
  type Rec,
  STACK,
  withAbort,
  wrap,
} from '@reatom/core'
import React, { useEffect } from 'react'

// https://github.com/webpack/webpack/issues/12960#issuecomment-1086272918
let {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: oldInternals,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: newInternals,
} = React as any

/** @private */
export let _getComponentDebugName = (fallback?: string): string => {
  let Component =
    oldInternals?.ReactCurrentOwner?.current?.type ??
    newInternals?.A?.getOwner?.()?.type

  let name = (Component?.displayName ?? Component?.name) || fallback
  return name || named('Component')
}

export let reatomContext = React.createContext<null | Frame>(null)

export let useFrame = (): Frame => {
  let frame = React.useContext(reatomContext) ?? STACK[0]

  assert(
    frame,
    'the root is not set, you probably forgot to specify the  provider',
    ReatomError,
  )

  return frame
}

export const useWrap = <Params extends any[], Payload>(
  callback: (...params: Params) => Payload,
  name?: string,
): ((...params: Params) => Payload) => {
  let frame = useFrame()

  let ref: {
    stableFn: (...args: Params) => Payload
    callback: (...args: Params) => Payload
  } = React.useMemo(
    () => ({
      callback,
      stableFn: wrap(
        action((...params) => {
          try {
            return ref.callback(...params)
          } finally {
            notify()
          }
        }, _getComponentDebugName(name)),
        frame,
      ),
    }),
    [],
  )

  ;(
    React.useInsertionEffect ??
    (typeof document !== 'undefined' ? React.useLayoutEffect : React.useEffect)
  )(() => {
    ref.callback = callback
  })

  return ref.stableFn
}

export let isSuspense = (thing: unknown) =>
  thing instanceof Promise ||
  (thing instanceof Error && thing.message.startsWith('Suspense Exception'))

// The inline symbol is intentional: `react-is` operates on elements, not on
// component types. The same detection is used by mobx-react-lite `observer`:
// https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/observer.ts
let REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref')

let REACT_MEMO_TYPE = Symbol.for('react.memo')

let isForwardRefComponent = (
  thing: unknown,
): thing is { render: React.ForwardRefRenderFunction<unknown, Rec> } =>
  typeof thing === 'object' &&
  thing !== null &&
  '$$typeof' in thing &&
  thing.$$typeof === REACT_FORWARD_REF_TYPE

let isMemoComponent = (thing: unknown): boolean =>
  typeof thing === 'object' &&
  thing !== null &&
  '$$typeof' in thing &&
  thing.$$typeof === REACT_MEMO_TYPE

// A `forwardRef(...)` exotic object is not callable — the reactive render
// calls components as plain functions, so it needs the `render` field.
let unwrapForwardRefRender = <RenderFn extends Fn>(
  Component: RenderFn | { render: RenderFn },
): RenderFn => (typeof Component === 'function' ? Component : Component.render)

interface ReatomComponentOptions {
  deps?: Array<string>
  name?: string
  abortOnUnmount?: boolean
}

/**
 * Connects a component to Reatom so it re-renders whenever the atoms read
 * during its render change.
 *
 * To forward a ref, pass a `React.forwardRef(...)` component. This form stays
 * correct across React versions and is the recommended way to expose a ref from
 * a Reatom component.
 *
 * @example
 *   const Counter = reatomComponent(() => {
 *     return <div>{countAtom()}</div>
 *   }, 'Counter')
 *
 * @example
 *   const Input = reatomComponent(
 *     React.forwardRef<HTMLInputElement, { placeholder: string }>(
 *       (props, ref) => <input ref={ref} placeholder={props.placeholder} />,
 *     ),
 *     'Input',
 *   )
 */
export function reatomComponent<ExoticProps extends Rec = {}>(
  Component: React.ForwardRefExoticComponent<ExoticProps>,
  options?: string | ReatomComponentOptions,
): React.ForwardRefExoticComponent<ExoticProps>
export function reatomComponent<Props extends Rec = {}>(
  Component: (props: Props) => React.ReactNode,
  options?: string | ReatomComponentOptions,
): (props: Props) => React.ReactNode
export function reatomComponent(
  Component:
    | React.ForwardRefRenderFunction<unknown, Rec>
    | React.ForwardRefExoticComponent<Rec>,
  options?: string | ReatomComponentOptions,
):
  | ((props: Rec, ref?: React.ForwardedRef<unknown>) => React.ReactNode)
  | React.ForwardRefExoticComponent<Rec> {
  let deps: Array<string> = []
  let name: string | undefined
  let abortOnUnmount: boolean = false
  if (typeof options === 'object') {
    deps = options.deps ?? []
    name = options.name
    abortOnUnmount = options.abortOnUnmount ?? false
  } else {
    name = options
  }
  name ||= named('Component', Component.name)

  // A `React.memo(...)` object holds its render in `.type`, not `.render`, so
  // the unwrap below cannot reach it. Wrap the result instead:
  // `React.memo(reatomComponent(...))`.
  assert(
    !isMemoComponent(Component),
    'reatomComponent does not accept a React.memo component; apply memo to the result instead: React.memo(reatomComponent(...))',
    ReatomError,
  )

  // The unwrapped component is wrapped back into `forwardRef` at the bottom
  // to keep the ref contract for React versions without ref-as-prop. Same
  // unwrap/re-wrap flow as in mobx-react-lite `observer`.
  let renderComponent: React.ForwardRefRenderFunction<unknown, Rec> =
    unwrapForwardRefRender(Component)

  function render(
    props: Rec,
    forwardedRef?: React.ForwardedRef<unknown>,
  ): React.ReactNode {
    let frame = useFrame()

    let [, rerender] = React.useState({ result: null as React.ReactNode })

    // The ref arrives as the second argument when this component is used as a
    // `forwardRef` render function. The box keeps the memoized reactive
    // render below in sync with the latest ref without recreating it.
    let refBox = React.useRef<React.ForwardedRef<unknown>>(null)
    refBox.current = forwardedRef ?? null

    let { render, mount } = React.useMemo(
      () =>
        reatomAbstractRender({
          frame,
          render(props: Rec) {
            try {
              return renderComponent(props, refBox.current)
            } catch (error) {
              if (isSuspense(error)) {
                return error as never
              }
              throw error
            }
          },
          rerender,
          name: name!,
          abortOnUnmount,
        }),
      [frame, ...deps.map((dep) => props[dep])],
    )

    // useLayoutEffect (not useEffect): it runs synchronously during React's
    // commit phase, before the call stack unwinds and the JS engine drains
    // the microtask queue. A dependency with no real async I/O (e.g. a route
    // loader or a `computed(async () => ...)` with nothing to await) resolves
    // via pure microtasks and can finish -- updating the whole reactive graph
    // -- before a `useEffect`-scheduled `mount()` ever gets to subscribe.
    // `_render`'s own staleness flag is only set on a reactive recompute,
    // which requires an active subscriber, so a change that completes before
    // subscribing is missed forever and the component is stuck on its
    // pre-resolution render permanently. useLayoutEffect closes that race
    // window instead of narrowing it.
    React.useLayoutEffect(mount, [mount, ...deps.map((dep) => props[dep])])

    let { result } = render(props)
    if (isSuspense(result)) {
      // @ts-ignore it's ok
      if (React.use && result instanceof Promise) React.use(result)
      throw result
    }
    return result
  }

  Object.defineProperty(render, 'name', { value: name })

  if (isForwardRefComponent(Component)) {
    return React.forwardRef(render) as never
  }

  return render
}

/**
 * Creates a component with a per-instance init phase: `init` runs once per
 * mount (and again when a `deps` prop changes) to set up local atoms, effects,
 * and subscriptions, and returns the render function used for every subsequent
 * render.
 *
 * `init` receives `initProps` — the props captured at init time — while the
 * render function it returns receives `props`, the current props of every
 * render; both share the component's props type. To forward a ref, return a
 * `React.forwardRef(...)` component; the resulting component accepts a ref
 * directly, no outer `forwardRef` needed. A plain `(props, ref) => …` render
 * function is also accepted as a shorthand.
 *
 * @example
 *   const Counter = reatomFactoryComponent((initProps: { initial: number }) => {
 *     const count = atom(initProps.initial)
 *     return () => <div>{count()}</div>
 *   }, 'Counter')
 *
 * @example
 *   // The props type is annotated once on `initProps`; `props` and `ref` in
 *   // the returned render function are inferred from it.
 *   const Field = reatomFactoryComponent(
 *     (initProps: { initialValue: string; label: string }) => {
 *       const value = atom(initProps.initialValue)
 *       return React.forwardRef((props, ref) => (
 *         <label>
 *           {props.label}
 *           <input
 *             ref={ref}
 *             value={value()}
 *             onChange={(event) => value.set(event.target.value)}
 *           />
 *         </label>
 *       ))
 *     },
 *     'Field',
 *   )
 */
export let reatomFactoryComponent = <
  Props extends Rec = {},
  RefValue = unknown,
>(
  init: (
    initProps: Props,
    options: { name: string },
  ) =>
    | React.ForwardRefRenderFunction<RefValue, Props>
    | React.ForwardRefExoticComponent<Props & React.RefAttributes<RefValue>>,
  options?: string | { deps?: Array<string>; name?: string },
): React.ForwardRefExoticComponent<Props & React.RefAttributes<RefValue>> => {
  const deps = typeof options === 'object' ? (options.deps ?? []) : []
  const name =
    (typeof options === 'object' ? options.name : options) ||
    named('Component', init.name)

  type Instance = {
    controller: ReatomAbortController
    abort: Fn
    render: React.ForwardRefRenderFunction<RefValue, Props>
  }

  const factoryRender: React.ForwardRefRenderFunction<RefValue, Props> = (
    props,
    ref,
  ) => {
    const [, recreate] = React.useState(0)
    const box = React.useMemo(
      () => ({ instance: null as null | Instance }),
      deps.map((dep) => props[dep]),
    )

    if (!box.instance || box.instance.controller.signal.aborted) {
      const initAction = action(init, `${name}._init`).extend(withAbort())
      const rendered = initAction(props, { name })

      box.instance = {
        render: unwrapForwardRefRender(rendered),
        controller: abortVar.require(_read(initAction)!),
        abort: bind(initAction.abort),
      }
    }

    const { instance } = box

    useEffect(() => {
      if (instance.controller.signal.aborted) {
        recreate((s) => s + 1)
        return
      }
      return () => instance.abort()
    }, [instance])

    return instance.render(props, ref)
  }

  // `reatomComponent` returns the reactive render as a plain function that
  // already accepts a ref as its second argument. The factory always forwards
  // a ref, so wrap that render in `forwardRef` here instead of feeding a
  // pre-wrapped exotic through `reatomComponent`'s detection just to have it
  // unwrapped and re-wrapped.
  const reactiveRender = reatomComponent(
    factoryRender as (props: Props) => React.ReactNode,
    { deps, name, abortOnUnmount: false },
  )

  // `Props` and `PropsWithoutRef<Props>` differ only by the `ref` key, which
  // `forwardRef` strips anyway — TS cannot reconcile them over an open
  // generic, so bridge the two at this boundary.
  return React.forwardRef(
    reactiveRender as React.ForwardRefRenderFunction<
      RefValue,
      React.PropsWithoutRef<Props>
    >,
  ) as React.ForwardRefExoticComponent<Props & React.RefAttributes<RefValue>>
}
