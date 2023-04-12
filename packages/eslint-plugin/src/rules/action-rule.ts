import { Rule } from 'eslint'
import {
  CallExpression,
  Identifier,
  Literal,
  VariableDeclarator,
  ArrowFunctionExpression,
  Node,
} from 'estree'
import { extractImportDeclaration, isIdentifier, isLiteral } from '../lib'

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
      VariableDeclarator: (d) => {
        if (!isActionVariableDeclarator(d, importedFromReatom)) return

        const initArgs = d.init.arguments

        if (initArgs.length === 0) {
          context.report({
            message: noname(d.id.name),
            node: d,
            fix: (fixer) => fixer.replaceText(d.init, `action("${d.id.name}")`),
          })
          return
        }

        if (isLiteral(initArgs[0]) && initArgs[0].value !== d.id.name) {
          context.report({
            message: invalidName(d.id.name),
            node: d,
            fix: (fixer) => fixer.replaceText(initArgs[0], `"${d.id.name}"`),
          })
          return
        }

        if (initArgs[0].type === 'ArrowFunctionExpression') {
          if (initArgs.length === 1) {
            context.report({
              message: noname(d.id.name),
              node: d,
              fix: (fixer) =>
                fixer.insertTextAfter(d.init.arguments[0], `, "${d.id.name}"`),
            })
            return
          }

          if (initArgs.length === 2 && initArgs[1].value !== d.id.name) {
            context.report({
              message: invalidName(d.id.name),
              node: d,
              fix: (fixer) =>
                fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`),
            })
            return
          }
        }
      },
    }
  },
}

function isActionCallExpression(
  node: Node | null | undefined,
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

function isActionVariableDeclarator(
  node: VariableDeclarator,
  importedFromReatom: Map<string, string>,
): node is ActionVariableDeclarator {
  return (
    isActionCallExpression(node?.init, importedFromReatom) &&
    isIdentifier(node.id)
  )
}
