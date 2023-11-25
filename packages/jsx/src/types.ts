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
  | globalThis.Node
  | Array<Node>

export interface ReatomElement<E extends Element = Element> {
  sync: Atom<void>
  element: E
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
