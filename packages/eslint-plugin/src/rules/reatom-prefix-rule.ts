import type { Rule } from 'eslint'
import type {
  ArrowFunctionExpression,
  CallExpression,
  Identifier,
  Literal,
  ObjectExpression,
} from 'estree'
import {
  extractAssignedVariableName,
  extractImportDeclaration,
  traverseBy,
} from '../lib'

type ReatomPrefixCallExpression = CallExpression & {
  callee: Identifier
  arguments:
    | [ArrowFunctionExpression]
    | [ArrowFunctionExpression, Literal]
    | [ArrowFunctionExpression, ObjectExpression]
}

export const reatomPrefixRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every reatom* call',
    },
    messages: {
      noname: `variable assigned to {{ methodName }} should has a name "{{ assignedVariable }}" inside {{ methodName }} call`,
      invalidName: `variable assigned to {{ methodName }} should be named as it's variable name, rename it to "{{ assignedVariable }}"`,
    },
    fixable: 'code',
  },
  create: function (context: Rule.RuleContext): Rule.RuleListener {
    const importedFromReatom = new Map<string, string>()

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          from: node,
          importsAlias: importedFromReatom,
          packageName: '@reatom',
          filter: (name) => name.startsWith('reatom'),
        })
      },
      CallExpression(node) {
        const methods = Array.from(importedFromReatom.values())
        const imported =
          'name' in node.callee && methods.includes(node.callee.name)

        if (!isReatomPrefixCallExpression(node) || !imported) {
          return
        }

        const matchBy = new Set([
          'VariableDeclarator',
          'PropertyDefinition',
          'Property',
        ])

        const assignedVariable = traverseBy('parent', {
          match: matchBy,
          node,
        })

        const assignedVariableName = extractAssignedVariableName(assignedVariable)

        if (!assignedVariableName) {
          return
        }

        const initArguments = node.arguments

        const reportMessageConfig = {
          methodName: node.callee.name,
          assignedVariable: assignedVariableName,
        }

        if (initArguments.length === 1) {
          context.report({
            node,
            messageId: 'noname',
            data: reportMessageConfig,
            fix(fixer) {
              return fixer.insertTextAfter(
                initArguments[0],
                `, "${assignedVariableName}"`,
              )
            },
          })
        }

        if (initArguments.length === 2) {
          const last = initArguments[1]

          if (last?.type === 'Literal' && last.value !== assignedVariableName) {
            context.report({
              node,
              messageId: 'invalidName',
              data: reportMessageConfig,
              fix(fixer) {
                return fixer.replaceText(last, `"${assignedVariableName}"`)
              },
            })
          }

          if (initArguments[1]?.type === 'ObjectExpression') {
            const methodConfig = initArguments[1]

            if (
              methodConfig.properties.every(
                (value) =>
                  value.type === 'Property' &&
                  value.key.type === 'Identifier' &&
                  value.key.name !== 'name',
              ) &&
              'properties' in methodConfig
            ) {
              const beforeInsert = methodConfig.properties.at(0)

              if (!beforeInsert) return

              context.report({
                node,
                messageId: 'noname',
                data: reportMessageConfig,
                fix: (fixer) =>
                  fixer.insertTextBefore(
                    beforeInsert,
                    `name: "${assignedVariableName}", `,
                  ),
              })
            }

            const badProperty = initArguments[1].properties.find(
              (value) =>
                value.type === 'Property' &&
                value.key.type === 'Identifier' &&
                value.key.name === 'name' &&
                value.value.type === 'Literal' &&
                value.value.value !== assignedVariableName,
            )

            if (badProperty) {
              context.report({
                node,
                messageId: 'invalidName',
                data: reportMessageConfig,
                fix(fixer) {
                  return fixer.replaceText(
                    badProperty.value,
                    `"${assignedVariableName}"`,
                  )
                },
              })
            }
          }
        }
      },
    }
  },
}

function isReatomPrefixCallExpression(
  node?: CallExpression | null,
): node is ReatomPrefixCallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    (node.arguments.length === 1 ||
      (node.arguments.length === 2 && node.arguments[1]?.type == 'Literal') ||
      (node.arguments.length === 2 &&
        node.arguments[1]?.type == 'ObjectExpression'))
  )
}
