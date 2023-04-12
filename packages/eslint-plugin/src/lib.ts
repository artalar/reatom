import type { Identifier, Literal, Node, ImportDeclaration } from 'estree'

export function isIdentifier(node: Node): node is Identifier {
  return node?.type === 'Identifier'
}

export function isLiteral(node: any): node is Literal {
  return node && 'type' in node && node.type === 'Literal'
}

export interface ExtractConfig {
  from: ImportDeclaration
  packageName: string
  importsAlias: Map<string, string>
  nodeMap?: Map<string, Node>
  filter?: (original: string, local: string) => boolean
}

export function extractImportDeclaration({
  from,
  packageName,
  importsAlias,
  nodeMap,
  filter = () => true,
}: ExtractConfig) {
  const imported = from.source.value

  if (typeof imported === 'string' && imported.startsWith(packageName)) {
    for (const method of from.specifiers) {
      if (method.type === 'ImportDefaultSpecifier') continue

      if ('imported' in method && Boolean(method.imported)) {
        const localName = method.local.name
        const originalName = method.imported.name

        if (filter(originalName, localName)) {
          importsAlias.set(originalName, localName)
          nodeMap?.set(originalName, method)
        }
      }
    }
  }
}

export function traverseBy<T extends Node>(
  field: keyof T,
  config: {
    node: T
    match: Set<string>
    exit?: string[]
  },
) {
  const { match, exit = ['Program'], node } = config

  const stack = [node]

  while (stack.length > 0) {
    const currentNode = stack.pop()

    if (
      !currentNode ||
      !includeField(currentNode, field) ||
      exit.includes(currentNode.type)
    ) {
      return null
    }

    if (match.has(currentNode.type)) {
      return currentNode
    }

    stack.push(currentNode[field] as T)
  }

  return null
}

function includeField<T extends Node>(node: Partial<T>, field: keyof T) {
  return node && field in node && Boolean(node[field])
}
