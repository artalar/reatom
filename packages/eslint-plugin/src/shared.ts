import type * as estree from 'estree'

export const reatomFactoryList = ['atom', 'action', 'reaction'] as const
export const reatomFactoryPattern = new RegExp(`^(reatom\w+|${reatomFactoryList.join('|')})$`)

// export const createImportMap = (packagePrefix: string) => {
//   const imported = new Map<string, string>()
//   const local = new Map<string, string>()

//   const onImportNode = (node: estree.ImportDeclaration) => {
//     const source = node.source.value
//     if (typeof source !== 'string' || !source.startsWith(packagePrefix)) {
//       return
//     }

//     for (const spec of node.specifiers) {
//       if (spec.type === 'ImportSpecifier') {
//         onImportSpec(spec)
//       }
//     }
//   }

//   const onImportSpec = (spec: estree.ImportSpecifier) => {
//     imported.set(spec.imported.name, spec.local.name)
//     local.set(spec.local.name, spec.imported.name)
//   }

//   return {
//     onImportNode,
//     imported: imported as ReadonlyMap<string, string>,
//     local: local as ReadonlyMap<string, string>,
//   }
// }

export const patternNames = (pattern: estree.Pattern): estree.Identifier[] => {
  if (pattern.type === 'AssignmentPattern') {
    return patternNames(pattern.left)
  }
  if (pattern.type === 'Identifier') {
    return [pattern]
  }
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.flatMap(patternNames)
  }
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((property) => (property.key.type === 'Identifier' ? property.key : []))
  }
  return []
}
