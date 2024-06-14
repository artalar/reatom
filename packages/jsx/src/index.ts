import {
  action,
  Atom,
  AtomMut,
  createCtx,
  Ctx,
  Fn,
  isAtom,
  Rec,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { isObject, random } from '@reatom/utils'
import {
  type LinkedList,
  type LLNode,
  isLinkedListAtom,
  LL_NEXT,
} from '@reatom/primitives'
import type { JSX } from './jsx'
declare type JSXElement = JSX.Element
export type { JSXElement, JSX }

type DomApis = Pick<
  typeof window,
  | 'document'
  | 'Node'
  | 'Text'
  | 'Element'
  | 'MutationObserver'
  | 'HTMLElement'
  | 'DocumentFragment'
>

const isSkipped = (value: unknown): value is  boolean | '' | null | undefined => typeof value === 'boolean' || value === '' || value == null

let unsubscribesMap = new WeakMap<Node, Array<Fn>>()
let unlink = (parent: any, un: Unsubscribe) => {
  // check the connection in the next tick
  // to give the user (programmer) an ability
  // to put the created element in the dom
  Promise.resolve().then(() => {
    if (!parent.isConnected) un()
    else {
      while (
        parent.parentElement &&
        !unsubscribesMap.get(parent)?.push(() => parent.isConnected || un())
      ) {
        parent = parent.parentElement
      }
    }
  })
}

const walkLinkedList = (
  ctx: Ctx,
  el: JSX.Element,
  list: Atom<LinkedList<LLNode<JSX.Element>>>,
) => {
  let lastVersion = -1
  unlink(
    el,
    ctx.subscribe(list, (state) => {
      if (state.version - 1 > lastVersion) {
        el.innerHTML = ''
        for (let { head } = state; head; head = head[LL_NEXT]) {
          el.append(head)
        }
      } else {
        for (const change of state.changes) {
          if (change.kind === 'create') {
            el.append(change.node)
          }
          if (change.kind === 'remove') {
            el.removeChild(change.node)
          }
          if (change.kind === 'swap') {
            let [aNext, bNext] = [change.a.nextSibling, change.b.nextSibling]
            if (bNext) {
              el.insertBefore(change.a, bNext)
            } else {
              el.append(change.a)
            }

            if (aNext) {
              el.insertBefore(change.b, aNext)
            } else {
              el.append(change.b)
            }
          }
          if (change.kind === 'move') {
            if (change.after) {
              change.after.insertAdjacentElement('afterend', change.node)
            } else {
              el.append(change.node)
            }
          }
          if (change.kind === 'clear') {
            el.innerHTML = ''
          }
        }
      }
      lastVersion = state.version
    }),
  )
}

export const reatomJsx = (ctx: Ctx, DOM: DomApis = globalThis.window) => {
  const StylesheetId = 'reatom-jsx-styles'
  let styles: Rec<string> = {}
  let stylesheet: HTMLStyleElement | undefined
  let name = ''

  let set = (element: JSX.Element, key: string, val: any) => {
    if (key.startsWith('on:')) {
      key = key.slice(3)
      // only for logging purposes
      val = action(val, `${name}.${element.nodeName.toLowerCase()}._${key}`)
      element.addEventListener(key, (event) => val(ctx, event))
    } else if (key.startsWith('css:')) {
      key = '--' + key.slice(4)
      if (val == null) element.style.removeProperty(key)
      else element.style.setProperty(key, String(val))
    } else if (key === 'css') {
      stylesheet ??= DOM.document.getElementById(StylesheetId) as any
      if (!stylesheet) {
        stylesheet = DOM.document.createElement('style')
        stylesheet.id = StylesheetId
        DOM.document.head.appendChild(stylesheet)
      }

      let className = styles[val]
      if (!className) {
        className = styles[val] = 'reatom-' + random()

        stylesheet.innerText += '.' + className + '{' + val + '}\n'
      }
      element.classList.add(className)
    } else if (key === 'style' && typeof val === 'object') {
      for (const key in val) {
        if (val[key] == null) element.style.removeProperty(key)
        else element.style.setProperty(key, val[key])
      }
    } else if (key.startsWith('prop:')) {
      ;(element as any)[key.slice(5)] = val
    } else {
      if (key.startsWith('attr:')) {
        key = key.slice(5)
      }
      if (val == null) element.removeAttribute(key)
      else element.setAttribute(key, String(val))
    }
  }

  type Primitive = string | number | boolean | null | undefined
  type AtomElement = HTMLElement | SVGElement | Text
  type ArrayMaybe<T> = Array<T> | T

  const toArray = <T>(array: ArrayMaybe<T>): Array<T> => Array.isArray(array) ? array : [array]
  const nextTick = (cb: Fn): void => void Promise.resolve().then(cb)
  /** @see https://github.com/vuejs/core/blob/7c8b12620aad4969b8dc4944d4fc486d16c3033c/packages/shared/src/toDisplayString.ts#L17 */
  const prettyStringify = (value: unknown): string => JSON.stringify(value, undefined, 2)
  const serializeRenderAtom = (at: Atom, count: number) => prettyStringify({
    name: at.__reatom.name!,
    count,
  })

  const renderAtom = (stateAtom: Atom<ArrayMaybe<AtomElement | Primitive>>) => {
    const fragment = new DOM.DocumentFragment()
    /** @todo Добавлять информацию об атоме. */
    // const target = DOM.document.createComment(serializeRenderAtom(stateAtom, 0))
    const target = DOM.document.createComment('')
    let elements: AtomElement[] = []
    let error: any

    var un: undefined | Unsubscribe = ctx.subscribe(stateAtom, (newState): void => {
      try {
        if (un && !target.isConnected) {
          un()
        } else {
          const newNodes = toArray(newState)
            .filter((it) => !isSkipped(it))
            .map((it) => {
              if (it instanceof DOM.Node) {
                return it
              } else {
                /** @todo Подумать над форматированием вывода с помощью `JSON.stringify`. */
                const value = String(it)
                const node = DOM.document.createTextNode(value)
                return node
              }
            })

          /** @todo Разобраться с назначением? */
          // let list = unsubscribesMap.get(target)
          // if (!list) unsubscribesMap.set(target, (list = []))

          elements.forEach((node) => node.remove())
          target.after(...newNodes)
          // target.textContent = serializeRenderAtom(stateAtom, newNodes.length)
          elements = newNodes
        }
      } catch (e) {
        error = e
      }
    })
    if (error) throw error
    fragment.append(target, ...elements)
    unlink(target, un)
    return fragment
  }

  let h = (tag: any, props: Rec, ...children: any[]) => {
    /** @todo Написать тесты. */
    if (tag === hf) {
      return children.map((child) => isAtom(child) ? renderAtom(child) : child)
    }

    if (isAtom(tag)) {
      return renderAtom(tag)
    }

    if (typeof tag === 'function') {
      ;(props ??= {}).children = children

      let _name = tag.name
      try {
        name = tag.name
        const el = tag(props)
        return isAtom(el) ? renderAtom(el) : el
      } finally {
        name = _name
      }
    }

    let element: JSX.Element = tag.startsWith('svg:')
      ? DOM.document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
      : DOM.document.createElement(tag)

    for (let k in props) {
      let prop = props[k]
      if (isAtom(prop) && !prop.__reatom.isAction) {
        if (k.startsWith('model:')) {
          let name = (k = k.slice(6))
          set(element, 'on:input', (ctx: Ctx, event: any) => {
            ;(prop as AtomMut)(
              ctx,
              name === 'valueAsNumber'
                ? +event.target.value
                : event.target[name],
            )
          })
          if (k === 'valueAsNumber') k = 'value'
          k = 'prop:' + k
        }
        // TODO handle unsubscribe!
        let un: undefined | Unsubscribe
        un = ctx.subscribe(prop, (v) =>
          !un || element.isConnected
            ? k === '$spread'
              ? Object.entries(v).forEach(([k, v]) => set(element, k, v))
              : set(element, k, v)
            : un(),
        )

        unlink(element, un)
      } else {
        set(element, k, prop)
      }
    }

    let walk = (child: JSX.DOMAttributes<JSX.Element>['children']) => {
      if (Array.isArray(child)) {
        for (let i = 0; i < child.length; i++) walk(child[i])
      } else {
        if (isLinkedListAtom(child)) {
          walkLinkedList(ctx, element, child)
        } else if (isAtom(child)) {
          const innerChild = renderAtom(child as Atom<AtomElement>)
          element.appendChild(innerChild)
        } else if (!isSkipped(child)) {
          element.appendChild(
            isObject(child) && 'nodeType' in child
              ? (child as JSX.Element)
              : DOM.document.createTextNode(String(child)),
          )
        }
      }
    }

    children.forEach(walk)

    return element
  }

  /** Fragment */
  let hf = () => {}

  let mount = (target: Element, child: Element) => {
    target.append(...[child].flat(Infinity))

    new DOM.MutationObserver((mutationsList) => {
      for (let mutation of mutationsList) {
        for (let removedNode of mutation.removedNodes) {
          let list = unsubscribesMap.get(removedNode as any)
          if (list) {
            list.forEach((fn) => fn())
            unsubscribesMap.delete(removedNode as any)
          }
        }
      }
    }).observe(target, {
      childList: true,
      subtree: true,
    })
  }

  return { h, hf, mount }
}

export const ctx = createCtx()
export const { h, hf, mount } = reatomJsx(ctx)
