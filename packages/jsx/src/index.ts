import {
  _read,
  action,
  assert,
  atom,
  type AtomLike,
  bind,
  computed,
  type Fn,
  isAction,
  isAtom,
  isLinkedListAtom,
  isObject,
  type LinkedList,
  type LLNode,
  peek,
  ReatomError,
  type Rec,
  top,
  type Unsubscribe,
} from '@reatom/core'

import { clearJsxError, reportJsxError } from './error'
import {
  booleanAttributes,
  boundaries,
  type BoundaryHandle,
  DOM,
  jsxBoundary,
  jsxHName,
  jsxInlineStyles,
  metaSymbol,
  propertiesAsAttributes,
  stylesheet,
} from './global'
import type {
  AttributesAtomMaybe,
  FieldModelBinding,
  FormModelBinding,
  JSX,
  LinkedListJSXAtom,
} from './jsx'
import { reatomClassName } from './utils'

declare type JSXElement = JSX.Element

export type FC<Props = {}> = (
  props: Props & { children?: JSXElement },
) => JSXElement

export type { JSX, JSXElement }

export {
  findBoundary,
  jsxError,
  type JsxErrorPayload,
  type JsxErrorPhase,
} from './error'
export { DOM, stylesheet } from './global'
export { reatomClassName } from './utils'
export { instance } from '@reatom/core'

type DomApis = Pick<
  typeof window,
  | 'document'
  | 'Node'
  | 'Text'
  | 'Element'
  | 'MutationObserver'
  | 'HTMLElement'
  | 'HTMLInputElement'
  | 'DocumentFragment'
>

export let DEBUG = atom(true, 'jsx.DEBUG')

let jsxElementKey = (element: Node, key: string) =>
  `${jsxHName.current}.${element.nodeName.toLowerCase()}._${key}`

/** Named keys only when DEBUG is on; `''` skips `defineProperty` in createAtom. */
let jsxAtomKey = (element: Node, key: string) =>
  peek(DEBUG) ? jsxElementKey(element, key) : ''

/** Matches {@link isSkip} — actions with `._` in the name are omitted from logs. */
let noisyDomEvents = new Set([
  'dragover',
  'gesturechange',
  'mousemove',
  'mouseout',
  'mouseover',
  'pointermove',
  'pointerout',
  'pointerover',
  'pointerrawupdate',
  'scroll',
  'scrollsnapchanging',
  'touchmove',
  'wheel',
])

let eventActionName = (element: Node, eventKey: string, handler: Fn) => {
  let elementPart = element.nodeName.toLowerCase()
  let base = jsxHName.current
    ? `${jsxHName.current}.${elementPart}`
    : elementPart
  let segment =
    handler.name && handler.name !== `on:${eventKey}` ? handler.name : eventKey
  let hideFromLogs = noisyDomEvents.has(eventKey)
  return `${base}${hideFromLogs ? '._' : '.'}${segment}`
}

interface Meta {
  subscribes: (() => Unsubscribe)[]
  unsubscribes: Unsubscribe[]
  mount: ((element: Node) => ((element: Node) => void) | undefined) | undefined
  unmount: ((element: Node) => void) | undefined
  /**
   * Whether the node is currently connected. Keeps ref-only nodes mounted when
   * a DOM move reports both removal and addition (`unsubscribes.length` cannot
   * identify those nodes) and marks never-connected nodes so cleanup preserves
   * their subscribe thunks for a future append.
   */
  mounted: boolean
}
let ensureMeta = (node: Node): Meta => {
  return ((node as any)[metaSymbol()] ??= {
    subscribes: [],
    unsubscribes: [],
    mount: undefined,
    unmount: undefined,
    mounted: false,
  })
}
let unlink = (node: Node, subscribe: () => () => void) => {
  let meta = ensureMeta(node)
  meta.subscribes.push(subscribe)
  if (node.isConnected) meta.unsubscribes.push(subscribe())
}

let lifecycle = (phase: 'ref' | 'mount', node: Node, cb: () => void) => {
  try {
    cb()
  } catch (error) {
    reportJsxError(error, phase, node.nodeName.toLowerCase(), node)
  }
}

