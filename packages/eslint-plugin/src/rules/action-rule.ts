import type { Rule } from 'eslint'
import type {
  CallExpression,
  Identifier,
  Literal,
  ArrowFunctionExpression,
} from 'estree'
import {
  extractAssignedVariable,
  extractImportDeclaration,
  isLiteral,
  traverseBy,
} from '../lib'

type ActionCallExpression = CallExpression & {
  callee: Identifier
  arguments:
    | []
    | [Literal]
    | [ArrowFunctionExpression]
    | [ArrowFunctionExpression, Literal]
}

export const actionRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every action call',
    },
    messages: {
      noname: `action "{{ actionName }}" should has a name inside action() call`,
      invalidName: `action "{{ actionName }}" should be named as it's variable name, rename it to "{{ actionName }}"`,
    },
    fixable: 'code',
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const importedFromReatom = new Map<string, string>()

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          from: node,
          importsAlias: importedFromReatom,
          packageName: '@reatom',
        })
      },
      CallExpression(node) {
        if (!isActionCallExpression(node, importedFromReatom)) return

        const matchBy = new Set([
          'VariableDeclarator',
          'PropertyDefinition',
          'Property',
        ])

        const actionVariable = traverseBy('parent', {
          match: matchBy,
          node,
        })

        const actionName = extractAssignedVariable(actionVariable)

        if (!actionName) {
          return
        }

        const amountOfArguments = node.arguments.length

        if (amountOfArguments === 0 && node.arguments) {
          const sourceCode = context.getSourceCode()
          const parenthesesToken = sourceCode.getTokens(node)

          const [betweenParentheses] = parenthesesToken.filter((token, idx) => {
            return (
              token.value === '(' && parenthesesToken[idx + 1]?.value === ')'
            )
          })

          if (!betweenParentheses) return

          context.report({
            node,
            messageId: 'noname',
            data: { actionName },
            fix(fixer) {
              return fixer.insertTextAfter(
                betweenParentheses,
                `"${actionName}"`,
              )
            },
          })
          return
        }

        if (
          isLiteral(node.arguments[0]) &&
          node.arguments[0].value !== actionName
        ) {
          context.report({
            node,
            messageId: 'invalidName',
            data: { actionName },
            fix(fixer) {
              return fixer.replaceText(node.arguments[0], `"${actionName}"`)
            },
          })
          return
        }

        if (node.arguments[0].type === 'ArrowFunctionExpression') {
          if (amountOfArguments === 1) {
            const afterInsert = node.arguments[0]

            context.report({
              node,
              messageId: 'noname',
              data: { actionName },
              fix(fixer) {
                return fixer.insertTextAfter(afterInsert, `, "${actionName}"`)
              },
            })
            return
          }

          if (
            amountOfArguments === 2 &&
            node.arguments[1].value !== actionName
          ) {
            const forReplace = node.arguments[1]

            context.report({
              node,
              messageId: 'invalidName',
              data: { actionName },
              fix(fixer) {
                return fixer.replaceText(forReplace, `"${actionName}"`)
              },
            })
            return
          }
        }
      },
    }
  },
}

function isActionCallExpression(
  node: CallExpression,
  importedFromReatom: Map<string, string>,
): node is ActionCallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    importedFromReatom.get('action') === node.callee.name &&
    (node.arguments.length === 0 ||
      (node.arguments.length === 1 && node.arguments[0]?.type === 'Literal') ||
      (node.arguments.length === 1 &&
        node.arguments[0]?.type === 'ArrowFunctionExpression') ||
      (node.arguments.length === 2 &&
        node.arguments[0]?.type === 'ArrowFunctionExpression' &&
        node.arguments[1]?.type == 'Literal'))
  )
}
