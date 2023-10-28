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

const FieldProps = ['innerHTML', 'innerText', 'textContent']

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

  let create = (tag: string, attrs: Rec) => {
    let element =
      tag === 'svg'
        ? document.createElementNS('http://www.w3.org/2000/svg', tag)
        : document.createElement(tag)

    bindProps(element, attrs)

    render(element, attrs.children ?? [])

    return element
  }

  const bindProps = (element: Element, props: Rec) => {
    for (const key in props) {
      if (key === 'children') continue

      const val = props[key]

      if (key === '$props') {
        for (const attrs of Array.isArray(val) ? val : []) {
          if (isAtom(attrs)) {
            var u = ctx.subscribe(attrs, (attrs) => {
              if (element.isConnected || !u) bindProps(element, attrs)
              else u()
            })
            unlink(element, u)
          } else bindProps(element, attrs)
        }
      } else if (isAtom(val) && !val.__reatom.isAction) {
        // TODO handle unsubscribe!
        var u = ctx.subscribe(val, (val) => {
          if (element.isConnected || !u) setProp(element, key, val)
          else u()
        })
        unlink(element, u)
      } else if (typeof val === 'function') {
        ;(element as any)[key] = (event: any) => val(ctx, event)
      } else {
        setProp(element, key, val)
      }
    }
  }

  const setProp = (element: Element, name: string, val: any) => {
    if (name === 'className') name = 'class'

    if (name.startsWith('field:')) {
      ;(element as any)[name.slice(6)] = val
    } else if (FieldProps.includes(name)) {
      ;(element as any)[name] = val
    } else if (name === 'style' && typeof val === 'object') {
      for (const styleKey in val) {
        const styleVal = val[styleKey]
        if (styleVal != null && styleVal !== false) {
          ;(element as HTMLElement).style.setProperty(
            styleKey,
            String(styleVal),
          )
        } else {
          ;(element as HTMLElement).style.removeProperty(styleKey)
        }
      }
    } else element.setAttribute(name, val)
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
        child instanceof Node ? child : document.createTextNode(String(child)),
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

  let mount = (target: Element, child: Element) => {
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
