import { _createGlobal, atom, peek, type Rec } from '@reatom/core'

export interface BoundaryHandle {
  catch: (error: unknown) => void
  start: Comment
  end: Comment
}

type JsxGlobal = {
  inlineStyles: { count: number; ids: Rec<string> }
  hName: { current: string }
  metaSymbol: () => symbol
  propertiesAsAttributes: Set<string>
  booleanAttributes: Set<string>
  boundaryCurrent: { current: BoundaryHandle | undefined }
  boundaries: Set<BoundaryHandle>
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
    propertiesAsAttributes: new Set([
      'height',
      'high',
      'low',
      'optimum',
      'results',
      'size',
      'span',
      'start',
      'width',
      'form',
      'list',
      'download',
      'href',
      'role',
    ]),
    booleanAttributes: new Set([
      'allowfullscreen',
      'allowpaymentrequest',
      'async',
      'attributionsrc',
      'autofocus',
      'autoplay',
      'browsingtopics',
      'capture',
      'checked',
      'compact',
      'controls',
      'credentialless',
      'crossorigin',
      'declare',
      'default',
      'defer',
      'disabled',
      'disablepictureinpicture',
      'disableremoteplayback',
      'formnovalidate',
      'hidden',
      'inert',
      'ismap',
      'itemscope',
      'loop',
      'multiple',
      'muted',
      'nomodule',
      'novalidate',
      'open',
      'playsinline',
      'readonly',
      'required',
      'reversed',
      'scoped',
      'selected',
      'shadowrootclonable',
      'shadowrootdelegatesfocus',
      'shadowrootserializable',
      'virtualkeyboardpolicy',
      'webkitdirectory',
    ]),
    boundaryCurrent: { current: undefined },
    boundaries: new Set(),
    dom,
    stylesheet: createStylesheet(dom),
  }
}

export let {
  inlineStyles: jsxInlineStyles,
  hName: jsxHName,
  metaSymbol,
  propertiesAsAttributes,
  booleanAttributes,
  boundaryCurrent: jsxBoundary,
  boundaries,
  dom: DOM,
  stylesheet,
} = _createGlobal('jsx', createJsxGlobal)
