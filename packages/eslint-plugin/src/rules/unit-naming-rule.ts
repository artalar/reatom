import * as estree from 'estree'
import { Rule } from 'eslint'
import { ascend, createImportMap, getFunctionNameDeclarations, isReatomFactoryName } from '../shared'

type AutoDomain = typeof AutoDomain
const AutoDomain = Symbol('AutoDomain')

export const unitNamingRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      recommended: true,
      description: 'Ensures that all Reatom entities are correctly named.',
    },
    messages: {
      nameMissing: 'Unit "{{unit}}" is missing a name',
      nameIncorrect: 'Unit "{{unit}}" has malformed name',
      prefixMissing: 'Atom "{{unit}}" name should start with "{{prefix}}"',
      postfixMissing: 'Atom "{{unit}}" name should end with "{{postfix}}"',
    },
    fixable: 'code',
  },

  create(context) {
    const importMap = createImportMap('@reatom')

    const option = context.options[0] ?? {}
    const atomPrefix = option.atomPrefix ?? ''
    const atomPostfix = option.atomPostfix ?? ''

    return {
      ImportDeclaration: importMap.onImportNode,
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier') return
        if (!node.init) return

        const unitIdentifier = node.id
        const unitBody = node.init

        checkNaming({
          imports: importMap.imported,
          context,
          atomPrefix,
          atomPostfix,
          unitIdentifier,
          unitBody,
        })
      },
      Property(node) {
        if (node.key.type !== 'Identifier') return

        const unitIdentifier = node.key
        const unitBody = node.value

        checkNaming({
          imports: importMap.imported,
          context,
          atomPrefix,
          atomPostfix,
          unitIdentifier,
          unitBody,
        })
      },
    }
  },
}
function checkNaming({
  context,
  imports,
  atomPrefix,
  atomPostfix,
  unitIdentifier,
  unitBody,
}: {
  context: Rule.RuleContext
  imports: ReadonlyMap<string, string>
  atomPrefix: any
  atomPostfix: any
  unitIdentifier: estree.Identifier
  unitBody: estree.Node
}) {
  if (
    unitBody.type !== 'CallExpression' ||
    unitBody.callee.type !== 'Identifier' ||
    !isReatomFactoryName(imports.get(unitBody.callee.name) || unitBody.callee.name)
  ) {
    return
  }

  const [initArg, nameArg] = unitBody.arguments
  if (!initArg) return

  let factory: estree.FunctionDeclaration | estree.FunctionExpression | estree.ArrowFunctionExpression | undefined
  let domain: string | null | AutoDomain = null

  setFactory: {
    const parent = (unitBody as Rule.Node).parent
    const declaration = ascend(parent, 'FunctionDeclaration')
    if (declaration?.id?.name) {
      domain = declaration.id.name
      factory = declaration
      break setFactory
    }

    const declarator = ascend(parent.parent, 'VariableDeclarator')
    if (declarator?.id.type === 'Identifier') {
      domain = declarator.id.name
      factory = declarator.init as any
      break setFactory
    }
  }

  const nameVaryDeclared = factory ? getFunctionNameDeclarations(factory, ['name']).length === 1 : false
  if (nameVaryDeclared) domain = AutoDomain

  if (!nameArg) {
    context.report({
      node: unitBody,
      messageId: 'nameMissing',
      data: { unit: unitIdentifier.name },
      fix: (fixer) => {
        const x = insertUnitName({
          selfName: unitIdentifier.name,
          domain,
        })
        return fixer.insertTextAfter(initArg, `, ${x}`)
      },
    })
    return
  }

  let isPrivate = false
  let valid = false

  if (domain === AutoDomain) {
    validate: {
      if (nameArg.type !== 'TemplateLiteral') break validate
      if (nameArg.expressions.length !== 1) break validate

      const [emptyQuasy, nameSelf] = nameArg.quasis.map((quasy) => quasy.value.cooked)
      const nameDomain = nameArg.expressions[0]!

      if (emptyQuasy !== '') break validate
      if (nameDomain.type !== 'Identifier' || nameDomain.name !== 'name') break validate
      if (!nameSelf!.startsWith('.')) break validate

      isPrivate = nameSelf![1] === '_'
      if (nameSelf!.slice(isPrivate ? 2 : 1) !== unitIdentifier.name) break validate

      valid = true
    }
  } else {
    validate: {
      if (nameArg.type !== 'Literal') break validate
      if (typeof nameArg.value !== 'string') break validate

      const name = nameArg.value
      const [nameDomain, nameSelf] = name.includes('.') //
        ? name.split('.')
        : [null, name]

      if (nameDomain !== domain) break validate

      isPrivate = nameSelf![0] === '_'
      if (nameSelf!.slice(isPrivate ? 1 : 0) !== unitIdentifier.name) break validate

      valid = true
    }
  }

  if (!valid) {
    context.report({
      node: nameArg,
      messageId: 'nameIncorrect',
      data: {
        unit: unitIdentifier.name,
        domain: domain as string,
      },
      fix: (fixer) => {
        const x = insertUnitName({
          selfName: unitIdentifier.name,
          isPrivate,
          domain,
        })
        return fixer.replaceText(nameArg, x)
      },
    })
    return
  }

  if ((imports.get(unitBody.callee.name) ?? unitBody.callee.name) === 'atom') {
    if (!unitIdentifier.name.startsWith(atomPrefix)) {
      context.report({
        node: nameArg,
        messageId: 'prefixMissing',
        fix: (fixer) => {
          const x = insertUnitName({
            selfName: atomPrefix + unitIdentifier.name,
            isPrivate,
            domain,
          })
          return [fixer.replaceText(nameArg, x), fixer.replaceText(unitIdentifier, atomPrefix + unitIdentifier.name)]
        },
      })
      return
    }
    if (!unitIdentifier.name.endsWith(atomPostfix)) {
      context.report({
        node: nameArg,
        messageId: 'postfixMissing',
        fix: (fixer) => {
          const x = insertUnitName({
            selfName: unitIdentifier.name + atomPostfix,
            isPrivate,
            domain,
          })
          return [fixer.replaceText(nameArg, x), fixer.replaceText(unitIdentifier, unitIdentifier.name + atomPostfix)]
        },
      })
      return
    }
  }
}

const insertUnitName = ({
  selfName,
  domain,
  isPrivate = false,
}: {
  selfName: string
  domain: AutoDomain | string | null
  isPrivate?: boolean
}) => {
  if (isPrivate) selfName = '_' + selfName
  if (domain === AutoDomain) return '`${name}.' + selfName + '`'
  if (typeof domain === 'string') return `'${domain}.${selfName}'`
  return `'${selfName}'`
}