/**
 * Depth-first walk over the real DOM pointers. A visit may connect a
 * subscription that emits synchronously and rewrites the following content
 * (live fragment update, primitive Text upgrade), so the walk re-checks the
 * pointers after each visit: when the visited child was detached
 * (`replaceWith`), it resumes after the last child still in place, keeping the
 * replacement content and the following siblings in the traversal. Emissions
 * only rewrite content after their own node, so earlier siblings stay valid
 * anchors. (`NodeIterator` would give this liveness for free, but live
 * iterators tax every subsequent DOM mutation of the whole document.)
 */
let walkTree = (node: Node, visit: (node: Node) => void) => {
  visit(node)
  let prev: Node | null = null
  let child = node.firstChild
  while (child) {
    walkTree(child, visit)
    if (child.parentNode === node) prev = child
    child = prev ? prev.nextSibling : node.firstChild
  }
}

/**
 * Subscribe parent-first so boundaries exist before descendants initialize,
 * then mount refs child-first. Cleanup mirrors both orders below.
 */
let connectNode = (node: Node, symbol: symbol) => {
  let nodesToMount: Node[] = []
  walkTree(node, (visited) => {
    let meta = (visited as any)[symbol] as Meta | undefined
    if (!meta) return

    if (meta.unsubscribes.length === 0) {
      for (let subscribe of meta.subscribes) {
        lifecycle('mount', visited, () => meta.unsubscribes.push(subscribe()))
      }
    }
    if (!meta.mounted) nodesToMount.push(visited)
  })

  for (let i = nodesToMount.length - 1; i >= 0; i--) {
    let node = nodesToMount[i]!
    let meta = (node as any)[symbol] as Meta | undefined
    // The `mounted` re-check dedupes nodes queued twice by a mid-walk restart.
    if (!meta || meta.mounted) continue

    meta.mounted = true
    lifecycle('ref', node, () => {
      let unmount = meta.mount?.(node)
      if (typeof unmount === 'function') meta.unmount = unmount
    })
  }
}

/**
 * Unmount refs parent-first, then unsubscribe the batch in reverse DOM order.
 * This mirrors normal parent-first registration so shared core pubs can use
 * their `pub.subs.pop()` path.
 */
let cleanupNodes = (nodes: Node[], symbol: symbol) => {
  let metaNodes: Node[] = []
  for (let node of nodes) {
    walkTree(node, (visited) => {
      let meta = (visited as any)[symbol] as Meta | undefined
      if (!meta) return

      metaNodes.push(visited)
      if (meta.unmount) {
        lifecycle('ref', visited, () => meta.unmount!(visited))
        meta.unmount = undefined
      }
    })
  }

  for (let i = metaNodes.length - 1; i >= 0; i--) {
    let node = metaNodes[i]!
    let meta = (node as any)[symbol] as Meta | undefined
    if (!meta) continue

    // A node that was never connected (appended and removed in the same tick,
    // or fresh content inside a removed ancestor) keeps its subscribe thunks
    // for a future append.
    if (!meta.mounted && meta.unsubscribes.length === 0) continue

    for (let j = meta.unsubscribes.length - 1; j >= 0; j--) {
      lifecycle('mount', node, meta.unsubscribes[j]!)
    }

    meta.unsubscribes = []
    // Truly detached nodes are inert if re-appended and release render captures.
    meta.subscribes = []
    meta.mounted = false
  }
}

let isSkipped = (value: unknown): value is boolean | '' | null | undefined =>
  typeof value === 'boolean' || value === '' || value == null

/**
 * @see https://www.measurethat.net/Benchmarks/Show/13274
 * @todo Explore adding elements to a DocumentFragment before adding them to a
 *   Document.
 */
let walk = (
  dom: DomApis,
  element: JSX.Element | DocumentFragment,
  children: JSX.DOMAttributes<JSX.Element>['children'],
) => {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) walk(dom, element, children[i])
  } else if (isLinkedListAtom(children)) {
    walkLinkedList(dom, element as JSX.Element, children as any)
  } else if (isAtom(children)) {
    element.append(walkAtom(dom, children as AtomLike<JSX.ElementChildren>))
  } else if (typeof children === 'function') {
    walk(
      dom,
      element,
      computed(children as () => any, jsxAtomKey(element, 'children')),
    )
  } else if (!isSkipped(children)) {
    element.append(children as Node | string)
  }
}

