import {
  _createGlobal,
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
  type Unsubscribe,
  wrap,
} from '@reatom/core'

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

export let DOM = atom(globalThis.window, 'jsx.DOM')

export let DEBUG = atom(true, 'jsx.DEBUG')

let jsxInlineStyles = _createGlobal('jsx_inlineStylesRegistry', () => ({
  count: 0,
  ids: {} as Rec<string>,
}))
/**
 * @note Create style tag for support oldest browser.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets
 * @see https://measurethat.net/Benchmarks/Show/5920
 */
export let stylesheet = _createGlobal('jsx_stylesheet', () => {
  let target = atom(
    () =>
      DOM().document.head.appendChild(DOM().document.createElement('style'))
        .sheet!,
  )
  return Object.assign(() => peek(target), { set: target.set })
})
let jsxHName = _createGlobal('jsx_hCurrentName', () => ({ current: '' }))
let jsxElementKey = (element: Node, key: string) =>
  `${jsxHName.current}.${element.nodeName.toLowerCase()}._${key}`

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
}
let metaSymbol = _createGlobal('jsx_metaSymbolAtomSlot', () => {
  let target = atom(() => Symbol(), 'jsx.metaSymbol')
  return () => peek(target)
})
let ensureMeta = (node: Node): Meta => {
  return ((node as any)[metaSymbol()] ??= {
    subscribes: [],
    unsubscribes: [],
    mount: undefined,
    unmount: undefined,
  })
}
let unlink = (node: Node, subscribe: () => () => void) => {
  let meta = ensureMeta(node)
  meta.subscribes.push(subscribe)
  if (node.isConnected) meta.unsubscribes.push(subscribe())
}

/**
 * @see https://github.com/preactjs/preact/blob/d16a34e275e31afd6738a9f82b5ba2fb9dbf032b/src/diff/props.js#L107
 * @see https://www.measurethat.net/Benchmarks/Show/7818
 */
let propertiesAsAttributes = _createGlobal(
  'jsx_propertiesAsAttributes',
  () =>
    new Set<string>([
      /** Numeric attributes with a default value other than 0. */
      'height',
      'high',
      'low',
      'optimum',
      'results',
      'size',
      'span',
      'start',
      'width',

      /** Numeric properties with a default value other than 0. */
      // 'colspan',
      // 'rowspan',
      // 'maxlength',
      // 'minlength',
      // 'tabindex',

      /** Properties with value HTMLElement. */
      'form',
      'list',

      /** Setting the value to an empty string must be explicit. */
      'download',
      'href',
      'role',
    ]),
)
/** @see https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML */
let booleanAttributes = _createGlobal(
  'jsx_booleanAttributes',
  () =>
    new Set<string>([
      'allowfullscreen',
      'allowpaymentrequest',
      'async',
      'attributionsrc',
      'autofocus',
      'autoplay',
      'browsingtopics',
      'capture',
      'checked',
      'compact',
      'controls',
      'credentialless',
      'crossorigin',
      'declare',
      'default',
      'defer',
      'disabled',
      'disablepictureinpicture',
      'disableremoteplayback',
      'formnovalidate',
      'hidden',
      'inert',
      'ismap',
      'itemscope',
      'loop',
      'multiple',
      'muted',
      'nomodule',
      'novalidate',
      'open',
      'playsinline',
      'readonly',
      'required',
      'reversed',
      'scoped',
      'selected',
      'shadowrootclonable',
      'shadowrootdelegatesfocus',
      'shadowrootserializable',
      'virtualkeyboardpolicy',
      'webkitdirectory',
    ]),
)

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
      computed(children as () => any, jsxElementKey(element, 'children')),
    )
  } else if (!isSkipped(children)) {
    element.append(children as Node | string)
  }
}

