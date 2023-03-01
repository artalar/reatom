import { Rule } from "eslint";

export const reatomPrefixRule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: "Add name for every reatom* call"
        },
        fixable: 'code'
    },
    create: function (context: Rule.RuleContext): Rule.RuleListener {
        return {
            VariableDeclarator: d => {
                if (d.init?.type !== 'CallExpression') return;
                if (d.init.callee.type !== 'Identifier') return;
                if (!d.init.callee.name.startsWith('reatom')) return;
                if (d.id.type !== 'Identifier') return;

                if (d.init.arguments[0]?.type === 'ArrowFunctionExpression') {
                    if (d.init.arguments.length === 1) {
                        context.report({
                            message: `some reatom* name is not defined`,
                            node: d,
                            fix: fixer => fixer.insertTextAfter(d.init.arguments[0], `, "${d.id.name}"`)
                        })
                    }

                    if (d.init.arguments.length === 2) {
                        if (d.init.arguments[1]?.type === 'Literal' && d.init.arguments[1].value !== d.id.name) {
                            context.report({
                                message: `some reatom* name is defined bad`,
                                node: d,
                                fix: fixer => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`)
                            })
                        }

                        if (d.init.arguments[1]?.type === 'ObjectExpression') {
                            if (d.init.arguments[1].properties.some(value => value.type === 'Property' && value.key.type === 'Identifier')) {
                                if (!d.init.arguments[1].properties.some(value => value.key.name === 'name')) {
                                    context.report({
                                        message: `some reatom* name is not defined`,
                                        node: d,
                                        fix: fixer => fixer.insertTextBefore(d.init.arguments[1].properties[0], `name: "${d.id.name}", `)
                                    })
                                }

                                const badProperty = d.init.arguments[1].properties.find(
                                    value =>
                                        value.type === 'Property' &&
                                        value.key.type === 'Identifier' &&
                                        value.key.name === 'name' &&
                                        value.value.type === 'Literal' &&
                                        value.value.value !== d.id.name
                                )

                                if (badProperty) {
                                    context.report({
                                        message: `some reatom* name is defined bad`,
                                        node: d,
                                        fix: fixer => fixer.replaceText(badProperty.value, `"${d.id.name}"`)
                                    })
                                }
                            }
                        }
                    }
                }
            }
        };
    }
}
