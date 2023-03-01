import { Rule } from "eslint";

export const actionRule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: "Add name for every action call"
        },
        fixable: 'code'
    },
    create: function (context: Rule.RuleContext): Rule.RuleListener {
        return {
            VariableDeclarator: d => {
                if (d.init?.type !== 'CallExpression') return;
                if (d.init.callee.type !== 'Identifier') return;
                if (d.init.callee.name !== 'action') return;
                if (d.id.type !== 'Identifier') return;
                
                if (d.init.arguments.length === 0) {
                    context.report({ 
                        message: `action name is not defined`,
                        node: d,
                        fix: fixer => fixer.replaceTextRange(d.init.range, `action("${d.id.name}")`)
                    })
                }

                if (d.init.arguments[0]?.type === 'Literal' && d.init.arguments[0].value !== d.id.name) {
                    context.report({
                        message: `action name is defined bad`, 
                        node: d,
                        fix: fixer => fixer.replaceText(d.init.arguments[0], `"${d.id.name}"`)
                    })
                }

                if (d.init.arguments[0]?.type === 'ArrowFunctionExpression') {
                    if (d.init.arguments.length === 1) {
                        context.report({ 
                            message: `action name is not defined`,
                            node: d,
                            fix: fixer => fixer.insertTextAfterRange(d.init.arguments[0].range, `, "${d.id.name}"`)
                        })
                    }

                    if (d.init.arguments.length === 2 && d.init.arguments[1]?.type === 'Literal' && d.init.arguments[1].value !== d.id.name) {
                        context.report({
                            message: `action name is defined bad`, 
                            node: d,
                            fix: fixer => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`)
                        })
                    }
                }
            }
        };
    }
}
