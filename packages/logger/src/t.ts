import { ElementTag, InferProps, JSXElement, create } from '@reatom/jsx'

type TagFactory = {
  [T in ElementTag]: (props?: InferProps<T> | JSXElement[]) => Element
}

const factories = {} as TagFactory

export const t = new Proxy({} as Readonly<TagFactory>, {
  get: (_, tag) =>
    (factories[tag as ElementTag] ??= (props = {} as any) =>
      create(
        tag as ElementTag,
        Array.isArray(props) ? { children: props } : props,
      )),
})
