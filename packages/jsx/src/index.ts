import { Atom, Ctx, Rec, atom, createCtx, isAtom } from '@reatom/core'
import { noop } from '@reatom/utils'
import {
  ComponentLike,
  InferProps,
  JsxElementTag,
  JsxNodeBase,
  ReatomElement,
} from './types'
import { JsxNode } from './types'
import { onConnect, onDisconnect } from '@reatom/hooks'
import { reconcile } from './reconcile'

const NsSvg = 'http://www.w3.org/2000/svg'
const NsMathml = 'http://www.w3.org/1998/Math/MathML'

export const reatomJsx = (ctx: Ctx, window = globalThis.window) => {
  const h = (tag: ComponentLike, props: Rec, children?: JsxNode[]): JsxNode => {
    if (children) props.children = children
    if (tag === hf) return props.children
    if (typeof tag === 'function') return tag(props)
    return reatomElement(tag, props)
  }

  const hf = noop

  const reatomElement = <E extends Element>(
    tag: string,
    props: Rec,
  ): ReatomElement<E> => {
    let ns: string | undefined
    if (tag.startsWith('svg:')) {
      ns = NsSvg
      tag = tag.slice(4) as any
    }
    if (tag.startsWith('mathml:')) {
      ns = NsMathml
      tag = tag.slice(7) as any
    }

    const element = (ns
      ? window.document.createElementNS(ns, tag)
      : window.document.createElement(tag)) as any as E

    let bindings: Array<string> | undefined
    let spreadRecs: Array<any> | undefined
    let spreadKeys: Set<string> | undefined

    // here and below, `clock` is used to always return a different value from a rendering atom
    const sync = atom((ctx, clock?: boolean) => {
      if (spreadRecs) {
        ctx.spy(
          (syncSpreads ??= atom((ctx, clock?: boolean) => {
            const prevSpreadKeys = spreadKeys
            spreadKeys = new Set()
            const result = {} as Rec

            for (let rec of spreadRecs!) {
              if (isAtom(rec)) rec = ctx.spy(rec)
              for (const key in rec) {
                const val = rec[key]
                result[key] = isAtom(val) ? ctx.spy(val) : val
                prevSpreadKeys?.delete(key)
                if (!(key in props)) {
                  spreadKeys.add(key)
                }
              }
            }

            if (prevSpreadKeys) {
              for (const key of prevSpreadKeys) {
                setProp(element, key, undefined)
              }
            }

            for (const key in result) {
              setProp(element, key, result[key])
            }

            return !clock
          })),
        )
      }

      if (bindings) ctx.spy(syncBindings)

      if (isAtom(props.children) || props.children?.length)
        ctx.spy(syncChildren)

      return !clock as any as void
    })

    let syncSpreads: Atom | undefined

    const syncBindings = atom((ctx, clock?: boolean) => {
      for (const key of bindings!) {
        setProp(element, key, ctx.spy((props as any)[key]))
      }

      return !clock
    })

    const syncChildren = atom((ctx, clock?: boolean) => {
      const children = new Set<JsxNodeBase>()
      for (let child of isAtom(props.children)
        ? ctx.spy(props.children)
        : props.children!) {
        children.add(isAtom(child) ? ctx.spy(child) : child)
      }

      reconcile(element, children, window)

      for (const child of children) {
        if (isReatomElement(child)) ctx.spy(child.sync)
      }

      return !clock
    })

    for (const key in props) {
      const val = (props as any)[key]
      if (key === '$props') {
        spreadRecs = Array.isArray(val) ? val : [val]
      } else if (key === 'onConnect') {
        onConnect(sync, val)
      } else if (key === 'onDisconnect') {
        onDisconnect(sync, val)
      } else if (key.startsWith('on')) {
        element.addEventListener(key.slice(2), (event) => val(ctx, event))
      } else if (isAtom(val)) {
        ;(bindings ??= []).push(key)
      } else {
        setProp(element, key, val)
      }
    }

    return {
      sync,
      element,
    }
  }

  const setProp = (element: Element, key: string, val: any) => {
    if (key === 'className') key = 'class'
    if (key.startsWith('on')) {
      element.addEventListener(key.slice(2), (event) => val(ctx, event))
    } else if (key.startsWith('field:')) {
      ;(element as any)[key.slice(6)] = val
    } else if (key === 'style') {
      throw new Error('style not supported yet')
    } else {
      if (val == null) element.removeAttribute(key)
      else element.setAttribute(key, val)
    }
  }

  const mount = (parent: Element | DocumentFragment, child: JsxNode) => {
    if (!isReatomElement(child)) throw new Error('Can only mount elements')
    parent.appendChild(child.element)
    const unsub = ctx.subscribe(child.sync, noop)
    return () => {
      unsub()
      parent.removeChild(child.element)
    }
  }

  return { h, hf, reatomElement, mount }
}

const isReatomElement = (val: any): val is ReatomElement =>
  isAtom((val as any)?.sync)

const createT = (create: typeof reatomElement) => {
  type TagFactory = {
    [T in JsxElementTag]: (
      props?: InferProps<T> | Array<JsxNode>,
    ) => ReatomElement
  }

  const factories = {} as TagFactory

  return new Proxy({} as Readonly<TagFactory>, {
    get: (_, tag) =>
      (factories[tag as JsxElementTag] ??= (props = {} as any) =>
        create(
          tag as JsxElementTag,
          Array.isArray(props) ? { children: props } : (props as any),
        )),
  })
}

export const ctx = createCtx()
export const { h, hf, reatomElement } = reatomJsx(ctx)
export const t = createT(reatomElement)
