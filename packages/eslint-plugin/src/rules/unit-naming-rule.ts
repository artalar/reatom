import * as estree from 'estree'
import { Rule } from 'eslint'
import { patternNames, reatomFactoryPattern } from '../shared'

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
    schema: [
      {
        type: 'object',
        properties: {
          atomPrefix: {
            type: 'string',
          },
          atomSuffix: {
            type: 'string',
          },
          domainVariable: {
            type: 'string',
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: 'code',
  },

  create(context) {
    const {
      atomPrefix = '',
      atomSuffix = '',
      domainVariable = 'name',
    }: {
      atomPrefix?: string
      atomSuffix?: string
      domainVariable?: string
    } = context.options[0] ?? {}

    const domainScopes = [] as (Domain | null)[]
    const idScopes = [] as (estree.Identifier | null)[]

    return {
      ':matches(VariableDeclarator, Property)'(node: estree.VariableDeclarator | estree.Property) {
        const id = node.type === 'Property' ? node.key : node.id
        idScopes.push(id.type === 'Identifier' ? id : null)
      },
      ':matches(VariableDeclarator, Property):exit'() {
        idScopes.pop()
      },
      [`:function`](node: estree.Function) {
        const variDeclarators =
          node.body.type === 'BlockStatement'
            ? node.body.body.flatMap((statement) =>
                statement.type === 'VariableDeclaration' ? statement.declarations : [],
              )
            : []
        const patterns = [...node.params, ...variDeclarators.map((d) => d.id)]
        const declaresDomain = !!patterns.flatMap(patternNames).find((id) => id.name === domainVariable)

        if (declaresDomain) domainScopes.push({ is: 'dynamic', vary: domainVariable })
        else if ('id' in node && node.id) domainScopes.push({ is: 'static', name: node.id.name })
        else domainScopes.push(null)
      },
      [`:function:exit`](node: estree.Function) {
        domainScopes.pop()
      },
      [`CallExpression[callee.name=${reatomFactoryPattern}]`](node: estree.CallExpression) {
        const args = node.arguments
        const nameNode =
          args.length === 2
            ? args[1]
            : args.length === 1 && args[0]!.type === 'ObjectExpression'
            ? args[0].properties.find(({ key }) => key.type === 'Identifier' && key.name === 'name')
            : undefined

        const unit = idScopes.at(-1)
        if (!unit) return
        const domain = domainScopes.findLast((scope) => scope !== null) || { is: 'absent' }

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

        const replaceNameFix = (fixer: Rule.RuleFixer, local = false) =>
          fixer.replaceText(
            nameNode,
            printName({
              domain,
              local,
              unit: unit.name,
            }),
          )

        let parsedName: Name | undefined
        parseName: {
          if (nameNode.type === 'Literal' && typeof nameNode.value === 'string') {
            const matches = nameNode.value.match(/^(?:([\w$]+)\.)?(_)?([\w$]+)$/)
            if (!matches) break parseName
            const domainName = matches[1]
            const local = !!matches[2]
            const unit = matches[3]!
            const domain: Domain = domainName ? { is: 'static', name: domainName } : { is: 'absent' }
            parsedName = { domain, local, unit }
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
            message: 'Unit name must be a correctly formatted string literal',
            fix: replaceNameFix,
          })
          return
        }

        let message: string | undefined
        checkName: {
          if (parsedName.unit !== unit.name) {
            message = `Unit name must be "${unit.name}"`
            break checkName
          }
          if (JSON.stringify(parsedName.domain) !== JSON.stringify(domain)) {
            if (domain.is === 'absent') message = 'Unit name must have no domain'
            if (domain.is === 'dynamic') message = `Unit domain must be set to the value of "${domain.vary}" variable`
            if (domain.is === 'static') message = `Unit domain must be "${domain.name}"`
            break checkName
          }
        }
        if (message) {
          context.report({ node: nameNode, message, fix: (fixer) => replaceNameFix(fixer, parsedName.local) })
        }

        if (!parsedName.unit.startsWith(atomPrefix)) {
          context.report({
            node: nameNode,
            message: `Atom name must start with "${atomPrefix}"`,
            fix: (fixer) => [
              fixer.replaceText(
                nameNode,
                printName({ ...parsedName, unit: atomPrefix + parsedName.unit + atomSuffix }),
              ),
              fixer.replaceText(unit, atomPrefix + unit.name + atomSuffix),
            ],
          })
        }
        if (!parsedName.unit.endsWith(atomSuffix)) {
          context.report({
            node: nameNode,
            message: `Atom name must end with "${atomPrefix}"`,
            fix: (fixer) => [
              fixer.replaceText(nameNode, printName({ ...parsedName, unit: parsedName.unit + atomSuffix })),
              fixer.replaceText(unit, unit.name + atomSuffix),
            ],
          })
        }
      },
    }
  },
}

function printName(name: Name) {
  const base = (name.local ? '_' : '') + name.unit
  if (name.domain.is === 'dynamic') return '`${' + name.domain.vary + '}.' + base + '`'
  if (name.domain.is === 'static') return `'${name.domain.name}.${base}'`
  return `'${base}'`
}
