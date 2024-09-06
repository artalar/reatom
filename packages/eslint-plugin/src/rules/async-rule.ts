import type { Rule } from 'eslint'
import type * as estree from 'estree'
import { ascend, createImportMap, isReatomFactoryName } from '../shared'

const ReatomFactoryPrefix = 'reatom'

export const asyncRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      recommended: true,
      description: 'Ensures that asynchronous interactions within Reatom functions are wrapped with `ctx.schedule`.',
    },
    messages: {
      scheduleMissing: 'Asynchronous interactions within Reatom functions should be wrapped with `ctx.schedule`',
    },
    fixable: 'code',
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const imports = createImportMap('@reatom')

    return {
      ImportDeclaration: imports.onImportNode,
      AwaitExpression(node) {
        const fn = ascend(node, 'ArrowFunctionExpression', 'FunctionExpression')
        if (!fn) return

        if (fn.parent.type !== 'CallExpression') return
        if (fn.parent.callee.type !== 'Identifier') return
        if (!isReatomFactoryName(fn.parent.callee.name)) return

        if (isCtxSchedule(node.argument)) return

        context.report({
          node,
          messageId: 'scheduleMissing',
          fix: (fixer) => wrapScheduleFix(fixer, node),
        })
      },
    }
  },
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

const wrapScheduleFix = (fixer: Rule.RuleFixer, node: estree.AwaitExpression) => [
  fixer.insertTextBefore(node.argument, 'ctx.schedule(() => '),
  fixer.insertTextAfter(node.argument, ')'),
]
