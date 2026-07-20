import { _createGlobal, atom, peek, type Rec } from '@reatom/core'

export type BoundaryHandle = (error: unknown) => void

type JsxGlobal = {
  inlineStyles: { count: number; ids: Rec<string> }
  hName: { current: string }
  metaSymbol: () => symbol
  boundaryCurrent: { current: BoundaryHandle | undefined }
  dom: ReturnType<typeof atom<typeof globalThis.window>>
  stylesheet: ReturnType<typeof createStylesheet>
}

let createStylesheet = (dom: JsxGlobal['dom']) => {
  let target = atom(
    () =>
      dom().document.head.appendChild(dom().document.createElement('style'))
        .sheet!,
  )
  return Object.assign(() => peek(target), { set: target.set })
}

let createJsxGlobal = (): JsxGlobal => {
  let dom = atom(globalThis.window, 'jsx.DOM')
  let metaSymbolTarget = atom(() => Symbol(), 'jsx.metaSymbol')

  return {
    inlineStyles: { count: 0, ids: {} },
    hName: { current: '' },
    metaSymbol: () => peek(metaSymbolTarget),
    boundaryCurrent: { current: undefined },
    dom,
    stylesheet: createStylesheet(dom),
  }
}

export let {
  inlineStyles: jsxInlineStyles,
  hName: jsxHName,
  metaSymbol,
  boundaryCurrent: jsxBoundary,
  dom: DOM,
  stylesheet,
} = _createGlobal('jsx', createJsxGlobal)
