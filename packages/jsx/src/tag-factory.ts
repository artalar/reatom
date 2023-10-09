import { ElementTag, InferProps, JSXElement, create } from '.'

type TagFactory = {
  [T in ElementTag]: (props?: InferProps<T> | JSXElement[]) => Element
}

const factories = {} as TagFactory

export const experimental_createTagFactory = (createFn?: typeof create) => {
  return new Proxy({} as Readonly<TagFactory>, {
    get: (_, tag) =>
      (factories[tag as ElementTag] ??= (props = {} as any) =>
        (createFn ?? create)(
          tag as ElementTag,
          Array.isArray(props) ? { children: props } : props,
        )),
  })
}
