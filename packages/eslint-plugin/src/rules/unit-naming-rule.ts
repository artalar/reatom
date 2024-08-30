import * as estree from 'estree'
import { Rule } from 'eslint'
import { createImportMap } from '../shared'

const reatomFactoryList = ['atom', 'action', 'reaction'] as const
const reatomFactoryPattern = new RegExp(`^(reatom\w+|${reatomFactoryList.join('|')})$`)

type Domain = { is: 'absent' } | { is: 'static'; name: string } | { is: 'dynamic'; vary: string }

interface Name {
  domain: Domain
  local: boolean
  unit: string
}

export const unitNamingRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      recommended: true,
      description: 'Ensures that all Reatom entities are correctly named.',
    },
    fixable: 'code',
  },

  create(context) {
    const importMap = createImportMap('@reatom/')

    const {
      atomPrefix = '',
      atomSuffix = '',
      domainVary = 'name',
    }: {
      atomPrefix?: string
      atomSuffix?: string
      domainVary?: string
    } = context.options[0] ?? {}

    const domainScopes: Domain[] = [{ is: 'absent' }]
    const unitScopes = [] as estree.Identifier[]

    return {
      [`CallExpression[callee.name=${reatomFactoryPattern}]`](node: estree.CallExpression) {
        const args = node.arguments
        const nameNode =
          args.length === 2
            ? args[1]
            : args.length === 1 && args[0]!.type === 'ObjectExpression'
            ? args[0].properties.find(({ key }) => key.type === 'Identifier' && key.name === 'name')
            : undefined

        const unit = unitScopes.at(-1)
        if (!unit) return
        const domain = domainScopes.at(-1)!

        if (!nameNode) {
          let fix: Rule.ReportFixer | undefined

          if (args.length === 1) {
            const printedName = printName({
              domain,
              local: false,
              unit: unit.name,
            })
            if (args[0]!.type === 'ObjectExpression') {
              const config = args[0]
              if (config.properties.length) {
                const comma = context.sourceCode.getText().endsWith(',') ? '' : ', '
                fix = (fixer) => fixer.insertTextAfter(config.properties.at(-1)!, `${comma}name: ${printedName}`)
              } else {
                fix = (fixer) => fixer.replaceText(config, `{ name: ${printedName} }`)
              }
            } else {
              fix = (fixer) => fixer.insertTextAfter(args[0]!, `, ${printedName}`)
            }
          }

          context.report({
            node,
            message: `"${(node.callee as estree.Identifier).name}" call is missing a name`,
            fix,
          })
          return
        }

        const replaceNameFix = (fixer: Rule.RuleFixer) =>
          fixer.replaceText(
            nameNode,
            printName({
              domain,
              local: false,
              unit: unit.name,
            }),
          )

        let parsedName: Name | undefined
        parseName: {
          if (nameNode.type === 'Literal' && typeof nameNode.value === 'string') {
            const matches = nameNode.value.match(/^(?:(\w+)\.)?(_)?(\w+)$/)
            if (!matches) break parseName
            const domainName = matches[1]!
            const local = !!matches[2]
            const unit = matches[3]!
            parsedName = { domain: { is: 'static', name: domainName }, local, unit }
          }

          if (nameNode.type === 'TemplateLiteral') {
            if (nameNode.expressions.length !== 1) break parseName
            if (nameNode.expressions[0]!.type !== 'Identifier') break parseName
            if (nameNode.quasis.length !== 2) break parseName
            if (nameNode.quasis[0]!.value.raw !== '') break parseName
            if (!nameNode.quasis[1]!.value.raw.startsWith('.')) break parseName
            const domainVary = nameNode.expressions[0].name
            const local = nameNode.quasis[1]!.value.raw[1] === '_'
            const unit = nameNode.quasis[1]!.value.raw.slice(local ? 2 : 1)
            parsedName = { domain: { is: 'dynamic', vary: domainVary }, local, unit }
          }
        }
        if (!parsedName) {
          context.report({
            node: nameNode,
            message: 'Unit name is malformed',
            fix: replaceNameFix,
          })
          return
        }

        const message =
          parsedName.unit === unit.name
            ? (
                parsedName.domain.is === domain.is && parsedName.domain.is === 'static'
                  ? parsedName.domain.name === (domain as any).name
                  : parsedName.domain.is === 'dynamic'
                  ? parsedName.domain.vary !== (domain as any).vary
                  : false
              )
              ? undefined
              : 'Unit domain is incorrect'
            : 'Unit name is incorrect'

        if (message) {
          context.report({ node: nameNode, message, fix: replaceNameFix })
        }
      },
    }
  },
}

function printName(name: Name) {
  const base = (name.local ? '_' : '') + name.unit
  if (name.domain.is === 'dynamic') return '`${' + name.domain.vary + '}.' + base
  if (name.domain.is === 'static') return `"${name.domain.name}".${base}`
  return `"${base}"`
}
