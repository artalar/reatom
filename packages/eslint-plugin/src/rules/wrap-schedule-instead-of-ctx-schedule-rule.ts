import * as estree from 'estree'
import { Rule } from 'eslint'
import { checkCallExpressionNodeValid } from '../shared'

const importsMap = {
  wrap: 'import { wrap } from "@reatom/framework";\n',
  schedule: 'import { schedule } from "@reatom/framework";\n',
}

type TImport = keyof typeof importsMap

const getTextToReplace = (numberArgumentText: string, callbackArgumentText: string) => {
  if (Boolean(numberArgumentText)) {
    return `schedule(ctx, ${callbackArgumentText}, ${numberArgumentText})`
  }
  return `wrap(ctx, ${callbackArgumentText})`
}

const getMessage = (n?: estree.Expression | estree.SpreadElement) => {
  if (Boolean(n)) {
    return "Use 'schedule(ctx, cb, n)' instead of deprecated 'ctx.schedule(cb, n)'."
  }
  return "Use 'wrap(ctx, cb)' instead of deprecated 'ctx.schedule(cb)'."
}

export const wrapScheduleInsteadOfCtxScheduleRule: Rule.RuleModule = {
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
    let exsistsImportSpecifiers = new Set()

    return {
      ImportDeclaration(node: estree.ImportDeclaration) {
        if (node.source.value === '@reatom/framework') {
          lastImport = node

          node.specifiers.forEach((specifier) => {
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported &&
              specifier.imported.type === 'Identifier' &&
              importsMap[specifier.imported.name as TImport]
            ) {
              hasImport = true
              exsistsImportSpecifiers.add(specifier.imported.name)
            }
          })
        }
      },

      CallExpression(node: estree.CallExpression) {
        if (checkCallExpressionNodeValid(node)) {
          let callbackArgument = node.arguments[0]
          let numberArgument = node.arguments[1]

          context.report({
            node,
            message: getMessage(numberArgument),
            fix(fixer) {
              const fixes = [] as Rule.Fix[]
              const sourceCode = context.sourceCode
              const callbackArgumentText = callbackArgument ? sourceCode.getText(callbackArgument) : '() => {}'
              const numberArgumentText = numberArgument ? sourceCode.getText(numberArgument) : ''

              fixes.push(fixer.replaceText(node, getTextToReplace(numberArgumentText, callbackArgumentText)))

              const neededImport = numberArgument ? 'schedule' : 'wrap'

              if (!exsistsImportSpecifiers.has(neededImport)) {
                if (hasImport && lastImport) {
                  const exsistedSpecifier = lastImport.specifiers.find(
                    (specifier) =>
                      specifier.type == 'ImportSpecifier' &&
                      specifier.imported &&
                      specifier.imported.type === 'Identifier' &&
                      Object.keys(importsMap).includes(specifier.imported.name),
                  )

                  if (exsistedSpecifier) {
                    fixes.push(fixer.insertTextAfter(exsistedSpecifier, `, ${neededImport}`))
                  }
                } else {
                  const importToAdd = importsMap[neededImport]
                  fixes.push(
                    lastImport
                      ? fixer.insertTextBefore(lastImport, importToAdd)
                      : fixer.insertTextAfterRange([0, 0], importToAdd),
                  )
                }
              }

              return fixes
            },
          })
        }
      },
    }
  },
}
