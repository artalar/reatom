import { Rule } from 'eslint'
import {
  ArrowFunctionExpression,
  CallExpression,
  Identifier,
  Literal,
  Node,
  VariableDeclarator,
  ObjectExpression,
} from 'estree'
import { extractImportDeclaration, isIdentifier } from '../lib'

type ReatomPrefixCallExpression = CallExpression & {
  callee: Identifier
  arguments:
    | [ArrowFunctionExpression]
    | [ArrowFunctionExpression, Literal]
    | [ArrowFunctionExpression, ObjectExpression]
}
type ReatomPrefixVariableDeclarator = VariableDeclarator & {
  id: Identifier
  init: ReatomPrefixCallExpression
}

const noname = (varName: string) =>
  `variable with prefix reatom "${varName}" should has a name inside reatom*() call`
const invalidName = (varName: string) =>
  `variable with prefix reatom "${varName}" should be named as it's variable name, rename it to "${varName}"`

export const reatomPrefixRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every reatom* call',
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

      VariableDeclarator: (node) => {
        const methods = Array.from(importedFromReatom.values())
        const imported =
          node.init?.type === 'CallExpression' &&
          'name' in node.init?.callee &&
          methods.includes(node.init.callee.name)

        if (!isReatomPrefixVariableDeclarator(node) || !imported) {
          return
        }

        const initArguments = node.init.arguments

        if (initArguments.length === 1) {
          context.report({
            message: noname(node.id.name),
            node,
            fix: (fixer) =>
              fixer.insertTextAfter(initArguments[0], `, "${node.id.name}"`),
          })
        }

        if (initArguments.length === 2) {
          if (
            initArguments[1]?.type === 'Literal' &&
            initArguments[1].value !== node.id.name
          ) {
            context.report({
              message: invalidName(node.id.name),
              node,
              fix: (fixer) =>
                fixer.replaceText(initArguments[1], `"${node.id.name}"`),
            })
          }

          if (initArguments[1]?.type === 'ObjectExpression') {
            if (
              initArguments[1].properties.every(
                (value) =>
                  value.type === 'Property' &&
                  value.key.type === 'Identifier' &&
                  value.key.name !== 'name',
              )
            ) {
              context.report({
                message: noname(node.id.name),
                node,
                fix: (fixer) =>
                  fixer.insertTextBefore(
                    // TODO fix this
                    // @ts-ignore
                    initArguments[1]?.properties[0],
                    `name: "${node.id.name}", `,
                  ),
              })
            }

            const badProperty = initArguments[1].properties.find(
              (value) =>
                value.type === 'Property' &&
                value.key.type === 'Identifier' &&
                value.key.name === 'name' &&
                value.value.type === 'Literal' &&
                value.value.value !== node.id.name,
            )

            if (badProperty) {
              context.report({
                message: invalidName(node.id.name),
                node,
                fix: (fixer) =>
                  fixer.replaceText(badProperty.value, `"${node.id.name}"`),
              })
            }
          }
        }
      },
    }
  },
}

function isReatomPrefixCallExpression(
  node?: Node | null,
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

function isReatomPrefixVariableDeclarator(
  node: VariableDeclarator,
): node is ReatomPrefixVariableDeclarator {
  return isReatomPrefixCallExpression(node?.init) && isIdentifier(node.id)
}
