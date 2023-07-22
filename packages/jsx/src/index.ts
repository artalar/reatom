import { createCtx, Ctx, isAtom, Rec, Unsubscribe } from '@reatom/core'
import type { JSX } from './jsx'
declare type JSXElement = JSX.Element
export type { JSXElement, JSX }

export const reatomJsx = (ctx: Ctx) => {
  let h = (tag: any, props: Rec, ...children: any[]) => {
    if (tag === hf) return children

    if (typeof tag === 'function') return tag(props ?? {}, children)

    let element = document.createElement(tag)

    for (let k in props) {
      let prop = props[k]
      if (isAtom(prop)) {
        if (prop.__reatom.isAction) {
          element[k] = (...a: any[]) => prop(ctx, ...a)
        } else {
          // TODO rewrite attribute even if state not changed
          var un: undefined | Unsubscribe = ctx.subscribe(prop, (v) =>
            !un || element.isConnected ? (element[k] = v) : un(),
          )
        }
      } else {
        element[k] = prop
      }
    }

    let walk = (child: any) => {
      if (Array.isArray(child)) child.forEach(walk)
      else {
        if (isAtom(child)) {
          let textNode = document.createTextNode('') as ChildNode
          var un: undefined | Unsubscribe = ctx.subscribe(child, (v) => {
            if (un && !textNode.isConnected) un()
            else {
              if (v instanceof Element) {
                if (un) {
                  element.insertBefore(v, textNode)
                  textNode.remove()
                }
                textNode = v
              } else {
                textNode.textContent = v
              }
            }
          })
          element.appendChild(textNode)
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

  return { h, hf }
}

export const { h, hf } = reatomJsx(createCtx())
