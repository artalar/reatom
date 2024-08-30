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
