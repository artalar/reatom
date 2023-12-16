import {
  Ctx,
  CtxSpy,
  Fn,
  Rec,
  Unsubscribe,
  atom,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { noop } from '@reatom/utils'
import { ReatomElement, JsxNode, DomElement, Computable } from './types'

type DomApis = Pick<typeof window, 'document' | 'Node' | 'Text' | 'Element'>

const StylesheetId = 'reatom-jsx-styles'
let styles: Map<string, string> | undefined
let stylesheet: HTMLStyleElement | undefined

export const reatomJsx = (ctx: Ctx, w: DomApis = globalThis.window) => ({
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

  h(component: any, props: Rec, children?: any) {
    if (children) props.children = children
    if (typeof component === 'function') return component(props)
    return this.element(component, props)
  },

  element(tag: string, props: Rec) {
    const e = (tag.startsWith('svg:')
      ? w.document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4))
      : w.document.createElement(tag)) as any as ReatomElement

    e.$$reatom = true

    for (const key in props) {
      let val = props[key]

      if (key === 'children') {
        if (!val) continue
        let childHandles = [] as Array<Unsubscribe>
        const unsub = () => {
          for (const u of childHandles) u()
        }

        e.syncChildren ??= atom((ctx, clock?: boolean) => {
          let children = unwrap(ctx, val)
          if (!Array.isArray(children)) children = [children]

          unsub()
          childHandles.length = 0

          e.replaceChildren()

          const elements = [] as Array<ReatomElement>
          for (let child of children) {
            if (child == null || child === false) continue

            let node: Element | Text

            if (!isAtom(child) && typeof child === 'function') {
              child = atom(child)
            }
            if (isAtom(child)) {
              node = new w.Text()
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
                      node.replaceWith((node = new w.Text(child)))
                    }
                  }
                }),
              )
            } else {
              if (child instanceof w.Node) {
                node = child as Element
                if ('$$reatom' in child) elements.push(child as any)
              } else {
                node = new w.Text(String(child))
              }
            }
            e.appendChild(node)
          }

          for (const element of elements) sync(ctx, element)

          return !clock
        })

        const disco = new Set<Fn>()
        disco.add(unsub)
        e.syncChildren.__reatom.disconnectHooks = disco
      } else if (key === '$props') {
        if (!val) continue
        val = Array.isArray(val) ? val : [val]

        e.syncSpreads = atom((ctx, clock?: boolean) => {
          for (let rec of val) {
            rec = unwrap(ctx, rec)
            const unused = e.spreaded
            e.spreaded = new Set<string>()

            for (const key in rec) {
              set(w, e, key, unwrap(ctx, rec[key]))
              unused?.delete(key)
              e.spreaded.add(key)
            }

            if (unused) {
              for (const key of unused) set(w, e, key, undefined)
            }
          }
          return !clock
        })
      } else if (key.startsWith('on')) {
        ;(e as any)[key.slice(3)] = (event: Event) => val(ctx, event)
      } else if (isAtom(val) || typeof val == 'function') {
        e.syncProps ??= atom((ctx, clock?: boolean) => {
          for (const key in props) {
            if (key === '$props' || key.startsWith('on')) continue

            let val = props[key]
            if (isAtom(val)) val = ctx.spy(val)
            else if (typeof val === 'function') val = val(ctx)
            else continue

            set(w, e, key, val)
          }
          return !clock
        })
      } else {
        set(w, e, key, val)
      }
    }
    return e
  },
})

export const sync = (ctx: CtxSpy, e: ReatomElement) => {
  if (e.syncSpreads) ctx.spy(e.syncSpreads)
  if (e.syncProps) ctx.spy(e.syncProps)
  if (e.syncChildren) ctx.spy(e.syncChildren)
}

export const unwrap = <T>(ctx: CtxSpy, val: Computable<T>): T => {
  if (isAtom(val)) return ctx.spy(val)
  if (typeof val === 'function') return (val as any)(ctx)
  return val
}

const set = (w: DomApis, e: DomElement, key: string, val: any) => {
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
  } else {
    if (val == null) e.removeAttribute(key)
    else e.setAttribute(key, String(val))
  }
}

export * from './lifecycle'