let walkAtom = (
  dom: DomApis,
  anAtom: AtomLike<JSX.ElementChildren>,
): DocumentFragment => {
  let fragment = createLiveFragment(dom, anAtom.name)
  let { start, end, update } = fragment.__reatomFragment

  /**
   * Render the current state eagerly while the fragment is detached, so the
   * whole tree (including nested reactive children) is built before `mount`
   * appends it, avoiding a wave of live-DOM insertions per nesting level.
   * `update` cannot be used here: `start.after(fragment)` would insert the
   * fragment into itself, so the content goes through a buffer instead. Reads
   * that throw (suspense Promise, abort, errors) fall back to the lazy behavior
   * — the fragment stays empty until the subscription renders it.
   */
  let state = peek(anAtom)
  let initialContent = dom.document.createDocumentFragment()
  walk(dom, initialContent, state)
  end.before(initialContent)

  /**
   * `subscribe` emits synchronously on every (re)connect. Skipping states that
   * match the last rendered one covers both the first mount (eagerly rendered
   * above) and re-append of an unchanged node, while a state changed while
   * disconnected still re-renders.
   */
  unlink(start, () =>
    anAtom.subscribe(
      (newState) => Object.is(state, (state = newState)) || update(newState),
    ),
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
  if (lastVersion === -1) cb(list() as LinkedList<LLNode<JSX.Element>>)
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
  assert(
    // TODO improve perf
    String(element) !== '[object DocumentFragment]' ||
      '__reatomFragment' in element,
    'native fragment is not supported',
    ReatomError,
  )
}

let createLiveFragment = (dom: DomApis, name: string): LiveDocumentFragment => {
  let fragment = dom.document.createDocumentFragment() as LiveDocumentFragment
  let start = dom.document.createComment(name)
  let end = start.cloneNode() as Comment
  let update = (children?: JSX.ElementChildren) => {
    if (start.nextSibling && start.nextSibling !== end) {
      let staleRange = dom.document.createRange()
      staleRange.setStartAfter(start)
      staleRange.setEndBefore(end)
      staleRange.deleteContents()
    }

    walk(dom, fragment, children)
    start.after(fragment)
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
  let value = field.value()
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
  let spread = (val: any) => {
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
      : computed(value, jsxElementKey(element, '$spread'))
    let unsubscribe = source.subscribe(spread)
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
    let listener = wrap(
      // only for logging purposes
      action(value as () => void, eventActionName(element, key, value)),
    )
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

  let setter = (val: any) => set(dom, element, key, val)

  if (key === 'class' || key === 'className') {
    if (typeof value === 'object' || typeof value === 'function') {
      unlink(element, () => reatomClassName(value).subscribe(setter))
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
    unlink(element, () => value.subscribe(setter))
  } else if (typeof value === 'function') {
    unlink(element, () =>
      computed(value, jsxElementKey(element, key)).subscribe(setter),
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
   * Teardown is the LIFO mirror of mount, which subscribes in a forward pass
   * (parents first) and runs mount hooks in a backward pass (children first).
   * So unmount hooks run forward (parents first, while children are still alive
   * — same contract as React) and unsubscribes run backward (last subscription
   * first), letting the core `unlink` hit its `pub.subs.pop()` fast path
   * instead of scanning and shifting the subscribers array — O(n) instead of
   * O(n²) for a shared pub.
   */
  let cleanupNode = (node: Node) => {
    let iterator = dom.document.createNodeIterator(node, 1 | 128)
    while (iterator.nextNode()) {
      let meta = (iterator.referenceNode as any)[symbol] as Meta | undefined
      if (meta?.unmount) {
        meta.unmount(iterator.referenceNode)
        meta.unmount = undefined
      }
    }
    while (iterator.previousNode()) {
      let meta = (iterator.referenceNode as any)[symbol] as Meta | undefined
      if (meta) {
        for (let i = meta.unsubscribes.length - 1; i >= 0; i--) {
          meta.unsubscribes[i]!()
        }
        meta.unsubscribes = []
      }
    }
  }

  /**
   * @note The moved node creates two mutations: deletion then addition.
   * @todo Moving an node in the DOM unsubscribes and resubscribes to atoms.
   */
  let processMutations = (mutationsList: MutationRecord[]) => {
    for (let mutation of mutationsList) {
      mutation.addedNodes.forEach((addedNode) => {
        let iterator = dom.document.createNodeIterator(addedNode, 1 | 128)
        while (iterator.nextNode()) {
          let meta = (iterator.referenceNode as any)[symbol] as Meta | undefined
          meta?.subscribes.forEach((subscribe) =>
            meta.unsubscribes.push(subscribe()),
          )
        }
        while (iterator.previousNode()) {
          let meta = (iterator.referenceNode as any)[symbol] as Meta | undefined
          if (meta) {
            let unmount = meta.mount?.(iterator.referenceNode)
            if (typeof unmount === 'function') meta.unmount = unmount
          }
        }
      })
      mutation.removedNodes.forEach((removedNode) => cleanupNode(removedNode))
    }
  }
  let observer = new dom.MutationObserver(wrap(processMutations))
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
      cleanupNode(child)
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
