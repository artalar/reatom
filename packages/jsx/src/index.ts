import { createCtx, Ctx, Fn, isAtom, Rec, Unsubscribe } from '@reatom/core'
import type { JSX } from './jsx'
declare type JSXElement = JSX.ElementType
export type { JSXElement, JSX }

export const reatomJsx = (ctx: Ctx) => {
  let unsubscribesMap = new WeakMap<HTMLElement, Array<Fn>>()

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
      return tag(props)
    }

    let element = document.createElement(tag)

    for (let k in props) {
      let prop = props[k]
      if (isAtom(prop)) {
        if (prop.__reatom.isAction) {
          element[k] = (...a: any[]) => prop(ctx, ...a)
        } else {
          // TODO handle unsubscribe!
          var un: undefined | Unsubscribe = ctx.subscribe(prop, (v) =>
            !un || element.isConnected ? (element[k] = v) : un(),
          )

          unlink(element, un)
        }
      } else {
        element[k] = prop
      }
    }

    let walk = (child: any) => {
      if (Array.isArray(child)) child.forEach(walk)
      else {
        if (isAtom(child)) {
          let innerChild = document.createTextNode('') as ChildNode
          var un: undefined | Unsubscribe = ctx.subscribe(child, (v) => {
            if (un && !innerChild.isConnected) un()
            else {
              if (v instanceof HTMLElement) {
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
            child?.nodeType ? child : document.createTextNode(String(child)),
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
    target.appendChild(child)

    new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        for (const removedNode of mutation.removedNodes) {
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
