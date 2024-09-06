import { Rule } from 'eslint'
import type * as estree from 'estree'

const ReatomFactoryNames = ['atom', 'action']
const ReatomFactoryPrefix = 'reatom'

export const isReatomFactoryName = (name: string) => {
  return (
    ReatomFactoryNames.includes(name) || //
    name.startsWith(ReatomFactoryPrefix)
  )
}

export const createImportMap = (packagePrefix: string) => {
  const imported = new Map<string, string>()
  const local = new Map<string, string>()

  const onImportNode = (node: estree.ImportDeclaration) => {
    const source = node.source.value
    if (typeof source !== 'string' || !source.startsWith(packagePrefix)) {
      return
    }

    for (const spec of node.specifiers) {
      if (spec.type === 'ImportSpecifier') {
        onImportSpec(spec)
      }
    }
  }

  const onImportSpec = (spec: estree.ImportSpecifier) => {
    imported.set(spec.imported.name, spec.local.name)
    local.set(spec.local.name, spec.imported.name)
  }

  return {
    onImportNode,
    imported: imported as ReadonlyMap<string, string>,
    local: local as ReadonlyMap<string, string>,
  }
}

export const ascend = <Type extends estree.Node['type']>(node: estree.Node, ...types: Array<Type>) => {
  while (node && !types.includes(node.type as any)) {
    node = (node as any).parent
  }

  return node as Extract<Rule.Node, { type: Type }> | undefined
}

export const getFunctionNameDeclarations = (
  fn: estree.FunctionExpression | estree.ArrowFunctionExpression | estree.FunctionDeclaration,
  names: string[],
) => {
  const stack = [...fn.params] as estree.Node[]

  if (fn.body.type === 'BlockStatement') {
    for (const statement of fn.body.body) {
      if (statement.type !== 'VariableDeclaration') continue
      for (const declaration of statement.declarations) {
        stack.push(declaration.id)
      }
    }
  }

  const result = [] as string[]

  let top: estree.Node | undefined
  while ((top = stack.pop())) {
    if (top.type === 'AssignmentPattern') {
      top = top.left
    }

    if (top.type === 'RestElement') {
      top = top.argument
    }

    if (top.type === 'ObjectPattern') {
      for (const property of top.properties) {
        stack.push(property.value)
      }
    }

    if (top.type === 'ArrayPattern') {
      for (const element of top.elements) {
        stack.push(element)
      }
    }

    if (top.type === 'Identifier' && names.includes(top.name)) {
      result.push(top.name)
    }
  }

  return result
}
