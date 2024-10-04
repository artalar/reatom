import * as estree from 'estree'
import { Rule } from 'eslint'
import { checkCallExpressionNode } from '../shared'

const importsMap = {
  wrap: 'import { wrap } from "@reatom/framework";\n',
  schedule: 'import { schedule } from "@reatom/framework";\n',
}

const getTextToReplace = (nText: string, callbackText: string) => {
  if (Boolean(nText)) {
    return `schedule(ctx, ${callbackText}, ${nText})`
  }
  return `wrap(ctx, ${callbackText})`
}

const getMessage = (n?: estree.Expression | estree.SpreadElement) => {
  if (Boolean(n)) {
    return "Use 'schedule(ctx, cb, n)' instead of deprecated 'ctx.schedule(cb, n)'."
  }

  return "Use 'wrap(ctx, cb)' instead of deprecated 'ctx.schedule(cb, n)'."
}

const isImportICareAbout = (node: estree.ImportDeclaration) => {
  return node.specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' &&
      (specifier.imported.name === 'wrap' || specifier.imported.name === 'schedule') &&
      node.source.value === '@reatom/framework',
  )
}

export const deprecateCtxScheduleRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Method 'ctx.schedule' is deprecated in v4",
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [],
  },
  create(context) {
    let hasImport = false
    let lastImport: estree.ImportDeclaration | null = null

    return {
      ImportDeclaration(node: estree.ImportDeclaration) {
        lastImport = node
        if (isImportICareAbout(node)) {
          hasImport = true
        }
      },

      CallExpression(node: estree.CallExpression) {
        if (checkCallExpressionNode(node)) {
          let cb = node.arguments[0]
          let n = node.arguments[1]

          context.report({
            node,
            message: getMessage(n),
            fix(fixer) {
              const fixes = []
              const sourceCode = context.sourceCode

              const callbackText = cb ? sourceCode.getText(cb) : '() => {}'
              const nText = n ? sourceCode.getText(n) : ''

              fixes.push(fixer.replaceText(node, getTextToReplace(nText, callbackText)))

              if (!hasImport) {
                const newImport = importsMap[n ? 'schedule' : 'wrap']
                fixes.push(
                  lastImport
                    ? fixer.insertTextBefore(lastImport, newImport)
                    : fixer.insertTextAfterRange([0, 0], newImport),
                )
              }

              return fixes
            },
          })
        }
      },
    }
  },
}
