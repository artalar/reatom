import { Rule } from 'eslint'
import {
  CallExpression,
  Identifier,
  Literal,
  VariableDeclarator,
  Node,
} from 'estree'
import { extractImportDeclaration, isIdentifier, isLiteral } from '../lib'

type AtomCallExpression = CallExpression & {
  callee: Identifier
  arguments: [Literal] | [Literal, Literal]
}
type AtomVariableDeclarator = VariableDeclarator & {
  id: Identifier
  init: AtomCallExpression
}

const noname = (atomName: string) =>
  `atom "${atomName}" should has a name inside atom() call`
const invalidName = (atomName: string) =>
  `atom "${atomName}" should be named as it's variable name, rename it to "${atomName}"`

export const atomRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Add name for every atom call',
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
        })
      },
      VariableDeclarator: (d) => {
        if (!isAtomVariableDeclarator(d, importedFromReatom)) return

        if (d.init.arguments.length === 1) {
          reportUndefinedAtomName(context, d)
        } else if (
          isLiteral(d.init.arguments[1]) &&
          d.init.arguments[1].value !== d.id.name
        ) {
          reportBadAtomName(context, d)
        }
      },
    }
  },
}

function isAtomCallExpression(
  node: Node | null | undefined,
  imported: Map<string, string>,
): node is AtomCallExpression {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    imported.get('atom') === node.callee.name
  )
}

function isAtomVariableDeclarator(
  node: VariableDeclarator,
  importedFromReatom: Map<string, string>,
): node is AtomVariableDeclarator {
  return isAtomCallExpression(node.init, importedFromReatom) && isIdentifier(node.id)
}

function reportUndefinedAtomName(
  context: Rule.RuleContext,
  d: AtomVariableDeclarator,
) {
  context.report({
    message: noname(d.id.name),
    node: d,
    fix: (fixer) =>
      fixer.insertTextAfter(d.init.arguments[0], `, "${d.id.name}"`),
  })
}

function reportBadAtomName(
  context: Rule.RuleContext,
  d: AtomVariableDeclarator,
) {
  context.report({
    message: invalidName(d.id.name),
    node: d,
    fix: (fixer) => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`),
  })
}
