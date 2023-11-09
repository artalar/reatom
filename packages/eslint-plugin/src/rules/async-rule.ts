import type { Rule } from 'eslint'
import type * as estree from 'estree'

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
    return {
      AwaitExpression(node) {
        if (!isReatomFunction(node)) return
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

const isReatomFunction = (node: estree.Node & Rule.NodeParentExtension) => {
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
    const name = node.parent.callee.name
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
