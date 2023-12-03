import {
  Atom,
  Ctx,
  CtxSpy,
  Fn,
  Rec,
  atom,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { noop } from '@reatom/utils'
import { ReatomElement, JsxNode, DomElement, Computable } from './types'

const StylesheetId = 'reatom-jsx-styles'
let styles: Map<string, string> | undefined
let stylesheet: HTMLStyleElement | undefined

export const reatomJsx = (ctx: Ctx, w = globalThis.window) => ({
  mount(parent: Element, child: JsxNode) {
    throwReatomError(!(child instanceof w.Element), 'Can only mount elements')
    const unsub = ctx.subscribe(
      atom((ctx) => sync(ctx, child as ReatomElement)),
      noop,
    )
    parent.appendChild(child as Node)
    return () => {
      unsub()
      parent.removeChild(child as Node)
    }
  },

  h(component: any, props: Rec, children?: Array<any>) {
    if (children) props.children = children
    if (typeof component === 'function') return component(props)
    return this.element(component, props)
  },

  element(tag: string, props: Rec) {
    const element = (tag.startsWith('svg:')
      ? w.document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
      : w.document.createElement(tag)) as any as ReatomElement
    element.$$reatom = true
    for (const key in props) {
      let val = props[key]
      if (key === 'children') {
        if (!val) continue
        let childHandles = [] as Array<Fn>
        const unsub = () => {
          for (const fn of childHandles) fn()
        }
        element.syncChildren ??= atom((ctx, clock?: boolean) => {
          let children = unwrap(ctx, val)
          if (!Array.isArray(children)) children = [children]
          const elements = [] as Array<ReatomElement>
          unsub()
          childHandles.length = 0
          for (let child of children) {
            if (child == null || child == false) continue
            let node: Element | Text
            if (!isAtom(child) && typeof child === 'function') {
              child = atom(child)
            }
            if (isAtom(child)) {
              node = w.document.createTextNode('')
              childHandles.push(
                ctx.subscribe(child, (child) => {
                  if (child instanceof w.Node) {
                    if ('$$reatom' in child) elements.push(child as any)
                    node.replaceWith((node = child as any))
                  } else {
                    child = String(child)
                    if (node instanceof w.Text) {
                      node.textContent = child
                    } else {
                      node.replaceWith(
                        (node = w.document.createTextNode(child)),
                      )
                    }
                  }
                }),
              )
            } else {
              if (child instanceof w.Node) {
                node = child as Element
                if ('$$reatom' in child) elements.push(child as any)
              } else {
                node = w.document.createTextNode(String(child))
              }
            }
            element.appendChild(node)
          }
          for (const element of elements) sync(ctx, element)
          return !clock
        })
        const disco = new Set<Fn>()
        disco.add(unsub)
        element.syncChildren.__reatom.disconnectHooks = disco
      } else if (key === '$props') {
        if (!val) continue
        if (!Array.isArray(val)) val = [val]
        element.syncSpreads = atom((ctx, clock?: boolean) => {
          return !clock
        })
      } else if (key.startsWith('on')) {
        ;(element as any)[key.slice(3)] = (event: Event) => val(ctx, event)
      } else if (isAtom(val) || typeof val == 'function') {
        element.syncProps ??= atom((ctx, clock?: boolean) => {
          for (const key in props) {
            if (key === '$props' || key.startsWith('on')) continue
            let val = props[key]
            if (isAtom(val)) val = ctx.spy(val)
            else if (typeof val === 'function') val = val(ctx)
            else continue
            set(w, element, key, val)
          }
          return !clock
        })
      } else {
        set(w, element, key, val)
      }
    }
    return element
  },
})

const sync = (ctx: CtxSpy, e: ReatomElement) => {
  if (e.syncSpreads) ctx.spy(e.syncSpreads)
  if (e.syncProps) ctx.spy(e.syncProps)
  if (e.syncChildren) ctx.spy(e.syncChildren)
}

const unwrap = <T>(ctx: CtxSpy, val: Computable<T>): T => {
  if (isAtom(val)) return ctx.spy(val)
  if (typeof val === 'function') return (val as any)(ctx)
  return val
}

const set = (w: typeof window, e: DomElement, key: string, val: any) => {
  if (key.startsWith('field:')) {
    ;(e as any)[key.slice(6)] = val
  } else if (key === 'style' && typeof val === 'object') {
    for (const key in val) {
      if (val[key] == null) e.style.removeProperty(key)
      else e.style.setProperty(key, val[key])
    }
  } else if (key === 'css') {
    stylesheet ??= w.document.getElementById(StylesheetId) as any
    if (!stylesheet) {
      stylesheet = w.document.createElement('style')
      stylesheet.id = StylesheetId
      w.document.head.appendChild(stylesheet)
    }
    let className = (styles ??= new Map()).get(val)
    if (!className) {
      styles.set(
        val,
        (className =
          'reatom-' +
          Math.random()
            .toString(36)
            .slice(2, length + 2)),
      )
      stylesheet.innerText += '.' + className + '{' + val + '}\n'
    }
    e.classList.add(className)
  } else if (key.startsWith('css:')) {
    key = '--' + key.slice(4)
    if (val == null) e.style.removeProperty(key)
    else e.style.setProperty(key, String(val))
  } else if (val == null) {
    e.removeAttribute(key)
  } else {
    e.setAttribute(key, String(val))
  }
}
