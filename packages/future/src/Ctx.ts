import { Ctx, Future, getInternal, getIsFuture, Ref } from './Future'
import { RunCtx } from './RunCtx'
import { callSafety, invalid } from './shared'
import { Fn, Key } from './types'

export function createCtx() {
  const _lifeCycleQueue: Fn[] = []

  const _links = new Map<Key, Ref>()

  const _listeners: Fn[] = []

  const ctx: Ctx = {
    subscribe,
    dispatch,
    getRef,
    links: _links,
  }

  function _link(target: Future<any, any>, dependent?: Future<any, any>) {
    const targetInternal = getInternal(target)

    let targetRef = getRef(targetInternal._key)

    if (targetRef === undefined) {
      _links.set(targetInternal._key, (targetRef = new Ref()))

      // init life cycle method must be called starts from parent to child
      targetInternal._deps.forEach(dep => _link(dep, target))

      if (targetInternal._init !== undefined) {
        _lifeCycleQueue.push(
          () =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (targetRef!.cleanup = targetInternal._init!(
              target,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              targetRef!.getCache,
              ctx,
            )),
        )
      }
    }

    if (dependent !== undefined) targetRef.links.push(dependent)

    return targetRef
  }

  function _unlink(target: Future<any, any>, dependent?: Future<any, any>) {
    const targetInternal = getInternal(target)

    const targetRef = getRef(targetInternal._key)

    if (targetRef !== undefined) {
      if (dependent !== undefined) {
        targetRef.links.splice(targetRef.links.indexOf(dependent), 1)
      }

      if (targetRef.isEmpty) {
        _links.delete(targetInternal._key)

        // cleanup life cycle method must be called starts from child to parent
        if (targetRef.cleanup) {
          _lifeCycleQueue.push(targetRef.cleanup)
        }

        targetInternal._deps.forEach(dep => _unlink(dep, target))
      }
    }
  }

  function _lifeCycle() {
    while (_lifeCycleQueue.length !== 0)
      // it will be good to catch an errors and do rollback of the linking
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      callSafety(_lifeCycleQueue.shift()!)
  }

  function subscribe<T>(cb: Fn<any>, target?: Future<any, T>): () => void {
    invalid(typeof cb !== 'function', 'callback (must be a function)')

    let isSubscribed = true

    if (target === undefined) {
      _listeners.push(cb)

      return function unsubscribe() {
        if (isSubscribed) {
          isSubscribed = false
          _listeners.splice(_listeners.indexOf(cb), 1)
        }
      }
    }

    invalid(!getIsFuture(target), 'target (must be Future)')

    const { listeners } = _link(target)

    listeners.push(cb)

    _lifeCycle()

    return function unsubscribe() {
      if (isSubscribed) {
        isSubscribed = false
        listeners.splice(listeners.indexOf(cb), 1)

        _unlink(target)

        _lifeCycle()
      }
    }
  }

  function getRef(targetKey: Key): Ref | undefined {
    return _links.get(targetKey)
  }

  function dispatch<I, O>(fn: Future<I, O>, input: I): RunCtx<Ctx, Future> {
    const runCtx = new RunCtx<Ctx, Future>(ctx)

    const { cache } = runCtx
    getInternal(fn)._lift(input, runCtx)

    fn(input, runCtx)

    cache.forEach((runCache, key) => {
      const ref = _links.get(key)

      if (ref) {
        // FIXME:
        // if (runCache.kind === 'error' && ref.listeners.length !== 0) doRollbackForAllCache()
        const { value } = runCache
        ref.listeners.forEach(cb => callSafety(cb, value))
      }
    })

    _listeners.forEach(cb => callSafety(cb, runCtx.cache))

    return runCtx
  }

  return ctx
}
