import type { Rule } from 'eslint'
import type { CallExpression, Identifier, Literal, Node } from 'estree'
import {
    extractAssignedVariable,
  extractAssignedVariableName,
  extractImportDeclaration,
  isLiteral,
  traverseBy,
} from '../lib'
import { isAtomCallExpression } from './atom-rule'

type AtomCallExpression = CallExpression & {
  callee: Identifier
  arguments: [Literal] | [Literal, Literal]
}

export const atomPostfixRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Check postfix for every atom',
    },
    fixable: 'code',
    messages: {
      incorrectVariableName: `atom "{{ atomName }}" should have postfix "{{ postfix }}"`,
    },
  },
  create: function (context: Rule.RuleContext): Rule.RuleListener {
    const importedFromReatom = new Map<string, string>()
    const postfix = context.settings.atomPostfix;
    const badPostfix = (atomName: string) => {
        if (!postfix) return false;

        return !atomName.endsWith(postfix)
    };

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
        const atomIdentifier = extractAssignedVariable(atomVariable);

        if (!atomName || !atomIdentifier) {
          return
        }

        if (badPostfix(atomName)) {
            reportIncorrectVariableName({
            context,
            messageId: 'incorrectVariableName',
            source: atomIdentifier,
            incorrectName: atomName,
            correctName: `${atomName}${postfix}`,
            highlightNode: atomIdentifier,
            postfix
          })
        }
      },
    }
  },
}

function reportIncorrectVariableName(config: {
  messageId: 'incorrectVariableName'
  context: Rule.RuleContext
  highlightNode: Node
  correctName: string
  incorrectName: string
  source: Node
  postfix: string
}) {
  const { source, incorrectName, correctName, highlightNode, context, postfix } = config

  context.report({
    messageId: config.messageId,
    node: highlightNode,
    data: { atomName: incorrectName, postfix },
    fix(fixer) {
        return fixer.replaceText(source, correctName)
    },
  })
}
