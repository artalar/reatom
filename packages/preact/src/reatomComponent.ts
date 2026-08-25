import {
  _read,
  abortVar,
  action,
  assert,
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
import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'preact/hooks'

type ReatomComponentOptions =
  | string
  | {
      deps?: Array<string>
      name?: string
      abortOnUnmount?: boolean
    }

type ReatomFactoryComponentOptions<Props> =
  | string
  | {
      deps?: Array<keyof Props>
      name?: string
    }

type PreactRender<Props extends Rec> = (props: Props) => ComponentChildren

export let _getComponentDebugName = (fallback?: string): string => {
  let name = fallback
  return name || named('Component')
}

export let reatomContext = createContext<null | Frame>(null)

export let useFrame = (): Frame => {
  let frame = useContext(reatomContext) ?? STACK[0]

  assert(
    frame,
    'the root is not set, you probably forgot to specify the  provider',
    ReatomError,
  )

  return frame
}

export const useWrap = <Params extends unknown[], Payload>(
  callback: (...params: Params) => Payload,
  name?: string,
): ((...params: Params) => Payload) => {
  let frame = useFrame()

  let ref: {
    stableFn: (...args: Params) => Payload
    callback: (...args: Params) => Payload
  } = useMemo(
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

  useImmediateEffect(() => {
    ref.callback = callback
  })

  return ref.stableFn
}

let useImmediateEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect

export let isSuspense = (thing: unknown) =>
  thing instanceof Promise ||
  (thing instanceof Error && thing.message.startsWith('Suspense Exception'))

export let reatomComponent = <Props extends Rec = {}>(
  Component: PreactRender<Props>,
  options?: ReatomComponentOptions,
): PreactRender<Props> => {
  let deps: Array<string> = []
  let name: string | undefined
  let abortOnUnmount = false
  if (typeof options === 'object') {
    deps = options.deps ?? []
    name = options.name
    abortOnUnmount = options.abortOnUnmount ?? false
  } else {
    name = options
  }
  name ||= named('Component', Component.name)

  function render(props: Props): ComponentChildren {
    let frame = useFrame()

    let [, rerender] = useState({ result: null as ComponentChildren })

    let { render, mount } = useMemo(
      () =>
        reatomAbstractRender({
          frame,
          render(props: Props) {
            try {
              return Component(props)
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

    useEffect(mount, [mount, ...deps.map((dep) => props[dep])])

    let { result } = render(props)
    if (isSuspense(result)) throw result
    return result
  }

  Object.defineProperty(render, 'name', { value: name })

  return render
}

export let reatomFactoryComponent = <Props extends Rec = {}>(
  init: (
    initProps: Props,
    options: { name: string },
  ) => (props: Props) => ComponentChildren,
  options?: ReatomFactoryComponentOptions<Props>,
): PreactRender<Props> => {
  const deps = (
    typeof options === 'object' ? (options.deps ?? []) : []
  ) as Array<string>
  const name = typeof options === 'object' ? options.name : options

  type Instance = {
    controller: ReatomAbortController
    render: (props: Props) => ComponentChildren
  }

  const Component: PreactRender<Props> = reatomComponent(
    (props: Props): ComponentChildren => {
      const [, recreate] = useState(0)

      const initAction = useMemo(
        () => action(init, `${Component.name}._init`).extend(withAbort()),
        [],
      )

      const box = useMemo(
        () => ({ instance: null as null | Instance }),
        deps.map((dep) => props[dep]),
      )

      if (!box.instance || box.instance.controller.signal.aborted) {
        box.instance = {
          render: initAction(props, { name: Component.name }),
          controller: abortVar.require(_read(initAction)!),
        }
      }

      const { instance } = box

      useEffect(() => {
        if (instance.controller.signal.aborted) {
          recreate((s) => s + 1)
          return
        }
        return () => instance.controller.abort('unmount')
      }, [instance])

      return instance.render(props)
    },
    { deps, name, abortOnUnmount: false },
  )

  return Component
}
