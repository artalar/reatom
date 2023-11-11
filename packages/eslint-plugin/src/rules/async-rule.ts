import type { Rule } from 'eslint'
import type * as estree from 'estree'
import { extractImportDeclaration } from '../lib'

const ReatomFactoryNames = ['atom', 'action']
const ReatomFactoryPrefix = 'reatom'

export const asyncRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      recommended: true,
      description:
        'Ensures that asynchronous interactions within Reatom functions are wrapped with `ctx.schedule`.',
    },
    messages: {},
    fixable: 'code',
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const reatomImportMap = new Map<string, string>()

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          node,
          packagePrefix: '@reatom',
          importAliasMap: reatomImportMap,
        })
      },
      AwaitExpression(node) {
        if (!isReatomFunction(reatomImportMap, node)) return
        if (isCtxSchedule(node.argument)) return

        context.report({
          node,
          message:
            'Asynchronous interactions within Reatom functions should be wrapped with `ctx.schedule`',
          fix: (fixer) => wrapScheduleFix(fixer, node),
        })
      },
    }
  },
}

const isReatomFunction = (
  reatomImportMap: ReadonlyMap<string, string>,
  node: estree.Node & Rule.NodeParentExtension,
) => {
  while (
    node &&
    !(
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionExpression'
    )
  ) {
    node = node.parent
  }

  if (!node) return false

  if (
    node.parent.type === 'CallExpression' &&
    node.parent.callee.type === 'Identifier'
  ) {
    let name: string | null = null
    for (const [key, value] of reatomImportMap) {
      if (value === node.parent.callee.name) name = key
    }
    if (!name) return false
    if (ReatomFactoryNames.includes(name)) return true
    if (name.startsWith(ReatomFactoryPrefix)) return true
  }

  return false
}

const isCtxSchedule = (node: estree.Node) => {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'Identifier' &&
    node.callee.object.name === 'ctx' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'schedule'
  )
}

const wrapScheduleFix = (
  fixer: Rule.RuleFixer,
  node: estree.AwaitExpression,
) => [
  fixer.insertTextBefore(node.argument, 'ctx.schedule(() => '),
  fixer.insertTextAfter(node.argument, ')'),
]
