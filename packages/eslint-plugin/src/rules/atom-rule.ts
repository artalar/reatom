import type { Rule } from 'eslint'
import type { CallExpression, Identifier, Literal, Node } from 'estree'
import {
  extractAssignedVariableName,
  extractImportDeclaration,
  isLiteral,
  traverseBy,
} from '../lib'

type AtomCallExpression = CallExpression & {
  callee: Identifier
  arguments: [Literal] | [Literal, Literal]
}

export const atomRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every atom call',
    },
    fixable: 'code',
    messages: {
      missingName: `atom "{{ atomName }}" should has a name inside atom() call`,
      unCorrectName: `atom "{{ atomName }}" should be named as it's variable name, rename it to "{{ atomName }}"`,
      incorrectVariableName: `atom "{{ atomName }}" should have postfix "{{ postfix }}"`,
    },
  },
  create: function (context: Rule.RuleContext): Rule.RuleListener {
    const importedFromReatom = new Map<string, string>()
    const missedName = (amountOfArguments: number) => amountOfArguments === 1

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          from: node,
          importsAlias: importedFromReatom,
          packageName: '@reatom',
        })
      },
      CallExpression: (node) => {
        if (!isAtomCallExpression(node, importedFromReatom)) return

        const matchBy = new Set([
          'VariableDeclarator',
          'PropertyDefinition',
          'Property',
        ])

        const atomVariable = traverseBy('parent', {
          match: matchBy,
          node,
        })

        const atomName = extractAssignedVariableName(atomVariable)

        if (!atomName) {
          return
        }

        if (missedName(node.arguments.length)) {
          reportUnCorrectName({
            context,
            messageId: 'missingName',
            source: node.arguments[0],
            changeType: 'insertBefore',
            correctName: atomName,
            highlightNode: node.callee,
          })
        } else if (!validAtomVariable(node, atomName)) {
          reportUnCorrectName({
            context,
            messageId: 'unCorrectName',
            source: node.arguments[1],
            changeType: 'replace',
            correctName: atomName,
            highlightNode: node.callee,
          })
        }
      },
    }
  },
}

function validAtomVariable(node: CallExpression, correctName: string) {
  return isLiteral(node.arguments[1]) && node.arguments[1].value === correctName
}

function reportUnCorrectName(config: {
  messageId: 'unCorrectName' | 'missingName'
  context: Rule.RuleContext
  changeType: 'replace' | 'insertBefore'
  highlightNode: Node
  correctName: string
  source: Node
}) {
  const { source, correctName, highlightNode, changeType, context } = config

  context.report({
    messageId: config.messageId,
    node: highlightNode,
    data: { atomName: correctName },
    fix(fixer) {
      return changeType === 'replace'
        ? fixer.replaceText(source, `"${correctName}"`)
        : fixer.insertTextAfter(source, `, "${correctName}"`)
    },
  })
}

export function isAtomCallExpression(
  node: CallExpression,
  imported: Map<string, string>,
): node is AtomCallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    imported.get('atom') === node.callee.name
  )
}
