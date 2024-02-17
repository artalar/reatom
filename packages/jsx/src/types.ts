import { Atom, CtxSpy } from '@reatom/core'
import { JSX } from './jsx'

export type JsxNode = JsxNodeBase | Atom<JsxNodeBase>
export type JsxNodeBase =
  | undefined
  | null
  | boolean
  | number
  | string
  | ReatomElement
  | Node
  | globalThis.Node

/**
 * Static or computed value
 */
export type Computable<T> = T | ((ctx: CtxSpy) => T) | Atom<T>

export type DomElement = HTMLElement | SVGElement

export type ReatomElement<E extends DomElement = DomElement> = E & {
  $$reatom: true
  syncSpreads?: Atom
  syncProps?: Atom
  syncChildren?: Atom
  spreaded?: Set<string>
}

export type Component<Props> = (props: Props) => JsxNode

export type JsxElementTag = keyof JSX.IntrinsicElements

export type ComponentLike = JsxElementTag | Component<any>

export type InferProps<T extends ComponentLike> =
  T extends keyof JSX.HTMLElementTags
    ? JSX.HTMLElementTags[T]
    : T extends keyof JSX.SVGElementTags
    ? JSX.SVGElementTags[T]
    : T extends Component<infer Props>
    ? Props
    : never
