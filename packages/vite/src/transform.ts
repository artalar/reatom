import MagicString from 'magic-string'
import ts from 'typescript'

export type TransformOptions = {
  routes?: boolean
  jsx?: boolean
  filename?: string
}

export type TransformResult = {
  code: string
  map: { mappings: string }
  routes: boolean
  jsx: boolean
}

const ROUTE_TRACK = '__REATOM_VITE_trackRoute'
const ROUTE_LIST = '__REATOM_VITE_routes'
const MOUNT_TRACK = '__REATOM_VITE_trackMount'
const MOUNT_LIST = '__REATOM_VITE_mounts'
const RETRY = '__REATOM_VITE_retryComputed'
const URL_ATOM = '__REATOM_VITE_urlAtom'

const JS_EXT = /\.[cm]?[jt]sx?$/

export const isTransformTarget = (id: string): boolean => {
  const filename = id.split('?', 1)[0] ?? id
  if (
    filename.includes('/node_modules/') ||
    filename.includes('\\node_modules\\')
  ) {
    return false
  }
  return JS_EXT.test(filename)
}

const scriptKindFor = (filename: string): ts.ScriptKind => {
  if (filename.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (filename.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (
    filename.endsWith('.js') ||
    filename.endsWith('.mjs') ||
    filename.endsWith('.cjs')
  ) {
    return ts.ScriptKind.JS
  }
  return ts.ScriptKind.TS
}

const getLocalNamesForExport = (
  sourceFile: ts.SourceFile,
  moduleSpecifier: string,
  exportedName: string,
): Set<string> => {
  const names = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (statement.moduleSpecifier.text !== moduleSpecifier) continue

    const clause = statement.importClause
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      continue
    }

    for (const element of clause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text
      if (importedName === exportedName) {
        names.add(element.name.text)
      }
    }
  }

  return names
}

const isReatomRouteCall = (node: ts.CallExpression): boolean => {
  const expression = node.expression
  if (ts.isIdentifier(expression)) {
    return expression.text === 'reatomRoute'
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text === 'reatomRoute'
  }
  return false
}

const isMountCall = (
  node: ts.CallExpression,
  mountNames: Set<string>,
): boolean => {
  if (!ts.isIdentifier(node.expression)) return false
  return mountNames.has(node.expression.text)
}

const collectCallRanges = (
  sourceFile: ts.SourceFile,
  predicate: (node: ts.CallExpression) => boolean,
): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = []

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && predicate(node)) {
      ranges.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return ranges
}

const wrapCallsWithStarts = (
  magicString: MagicString,
  ranges: Array<{ start: number; end: number }>,
  trackName: string,
) => {
  for (const range of ranges.toSorted(
    (left, right) => right.start - left.start,
  )) {
    magicString.appendLeft(range.start, `${trackName}(`)
    magicString.appendLeft(range.end, ')')
  }
}

const buildRoutePreamble = (): string =>
  `import { retryComputed as ${RETRY}, urlAtom as ${URL_ATOM} } from '@reatom/core';
const ${ROUTE_LIST} = [];
const ${ROUTE_TRACK} = (route) => (${ROUTE_LIST}.push(route), route);
`

const buildMountPreamble = (): string =>
  `const ${MOUNT_LIST} = [];
const ${MOUNT_TRACK} = (result) => (${MOUNT_LIST}.push(result), result);
`

const buildHotFooter = (routes: boolean, jsx: boolean): string => {
  const disposeBody: string[] = []

  if (routes) {
    disposeBody.push(`
    for (const route of ${ROUTE_LIST}) {
      const parent = route.parent;
      if (parent?.routes) delete parent.routes[route.name];
      if (parent !== ${URL_ATOM}) delete ${URL_ATOM}.routes[route.name];
      if (parent && "outlet" in parent) ${RETRY}(parent.outlet);
    }
    ${ROUTE_LIST}.length = 0;`)
  }

  if (jsx) {
    disposeBody.push(`
    for (const mounted of ${MOUNT_LIST}) mounted.unmount();
    ${MOUNT_LIST}.length = 0;`)
  }

  return `
if (import.meta.hot) {
  import.meta.hot.dispose(() => {${disposeBody.join('')}
  });
  import.meta.hot.accept();
}
`
}

export const transformReatomModule = (
  code: string,
  options: TransformOptions = {},
): TransformResult | null => {
  const enableRoutes = options.routes !== false
  const enableJsx = options.jsx !== false
  const filename = options.filename ?? 'module.tsx'

  if (code.includes('import.meta.hot')) return null

  const wantsRoutes = enableRoutes && code.includes('reatomRoute')
  const wantsJsxImport = enableJsx && code.includes('@reatom/jsx')

  if (!wantsRoutes && !wantsJsxImport) return null

  const sourceFile = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filename),
  )

  const mountNames = wantsJsxImport
    ? getLocalNamesForExport(sourceFile, '@reatom/jsx', 'mount')
    : new Set<string>()

  const routeRanges = wantsRoutes
    ? collectCallRanges(sourceFile, isReatomRouteCall)
    : []
  const mountRanges =
    mountNames.size > 0
      ? collectCallRanges(sourceFile, (node) => isMountCall(node, mountNames))
      : []

  const injectRoutes = routeRanges.length > 0
  const injectJsx = mountRanges.length > 0

  if (!injectRoutes && !injectJsx) return null

  const magicString = new MagicString(code)

  if (injectRoutes) {
    wrapCallsWithStarts(magicString, routeRanges, ROUTE_TRACK)
  }
  if (injectJsx) {
    wrapCallsWithStarts(magicString, mountRanges, MOUNT_TRACK)
  }

  let preamble = ''
  if (injectRoutes) preamble += buildRoutePreamble()
  if (injectJsx) preamble += buildMountPreamble()

  magicString.prepend(preamble)
  magicString.append(buildHotFooter(injectRoutes, injectJsx))

  return {
    code: magicString.toString(),
    map: magicString.generateMap({ hires: true }),
    routes: injectRoutes,
    jsx: injectJsx,
  }
}
