import type { Rule } from 'eslint'
import type * as estree from 'estree'
import {
  extractAssignedVariableName,
  extractImportDeclaration,
  isLiteral,
  nearestParent,
} from '../lib'

export const atomRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every atom call',
    },
    fixable: 'code',
    messages: {
      nameMissing: `Atom "{{ atomName }}" is missing a name`,
      nameIncorrect: `Atom "{{ atomName }}" has incorrect name`,
    },
  },
  create: function (context: Rule.RuleContext): Rule.RuleListener {
    const reatomImports = new Map<string, string>()

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          node: node,
          importAliasMap: reatomImports,
          packagePrefix: '@reatom',
        })
      },
      CallExpression: (node) => {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== reatomImports.get('atom')
        ) {
          return
        }

        const atomVariable = nearestParent(node, [
          'VariableDeclarator',
          'PropertyDefinition',
          'Property',
        ])

        const atomName = extractAssignedVariableName(atomVariable)
        if (!atomName) return

        if (node.arguments.length === 1) {
          const source = node.arguments[0]!
          context.report({
            messageId: 'nameMissing',
            node: node.callee,
            data: { atomName },
            fix: (fixer) => {
              return fixer.insertTextAfter(source, `, "${atomName}"`)
            },
          })
          return
        }

        if (!validAtomVariable(node, atomName)) {
          const source = node.arguments[1]!
          context.report({
            messageId: 'nameIncorrect',
            node: source,
            data: { atomName },
            fix: (fixer) => {
              return fixer.replaceText(source, `"${atomName}"`)
            },
          })
        }
      },
    }
  },
}

function validAtomVariable(node: estree.CallExpression, correctName: string) {
  if (isLiteral(node.arguments[1])) {
    return node.arguments[1].value === correctName
  }

  return true
}
