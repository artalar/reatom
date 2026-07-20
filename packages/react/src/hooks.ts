import {
  action,
  type Atom,
  atom,
  type AtomLike,
  type AtomState,
  bind,
  type Computed,
  computed,
  type Frame,
  isAction,
  isAtom,
  notify,
  ReatomError,
} from '@reatom/core'
import React from 'react'
import { useSyncExternalStore } from 'react'

import { _getComponentDebugName, useFrame } from './reatomComponent'

export const useAtom: {
  <Target extends AtomLike>(
    target: Target,
    deps?: Array<any>,
    options?: { subscribe?: boolean },
  ): [
    AtomState<Target>,
    Target extends Atom<any, infer Params>
      ? (...args: Params) => AtomState<Target>
      : undefined,
    Target,
    Frame,
  ]

  <State>(
    computed: () => State,
    deps?: Array<any>,
    options?: string | { name?: string; subscribe?: boolean },
  ): [State, undefined, Computed<State>, Frame]

  <State>(
    initState: State,
    deps?: Array<any>,
    options?: string | { name?: string; subscribe?: boolean },
  ): [
    State,
    (value: State | ((prev: State) => State)) => State,
    Atom<State>,
    Frame,
  ]
} = (
  anAtom: any,
  userDeps: Array<any> = [],
  options: string | { name?: string; subscribe?: boolean } = '',
) => {
  const { name, subscribe = true } =
    typeof options === 'string' ? { name: options } : (options ?? {})
  const frame = useFrame()
  const deps: any[] = [frame]
  if (isAtom(anAtom)) deps.push(anAtom)

  const ref = React.useMemo(() => {
    const atomName = name ?? _getComponentDebugName(`useAtom#${typeof anAtom}`)
    const depsAtom = atom<any[]>([], `${atomName}._depsAtom`)
    let theAtom = anAtom
    if (!isAtom(theAtom)) {
      if (typeof anAtom === 'function') {
        theAtom = computed(() => {
          depsAtom()
          return ref.anAtom()
        }, atomName)
      } else {
        theAtom = atom(anAtom, atomName)
      }
    }

    const update =
      'set' in theAtom
        ? bind((...a: any[]) => {
            theAtom.set(...a)
            notify()
          }, frame)
        : undefined

    return {
      anAtom,
      depsAtom,
      theAtom,
      update,
      sub: bind((theAtom as AtomLike).subscribe, frame),
      get: bind(theAtom, frame),
    }
  }, deps)
  ref.anAtom = anAtom
  const { theAtom, depsAtom, update, sub, get } = ref

  if (typeof anAtom === 'function' && !isAtom(anAtom)) {
    const prevDeps = frame.run(depsAtom)
    if (
      userDeps.length !== prevDeps.length ||
      userDeps.some((dep, i) => !Object.is(dep, prevDeps[i]))
    ) {
      frame.run(depsAtom.set, userDeps)
    }
  }

  return [
    subscribe ? useSyncExternalStore(sub, get, get) : get(),
    update,
    theAtom,
    frame,
  ] as any
}

export const useAction = <Params extends any[] = any[], Payload = any>(
  target: (...params: Params) => Payload,
  deps: Array<any> = [],
  name?: string,
): ((...params: Params) => Payload) => {
  const frame = useFrame()
  deps.push(frame)
  if (isAction(target)) deps.push(target)
  else if (isAtom(target)) {
    throw new ReatomError('useAction expects an action, got an atom')
  }

  const ref = React.useMemo(() => {
    let theAction = target

    if (!isAction(target)) {
      theAction = action(
        // @ts-ignore
        (...a: any[]) => ref.target(...a),
        name ?? _getComponentDebugName(`useAction`),
      )
    }

    return { target, cb: bind(theAction, frame) }
  }, deps)

  if (!isAction(target)) {
    ;(
      React.useInsertionEffect ??
      (typeof document !== 'undefined'
        ? React.useLayoutEffect
        : React.useEffect)
    )(() => {
      ref!.target = target
    })
  }

  return ref.cb
}
