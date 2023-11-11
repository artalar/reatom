import { Rule } from 'eslint'
import type * as estree from 'estree'

export function isId(node?: estree.Node): node is estree.Identifier {
  return node?.type === 'Identifier'
}

export function isLiteral(node?: estree.Node): node is estree.Literal {
  return node?.type === 'Literal'
}

export function isTemplateLiteral(
  node?: estree.Node,
): node is estree.TemplateLiteral {
  return node?.type === 'TemplateLiteral'
}

export function extractImportDeclaration({
  node,
  importAliasMap,
  nodeMap,
  packagePrefix,
  filter = () => true,
}: {
  importAliasMap: Map<string, string>
  nodeMap?: Map<string, estree.Node>
  node: estree.ImportDeclaration
  packagePrefix: string
  filter?: (original: string, local: string) => boolean
}) {
  const imported = node.source.value

  if (typeof imported === 'string' && imported.startsWith(packagePrefix)) {
    for (const method of node.specifiers) {
      if (method.type === 'ImportDefaultSpecifier') continue

      if ('imported' in method && Boolean(method.imported)) {
        const localName = method.local.name
        const originalName = method.imported.name

        if (filter(originalName, localName)) {
          importAliasMap.set(originalName, localName)
          nodeMap?.set(originalName, method)
        }
      }
    }
  }

  return { importAliasMap, nodeMap }
}

export function extractAssignedVariableName(node: estree.Node | null) {
  const identifier = extractAssignedVariable(node)
  if (!identifier) return null

  return identifier.name
}

export function extractAssignedVariable(node: estree.Node | null) {
  if (node?.type === 'VariableDeclarator' && (node as any).id?.name) {
    return node.id
  }

  return (node as any)?.key?.type === 'Identifier' ? (node as any).key : null
}

export function nearestParent(
  node: estree.Node & Rule.NodeParentExtension,
  types: ReadonlyArray<string>,
): estree.Node | null {
  while (node?.type !== 'Program') {
    if (types.includes(node.type)) return node
    node = node.parent
  }

  return null
}
