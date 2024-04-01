import {
  action,
  AtomMut,
  createCtx,
  Ctx,
  Fn,
  isAtom,
  Rec,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { random } from '@reatom/utils'
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

export const reatomJsx = (ctx: Ctx, DOM: DomApis = globalThis.window) => {
  let unsubscribesMap = new WeakMap<HTMLElement, Array<Fn>>()
  const StylesheetId = 'reatom-jsx-styles'
  let styles: Rec<string> = {}
  let stylesheet: HTMLStyleElement | undefined
  let name = ''

  let set = (element: JSX.Element, key: string, val: any) => {
    if (key.startsWith('on:')) {
      key = key.slice(3)
      // only for logging purposes
      val = action(val, `${name}.${element.nodeName.toLowerCase()}.${key}`)
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

  let unlink = (parent: any, un: Unsubscribe) => {
    Promise.resolve().then(() => {
      if (!parent.isConnected) un()
      else {
        while (parent.parentElement && !unsubscribesMap.get(parent)?.push(un)) {
          parent = parent.parentElement
        }
      }
    })
  }

  let h = (tag: any, props: Rec, ...children: any[]) => {
    if (tag === hf) return children

    if (typeof tag === 'function') {
      ;(props ??= {}).children = children

      let _name = tag.name
      try {
        name = tag.name
        return tag(props)
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

    let walk = (child: any) => {
      if (Array.isArray(child)) child.forEach(walk)
      else {
        if (isAtom(child)) {
          let innerChild = DOM.document.createTextNode('') as
            | ChildNode
            | DocumentFragment
          let un: undefined | Unsubscribe
          un = ctx.subscribe(child, (v) => {
            if (un && !innerChild.isConnected) un()
            else {
              throwReatomError(
                Array.isArray(v),
                'array children are not supported',
              )

              if (v instanceof DOM.HTMLElement) {
                let list = unsubscribesMap.get(v)
                if (!list) unsubscribesMap.set(v, (list = []))

                if (un) element.replaceChild(v, innerChild)
                innerChild = v
              } else {
                innerChild.textContent = v
              }
            }
          })
          unlink(element, un)
          element.appendChild(innerChild)
        } else {
          element.appendChild(
            child?.nodeType
              ? child
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
