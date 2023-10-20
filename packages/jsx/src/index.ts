import {
  Action,
  atom,
  createCtx,
  Ctx,
  Fn,
  isAtom,
  Rec,
  Unsubscribe,
} from '@reatom/core'
import type { JSX } from './jsx'
import { noop } from '@reatom/utils'
import { parseAtoms } from '@reatom/lens'
declare type JSXElement = JSX.Element
export type { JSXElement, JSX }

export type ElementTag = keyof JSX.HTMLElementTags | keyof JSX.SVGElementTags

export type Component<Props> = (props: Props) => JSXElement

export type ComponentLike = ElementTag | Component<any>

export type InferProps<T extends ComponentLike> =
  T extends keyof JSX.HTMLElementTags
    ? JSX.HTMLElementTags[T]
    : T extends keyof JSX.SVGElementTags
    ? JSX.SVGElementTags[T]
    : T extends Component<infer Props>
    ? Props
    : never

export const reatomJsx = (ctx: Ctx) => {
  let unsubscribesMap = new WeakMap<Element, Array<Fn>>()

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

  let create = (tag: string, props: Rec) => {
    let element =
      tag === 'svg'
        ? document.createElementNS('http://www.w3.org/2000/svg', tag)
        : document.createElement(tag)

    for (let k in props) {
      if (k === 'children') continue
      bindAttr(element, k, props[k])
    }

    render(element, props.children ?? [])

    return element
  }

  const bindAttr = (element: any, key: any, val: any) => {
    if (key === '$attrs') {
      const recs = Array.isArray(val) ? val : [val]
      for (const rec of recs) {
        for (const k in rec) bindAttr(element, k, rec[k])
      }
    } else if (isAtom(val)) {
      if (val.__reatom.isAction) {
        element[key] = (...args: any) => (val as Action)(ctx, ...args)
      } else {
        // TODO handle unsubscribe!
        var un: undefined | Unsubscribe = ctx.subscribe(val, (val) =>
          !un || element.isConnected ? renderAttr(element, key, val) : un(),
        )
        unlink(element, un)
      }
    } else renderAttr(element, key, val)
  }

  const renderAttr = (element: any, key: any, val: any) => {
    if (key === 'style') {
      for (const style in val) element.style.setProperty(style, val[style])
    } else element[key] = val
  }

  let render = (parent: Element, children: JSXElement[]) => {
    // TODO support Atom<Array>
    let walk = (child: any) => {
      if (Array.isArray(child)) {
        child.forEach(walk)
        return
      }

      if (isAtom(child)) {
        let innerChild: ChildNode = document.createTextNode('')
        var un: Unsubscribe | undefined = ctx.subscribe(
          atom((ctx) => parseAtoms(ctx, child)),
          (v) => {
            if (un && !innerChild.isConnected) un()
            else {
              if (v instanceof Element) {
                let list = unsubscribesMap.get(v)
                if (!list) unsubscribesMap.set(v, (list = []))

                if (un) parent.replaceChild(v, innerChild)
                innerChild = v
              } else {
                innerChild.textContent = v
              }
            }
          },
        )
        unlink(parent, un)
        parent.appendChild(innerChild)
        return
      }

      parent.appendChild(
        child?.nodeType ? child : document.createTextNode(String(child)),
      )
    }

    children.forEach(walk)
  }

  let h = ((tag: any, props: Rec, ...children: JSXElement[]) => {
    if (tag === hf) return children

    props.children = children

    if (typeof tag === 'function') {
      return tag(props)
    }

    return create(tag, props)
  }) as <T extends ComponentLike>(
    tag: T,
    props: InferProps<T>,
    ...children: JSXElement[]
  ) => Element

  let hf = noop

  let mount = (target: Element, child: JSXElement) => {
    render(target, [child])

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

  return { h, hf, mount, create }
}

export const ctx = createCtx()
export const { h, hf, mount, create } = reatomJsx(ctx)
