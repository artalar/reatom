import * as estree from 'estree'
import { Rule } from 'eslint'
import { createImportMap, isReatomFactoryName } from '../shared'

class UnitName {
  static fromString(string: string) {
    const parts = string.split('.')

    let unit = parts.length === 1 ? string : parts[1]!
    const domain = parts.length === 1 ? null : parts[0]!
    const isPrivate = unit.startsWith('_')
    if (isPrivate) unit = unit.slice(1)

    return new UnitName(unit, domain, isPrivate)
  }

  constructor(
    readonly unit: string,
    readonly domain: string | null,
    readonly isPrivate: boolean,
  ) {}

  rename(unit: string) {
    return new UnitName(unit, this.domain, this.isPrivate)
  }

  toString() {
    let result = this.unit
    if (this.isPrivate) result = '_' + result
    if (this.domain) result = this.domain + '.' + result
    return result
  }
}

export const unitNamingRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      recommended: true,
      description:
        'Ensures that all Reatom entities specify the name parameter.',
    },
    messages: {
      nameMissing: 'Unit "{{unit}}" is missing a name.',
      nameIncorrect: 'Unit "{{unit}}"" has incorrect name.',
      prefixMissing: 'Unit "{{unit}}" name should start with "{{prefix}}".',
      postfixMissing: 'Unit "{{unit}}" name should end with "{{postfix}}".',
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

        const vary = node.id
        const value = node.init

        checkNaming({
          imports: importMap.imported,
          context,
          atomPrefix,
          atomPostfix,
          vary,
          value,
        })
      },
      Property(node) {
        if (node.key.type !== 'Identifier') return

        const vary = node.key
        const value = node.value

        checkNaming({
          imports: importMap.imported,
          context,
          atomPrefix,
          atomPostfix,
          vary,
          value,
        })
      },
    }
  },
}

const checkNaming = ({
  imports,
  context,
  atomPrefix,
  atomPostfix,
  vary,
  value,
}: {
  imports: ReadonlyMap<string, string>
  context: Rule.RuleContext
  atomPrefix: string
  atomPostfix: string
  vary: estree.Identifier
  value: estree.Node
}) => {
  if (value.type !== 'CallExpression') return
  if (value.callee.type !== 'Identifier') return

  const factoryName = imports.get(value.callee.name)
  if (!factoryName) return
  if (!isReatomFactoryName(factoryName)) return

  const nameArg = value.arguments[1]
  if (nameArg?.type !== 'Literal' || typeof nameArg.value !== 'string') {
    context.report({
      node: value,
      messageId: 'nameMissing',
      data: { unit: vary.name },
      fix: (fixer) => {
        const arg = value.arguments[0]
        if (!arg) return []
        return fixer.insertTextAfter(arg, `, '${vary.name}'`)
      },
    })
    return
  }

  const name = UnitName.fromString(nameArg.value)

  if (factoryName === 'atom' && !name.unit.startsWith(atomPrefix)) {
    const correct = name.rename(atomPrefix + name.unit)

    context.report({
      node: nameArg,
      messageId: 'prefixMissing',
      data: { unit: vary.name, prefix: atomPrefix },
      fix: (fixer) => [
        fixer.replaceText(nameArg, `'${correct}'`),
        fixer.replaceText(vary, correct.unit),
      ],
    })
    return
  }

  if (factoryName === 'atom' && !name.unit.endsWith(atomPostfix)) {
    const correct = name.rename(name.unit + atomPostfix)

    context.report({
      node: nameArg,
      messageId: 'postfixMissing',
      data: { unit: vary.name, postfix: atomPostfix },
      fix: (fixer) => [
        fixer.replaceText(nameArg, `'${correct}'`),
        fixer.replaceText(vary, correct.unit),
      ],
    })
    return
  }

  if (name.unit !== vary.name) {
    const correct = name.rename(vary.name)

    context.report({
      node: nameArg,
      messageId: 'nameIncorrect',
      data: { unit: vary.name },
      fix: (fixer) => fixer.replaceText(nameArg, `'${correct}'`),
    })
    return
  }
}