/** Non-skipped string/number/bigint — safe for a single Text node (no markers). */
let isPrimitiveText = (value: unknown): value is string | number | bigint =>
  (typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint') &&
  !isSkipped(value)

let walkAtom = (dom: DomApis, anAtom: AtomLike<JSX.ElementChildren>): Node => {
  let state: JSX.ElementChildren
  try {
    state = peek(anAtom)
  } catch (error) {
    return walkAtomFragment(dom, anAtom, undefined, error)
  }

  /**
   * Fast path for label-like atoms: one Text node instead of a live fragment
   * with comment markers. Only when the _initial_ value is a non-skipped
   * primitive — skipped values (boolean / '' / null / undefined) and complex
   * children keep the fragment path for correct empty/marker semantics.
   */
  if (isPrimitiveText(state)) {
    let textNode = dom.document.createTextNode(String(state))
    let marked: Element | undefined
    let onError = (error: unknown) => {
      marked = reportJsxError(error, 'children', anAtom.name, textNode)
    }

    unlink(textNode, () =>
      anAtom.subscribe((newState) => {
        marked = clearJsxError(marked)
        if (Object.is(state, (state = newState))) return
        if (
          typeof newState === 'string' ||
          typeof newState === 'number' ||
          typeof newState === 'bigint'
        ) {
          textNode.data = String(newState)
        } else if (isSkipped(newState)) {
          textNode.data = ''
        } else {
          // Upgrade to the live-fragment path: complex children (elements,
          // arrays, nested atoms) need markers and full `walk` rendering.
          // Replacing the Text node lets the MutationObserver tear down this
          // subscription and connect the fragment's one; the fragment renders
          // `newState` eagerly, so nothing is missed in between.
          textNode.replaceWith(walkAtomFragment(dom, anAtom, newState))
        }
      }, onError),
    )

    return textNode
  }

  return walkAtomFragment(dom, anAtom, state)
}

let walkAtomFragment = (
  dom: DomApis,
  anAtom: AtomLike<JSX.ElementChildren>,
  state?: JSX.ElementChildren,
  peekError?: unknown,
): LiveDocumentFragment => {
  let fragment = createLiveFragment(dom, anAtom.name)
  let { start, end, update } = fragment.__reatomFragment
  let marked: Element | undefined

  let onError = (error: unknown) => {
    marked = reportJsxError(error, 'children', anAtom.name, start)
  }

  /**
   * Render the current state eagerly while the fragment is detached, so the
   * whole tree (including nested reactive children) is built before `mount`
   * appends it, avoiding a wave of live-DOM insertions per nesting level.
   * `update` cannot be used here: `start.after(fragment)` would insert the
   * fragment into itself, so the content goes through a buffer instead. Reads
   * that throw (suspense Promise, abort, errors) leave the fragment empty; the
   * error is reported and a boundary may render a fallback.
   */
  if (peekError !== undefined) {
    onError(peekError)
  } else {
    try {
      if (state === undefined) state = peek(anAtom)
      let initialContent = dom.document.createDocumentFragment()
      walk(dom, initialContent, state)
      end.before(initialContent)
    } catch (error) {
      onError(error)
    }
  }

  /**
   * `subscribe` emits synchronously on every (re)connect. Skipping states that
   * match the last rendered one covers both the first mount (eagerly rendered
   * above) and re-append of an unchanged node, while a state changed while
   * disconnected still re-renders.
   */
  unlink(start, () =>
    anAtom.subscribe((newState) => {
      marked = clearJsxError(marked)
      if (!Object.is(state, (state = newState))) update(newState)
    }, onError),
  )

  return fragment
}

let walkLinkedList = (
  dom: DomApis,
  element: JSX.Element,
  list: LinkedListJSXAtom,
) => {
  let lastVersion = -1

  let cb = (state: LinkedList<LLNode<JSX.Element>>) => {
    if (state.version - 1 > lastVersion) {
      element.innerHTML = ''
      let rebuildBatch = dom.document.createDocumentFragment()
      for (let head = state.head; head; head = head[state.LL_NEXT] ?? null) {
        throwNativeFragment(head)
        rebuildBatch.append(head)
      }
      element.append(rebuildBatch)
    } else {
      let appendBatch: undefined | DocumentFragment
      for (let change of state.changes) {
        if (change.kind === 'create') {
          throwNativeFragment(change.node)

          appendBatch ??= dom.document.createDocumentFragment()

          appendBatch.append(change.node)
        } else if (change.kind === 'createMany') {
          appendBatch ??= dom.document.createDocumentFragment()

          for (let node of change.nodes) {
            throwNativeFragment(node)
            appendBatch.append(node)
          }
        } else if (appendBatch) {
          element.append(appendBatch)
          appendBatch = undefined
        }

        if (change.kind === 'remove') {
          if (isLiveFragment(change.node)) {
            let fragment = change.node.__reatomFragment
            fragment.update()
            fragment.start.remove()
            fragment.end.remove()
          } else {
            element.removeChild(change.node)
          }
        } else if (change.kind === 'removeMany') {
          for (let node of change.nodes) {
            if (isLiveFragment(node)) {
              let fragment = node.__reatomFragment
              fragment.update()
              fragment.start.remove()
              fragment.end.remove()
            } else {
              element.removeChild(node)
            }
          }
        }
        // TODO support fragments
        else if (change.kind === 'swap') {
          let [aNext, bNext] = [change.a.nextSibling, change.b.nextSibling]
          if (bNext) {
            element.insertBefore(change.a, bNext)
          } else {
            element.append(change.a)
          }

          if (aNext) {
            element.insertBefore(change.b, aNext)
          } else {
            element.append(change.b)
          }
        }
        // TODO support fragments
        else if (change.kind === 'move') {
          if (change.after) {
            change.after.insertAdjacentElement('afterend', change.node)
          } else {
            element.prepend(change.node)
          }
        } else if (change.kind === 'clear') {
          element.innerHTML = ''
        }
      }

      if (appendBatch) element.append(appendBatch)
    }
    lastVersion = state.version
  }

  unlink(element, () =>
    list.subscribe((state) => cb(state as LinkedList<LLNode<JSX.Element>>)),
  )

  // check if change hook wasn't called by initialization
  if (lastVersion === -1) cb(peek(list) as LinkedList<LLNode<JSX.Element>>)
}

interface LiveDocumentFragment extends DocumentFragment {
  __reatomFragment: {
    start: Comment
    end: Comment
    update: (children?: JSX.ElementChildren) => void
  }
}

let isLiveFragment = (node: Node): node is LiveDocumentFragment =>
  !!node && '__reatomFragment' in node

let throwNativeFragment = (element: JSX.Element) => {
  // Elements (nodeType 1) are never native fragments — skip assert in createMany.
  if (element.nodeType === 1) return
  assert(
    // DocumentFragment.nodeType === 11; avoid String(element) allocation
    element.nodeType !== 11 || '__reatomFragment' in element,
    'native fragment is not supported',
    ReatomError,
  )
}

let createLiveFragment = (dom: DomApis, name: string): LiveDocumentFragment => {
  let fragment = dom.document.createDocumentFragment() as LiveDocumentFragment
  let start = dom.document.createComment(name)
  let end = start.cloneNode() as Comment
  let marked: Element | undefined
  let update = (children?: JSX.ElementChildren) => {
    if (start.nextSibling && start.nextSibling !== end) {
      let staleRange = dom.document.createRange()
      staleRange.setStartAfter(start)
      staleRange.setEndBefore(end)
      staleRange.deleteContents()
    }

    try {
      walk(dom, fragment, children)
      start.after(fragment)
      marked = clearJsxError(marked)
    } catch (error) {
      marked = reportJsxError(error, 'children', name, start)
    }
  }
  fragment.__reatomFragment = {
    start,
    end,
    update,
  }
  fragment.append(start, end)
  return fragment
}

type RefCallback = (
  element: Node,
) => void | ((element: Node) => void) | undefined

let setProps = (dom: DomApis, element: JSX.Element, props: Rec) => {
  let fieldUserRef =
    props['model:field'] != null && typeof props.ref === 'function'
      ? (props.ref as RefCallback)
      : undefined

  for (let key in props) {
    if (key === 'ref' && fieldUserRef !== undefined) continue
    if (key === 'model:field') {
      bindFieldModel(dom, element, props[key], fieldUserRef)
      continue
    }
    setProp(dom, element, key, props[key])
  }
}

let bindFormModel = (
  dom: DomApis,
  element: JSX.Element,
  form: FormModelBinding,
) => {
  let el = element as HTMLElement
  setProp(dom, element, 'on:submit', (event: Event) => {
    event.preventDefault()
    form.submit()
  })

  let sync = () => {
    let submitting = !form.submit.ready()
    el.toggleAttribute('data-submitting', submitting)
    el.classList.toggle('is-submitting', submitting)
    let submitted = form.submitted()
    el.toggleAttribute('data-submitted', submitted)
    el.classList.toggle('is-submitted', submitted)
    let hasError = !!form.submit.error()
    el.toggleAttribute('data-submit-error', hasError)
    el.classList.toggle('has-submit-error', hasError)
  }
  unlink(element, () => {
    let un1 = form.submit.ready.subscribe(sync)
    let un2 = form.submitted.subscribe(sync)
    let un3 = form.submit.error.subscribe(sync)
    return () => {
      un1()
      un2()
      un3()
    }
  })
  sync()
}

let bindFieldModel = (
  dom: DomApis,
  element: JSX.Element,
  field: FieldModelBinding,
  userRef?: RefCallback,
) => {
  let value = peek(field.value)
  let kind =
    typeof value === 'boolean'
      ? 'checkbox'
      : typeof value === 'number'
        ? 'number'
        : 'text'

  if (element instanceof dom.HTMLInputElement) {
    if (kind === 'checkbox') set(dom, element, 'attr:type', 'checkbox')
    else if (kind === 'number') set(dom, element, 'attr:type', 'number')
  }

  setProp(dom, element, 'on:input', (event: Event) => {
    let target = event.target as HTMLInputElement
    if (target.validity?.badInput) return
    if (kind === 'checkbox') field.change(target.checked)
    else if (kind === 'number') {
      let num = target.valueAsNumber
      field.change(Number.isNaN(num) ? undefined : num)
    } else field.change(target.value)
  })
  setProp(dom, element, 'on:blur', field.focus.out)
  setProp(dom, element, 'on:focus', field.focus.in)

  unlink(element, () =>
    field.value.subscribe((val) =>
      kind === 'checkbox'
        ? set(dom, element, 'checked', val)
        : set(dom, element, 'value', val == null ? '' : val),
    ),
  )
  unlink(element, () =>
    field.disabled.subscribe((disabled) =>
      set(dom, element, 'prop:disabled', disabled),
    ),
  )

  ensureMeta(element).mount = () => {
    field.elementRef.set(element as HTMLElement)
    let userCleanup = userRef?.(element)
    return (el) => {
      field.elementRef.set(undefined)
      if (typeof userCleanup === 'function') userCleanup(el)
    }
  }
}

/**
 * @todo Show warning if isAction(value).
 *
 * @todo Revert previous value.
 */
let bindSpread = (dom: DomApis, element: JSX.Element, value: any) => {
  let isReactive = typeof value === 'function' || isAtom(value)
  if (!isReactive) {
    setProps(dom, element, value)
    return
  }

  let stale: Unsubscribe[] = []
  let dispose = () => {
    for (let i = stale.length - 1; i >= 0; i--) stale[i]!()
    stale = []
  }
  /**
   * `unlink` is the only writer of the meta arrays, so everything appended
   * during `setProps` belongs to the current spread record: the subscribe
   * thunks are dropped (this subscription is the single re-entry point on
   * reconnect) and the unsubscribes are taken over to be disposed before the
   * next record is applied. Nested spreads splice their own additions first,
   * leaving only their subscription for the parent to own — disposal cascades.
   */
  let marked: Element | undefined
  let spread = (val: any) => {
    marked = clearJsxError(marked)
    dispose()
    let { subscribes, unsubscribes } = ensureMeta(element)
    let subscribesCount = subscribes.length
    let unsubscribesCount = unsubscribes.length
    setProps(dom, element, val)
    subscribes.length = subscribesCount
    stale = unsubscribes.splice(unsubscribesCount)
  }
  unlink(element, () => {
    let source = isAtom(value)
      ? value
      : computed(value, jsxAtomKey(element, '$spread'))
    let unsubscribe = source.subscribe(spread, (error) => {
      marked = reportJsxError(
        error,
        'prop',
        jsxElementKey(element, '$spread'),
        element,
      )
    })
    return () => {
      dispose()
      unsubscribe()
    }
  })
}

let setProp = (dom: DomApis, element: JSX.Element, key: string, value: any) => {
  if (key === 'children' || key === 'element' || value === undefined) return

  /**
   * @todo Show warning if isAtom(value) && !isAction(value).
   *
   * @todo Convert to named action.
   */
  if (key === 'ref') {
    ensureMeta(element).mount = () => value(element)
    return
  }

  /** @todo Show warning if isAtom(value) && !isAction(value). */
  if (key.startsWith('on:')) {
    key = key.slice(3)
    let debug = peek(DEBUG)
    let actionName = debug ? eventActionName(element, key, value) : key
    let onEventError = (error: unknown) =>
      reportJsxError(error, 'event', actionName, element)
    let run = (event: Event) => {
      try {
        let result = (value as (event: Event) => unknown)(event)
        ;(result as PromiseLike<unknown>)?.then?.(undefined, onEventError)
        return result
      } catch (error) {
        onEventError(error)
        throw error
      }
    }
    // Bind to the root frame — not `top()`. Row render often runs inside
    // `reatomMap`'s computed; capturing that frame would pin its pre-`_copy`
    // state (createMany `nodes` / head→tail) for as long as the listener
    // lives, which is the 25_run-clear-memory leak.
    let rootFrame = top().root.frame
    let listener = debug
      ? bind(action(run, actionName), rootFrame)
      : bind(run, rootFrame)
    /**
     * The immediate registration keeps listeners working before the first
     * mount; re-adding an identical listener on (re)connect is a no-op per the
     * DOM spec, so `unlink` here matters only for the removal side — it lets
     * `$spread` re-application and unmount dispose stale handlers.
     */
    element.addEventListener(key, listener)
    unlink(element, () => {
      element.addEventListener(key, listener)
      return () => element.removeEventListener(key, listener)
    })
    return
  }

  if (key === '$spread') {
    bindSpread(dom, element, value)
    return
  }

  let marked: Element | undefined
  let onPropError = (error: unknown) => {
    marked = reportJsxError(error, 'prop', jsxElementKey(element, key), element)
  }
  let setter = (val: unknown) => {
    try {
      set(dom, element, key, val)
      marked = clearJsxError(marked)
    } catch (error) {
      onPropError(error)
    }
  }

  if (key === 'class' || key === 'className') {
    if (typeof value === 'object' || typeof value === 'function') {
      unlink(element, () =>
        reatomClassName(value).subscribe(setter, onPropError),
      )
    } else {
      setter(value)
    }
    return
  }

  if (key === 'model' && element.nodeName.toUpperCase() === 'FORM') {
    bindFormModel(dom, element, value)
    return
  }

  if (key.startsWith('model:')) {
    key = key.slice(6)
    setProp(dom, element, 'on:input', (event: any) => {
      if (!event.target.validity.badInput) {
        let val = event.target[key]
        value.set(val == null || Number.isNaN(val) ? undefined : val)
      }
    })
  }

  if (isAtom(value) && !isAction(value)) {
    unlink(element, () => value.subscribe(setter, onPropError))
  } else if (typeof value === 'function') {
    unlink(element, () =>
      computed(value, jsxAtomKey(element, key)).subscribe(setter, onPropError),
    )
  } else {
    setter(value)
  }
}

let set = (dom: DomApis, element: JSX.Element, key: string, value: any) => {
  if (key.startsWith('css:')) {
    setStyleProp(
      element.style,
      '--' + key.slice(4),
      value == null ? value : String(value),
    )
  } else if (key === 'css') {
    /** @todo Should support record? */
    let styleId = jsxInlineStyles.ids[value]
    if (!styleId) {
      styleId = jsxInlineStyles.ids[value] = '_' + ++jsxInlineStyles.count
      // TODO improve stylesheet get for perf reason
      // TODO measure the needness of batching
      stylesheet().insertRule(`[data-reatom-style="${styleId}"]{${value}}`)
    }

    /** @see https://measurethat.net/Benchmarks/Show/11819 */
    element.setAttribute('data-reatom-style', styleId)
  } else if (key === 'style') {
    if (isObject(value)) {
      for (let key in value) setStyleProp(element.style, key, value[key])
    } else if (typeof value === 'string') {
      element.style.cssText = value
    } else {
      element.removeAttribute('style')
    }
  } else if (key.startsWith('style:')) {
    setStyleProp(element.style, key.slice(6), value)
  } else if (key.startsWith('prop:')) {
    // @ts-expect-error
    element[key.slice(5)] = value
  } else if (
    !propertiesAsAttributes.has(key) &&
    element instanceof dom.HTMLElement &&
    (key in element || key === 'class')
  ) {
    /**
     * @see https://measurethat.net/Benchmarks/Show/54
     * @see https://measurethat.net/Benchmarks/Show/31249
     */
    if (key === 'class') key = 'className'
    /** @note element.valueAsNumber = '' // element.value === '0' */ else if (
      key === 'valueAsNumber'
    )
      key = 'value'

    // TODO this is the most slow part
    /** @note element.valueAsDate = '' // Uncaught TypeError: Failed to convert value to 'object'. */
    // @ts-ignore
    element[key] = value == null && key !== 'valueAsDate' ? '' : value
  } else {
    if (key === 'className') key = 'class'
    else if (key.startsWith('attr:')) key = key.slice(5)

    /**
     * @note aria- and data- attributes have no boolean representation.
     * A `false` value is different from the attribute not being
     * present, so we can't remove it. For non-boolean aria
     * attributes we could treat false as a removal, but the
     * amount of exceptions would cost too many bytes. On top of
     * that other frameworks generally stringify `false`.
     */
    let isBool = booleanAttributes.has(key)
    if (value == null || (isBool && value === false))
      element.removeAttribute(key)
    else element.setAttribute(key, isBool && value === true ? '' : value)
  }
}

let setStyleProp = (
  style: CSSStyleDeclaration,
  key: string,
  value: any,
): void => {
  if (value == null) style.removeProperty(key)
  else style.setProperty(key, value)
}

export let h = (tag: any, props: Rec, ...children: any[]): JSX.Element => {
  let dom = _read(DOM)?.state ?? peek(DOM)

  if (isAtom(tag)) {
    // FIXME we need types refactoring
    return walkAtom(dom, tag) as any
  }

  if (tag === hf) {
    // needed for `walkLinkedList`
    let fragment = createLiveFragment(dom, '')
    walk(dom, fragment, children)
    fragment.append(fragment.__reatomFragment.end)
    // FIXME we need types refactoring
    return fragment as any
  }

  props ??= {}

  let element: JSX.Element

  if (typeof tag === 'function') {
    if (children.length) {
      props.children = children
    }

    if (tag === Bind) {
      element = props.element
      props.element = undefined
    } else {
      let prev = jsxHName.current
      try {
        jsxHName.current = tag.name
        return tag(props)
      } finally {
        jsxHName.current = prev
      }
    }
  } else {
    element = tag.startsWith('svg:')
      ? dom.document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
      : dom.document.createElement(tag)

    // For debug
    if (jsxHName.current && peek(DEBUG))
      element.setAttribute('data-reatom-name', jsxHName.current)
  }

  if ('children' in props) children = props.children

  setProps(dom, element, props)

  walk(dom, element, children)

  return element
}

/**
 * Fragment.
 *
 * @todo Describe a function as a component.
 */
export let hf = () => {}

export let mount = (
  target: Element,
  child: Element,
): { unmount: Unsubscribe } => {
  let dom = DOM()
  let symbol = metaSymbol()

  /**
   * @note A DOM move (insertBefore/append of an already-attached node) creates
   * two mutations: deletion then addition. After records are delivered the node
   * is already `isConnected`, so we skip teardown/resubscribe and keep atom
   * subscriptions alive (critical for linked-list swap/move).
   */
  let processMutations = (mutationsList: MutationRecord[]) => {
    let removedNodes: Node[] = []
    for (let mutation of mutationsList) {
      for (let removedNode of mutation.removedNodes) {
        if (!removedNode.isConnected) removedNodes.push(removedNode)
      }
    }
    cleanupNodes(removedNodes, symbol)

    for (let mutation of mutationsList) {
      mutation.addedNodes.forEach((addedNode) => {
        // Skip nodes that were appended and removed within the same batch:
        // they never really appeared, so connecting them would run orphan
        // ref hooks and leak subscriptions with no removal record to come.
        if (addedNode.isConnected) connectNode(addedNode, symbol)
      })
    }
  }
  let observer = new dom.MutationObserver(bind(processMutations))
  observer.observe(target.parentElement!, {
    childList: true,
    subtree: true,
  })

  // TODO fix
  // target.append(...[child].flat(Infinity))
  target.append(child)

  return {
    unmount: bind(() => {
      processMutations(observer.takeRecords())
      observer.disconnect()
      cleanupNodes([child], symbol)
      child.remove()
    }),
  }
}

/**
 * This simple utility needed only for syntax highlighting and it just
 * concatenates all passed strings. Falsy values are ignored, except for `0`.
 */
export let css = (strings: TemplateStringsArray, ...values: any[]) => {
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i] + (values[i] || values[i] === 0 ? values[i] : '')
  }
  return result
}

