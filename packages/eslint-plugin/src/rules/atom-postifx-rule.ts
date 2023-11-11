import type { Rule } from 'eslint'
import type { CallExpression, Identifier, Literal, Node } from 'estree'
import {
  extractAssignedVariable,
  extractAssignedVariableName,
  extractImportDeclaration,
  isLiteral,
  traver../shared
} from '../lib'
import { isAtomCall } from './atom-rule'

const match = new Set(['VariableDeclarator', 'PropertyDefinition', 'Property'])

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
    const postfix = context.settings.atomPostfix ?? 'Atom'
    const badPostfix = (atomName: string) => !atomName.endsWith(postfix)

    return {
      ImportDeclaration(node) {
        extractImportDeclaration({
          from: node,
          importsAlias: importedFromReatom,
          packageName: '@reatom',
        })
      },
      CallExpression: (node) => {
        if (!isAtomCall(node, importedFromReatom)) return

        const atomVariable = traverseBy('parent', {
          match,
          node,
        })

        const atomName = extractAssignedVariableName(atomVariable)
        const atomIdentifier = extractAssignedVariable(atomVariable)

        if (!atomName || !atomIdentifier) {
          return
        }

        if (badPostfix(atomName)) {
          reportIncorrectVariableName({
            context,
            messageId: 'incorrectVariableName',
            source: atomIdentifier,
            nameIncorrect: atomName,
            correctName: `${atomName}${postfix}`,
            highlightNode: atomIdentifier,
            postfix,
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
  nameIncorrect: string
  source: Node
  postfix: string
}) {
  const {
    source,
    nameIncorrect,
    correctName,
    highlightNode,
    context,
    postfix,
  } = config

  context.report({
    messageId: config.messageId,
    node: highlightNode,
    data: { atomName: nameIncorrect, postfix },
    fix(fixer) {
      return fixer.replaceText(source, correctName)
    },
  })
}