export let Bind = <T extends Element>(
  props: { element: T } & AttributesAtomMaybe<
    Partial<Omit<T, 'children'>> & JSX.DOMAttributes<T>
  >,
): T => props.element

export interface ErrorBoundaryProps {
  fallback: (error: unknown, retry: () => void) => JSX.ElementChildren
  pending?: JSX.ElementChildren
  onError?: (error: unknown) => void
  children?: JSX.ElementChildren
}

/**
 * Catches reactive render errors (and construction errors from lazy children)
 * inside its range. Boundary ownership follows the node's current DOM position,
 * so an element created elsewhere and later inserted under this boundary is
 * adopted automatically.
 *
 * Prefer lazy children `{() => <Child />}` so construction-time throws are
 * caught; eagerly created element children ran before this component.
 */
export let ErrorBoundary = (props: ErrorBoundaryProps): JSX.Element => {
  let failure = atom<null | { error: unknown }>(null, 'jsx.ErrorBoundary')
  let retry = action(() => failure.set(null), 'jsx.ErrorBoundary.retry')

  let handle: BoundaryHandle = {
    start: undefined!,
    end: undefined!,
    catch(error: unknown) {
      props.onError?.(error)
      if (error instanceof Promise) {
        // Ignore settles of a promise that is no longer the current failure.
        error.then(
          bind(() => failure()?.error === error && retry()),
          bind(
            (reason: unknown) =>
              failure()?.error === error && handle.catch(reason),
          ),
        )
      }
      failure.set({ error })
    },
  }

  if (
    peek(DEBUG) &&
    props.children != null &&
    typeof props.children !== 'function' &&
    !isAtom(props.children)
  ) {
    console.warn(
      'ErrorBoundary: prefer lazy children `{() => <Child />}` so construction-time errors are caught',
    )
  }

  let content = computed(() => {
    if (!failure()) {
      let prev = jsxBoundary.current
      jsxBoundary.current = handle
      try {
        let children = props.children
        let result =
          typeof children === 'function'
            ? (children as () => JSX.ElementChildren)()
            : children
        // Nested walkAtom may have reported into this boundary during the call.
        if (!failure()) return result
      } catch (error) {
        // `jsxBoundary.current` is still `handle` here, so this both tracks
        // the error and delivers it to this boundary.
        reportJsxError(error, 'children', 'ErrorBoundary')
      } finally {
        jsxBoundary.current = prev
      }
    }
    let current = failure()
    if (!current) return undefined
    return current.error instanceof Promise
      ? props.pending
      : props.fallback(current.error, retry)
  }, 'jsx.ErrorBoundary.content')

  let dom = _read(DOM)?.state ?? peek(DOM)
  let node = walkAtom(dom, content)
  let fragment: LiveDocumentFragment
  if (isLiveFragment(node)) {
    fragment = node
  } else {
    // Boundary range needs comment markers; wrap Text (or other) fast-path nodes.
    fragment = createLiveFragment(dom, 'jsx.ErrorBoundary')
    fragment.__reatomFragment.end.before(node)
  }
  handle.start = fragment.__reatomFragment.start
  handle.end = fragment.__reatomFragment.end
  unlink(handle.start, () => {
    boundaries.add(handle)
    return () => boundaries.delete(handle)
  })

  return fragment as unknown as JSX.Element
}
