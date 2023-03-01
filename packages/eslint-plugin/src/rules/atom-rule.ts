import { Rule } from "eslint";

export const atomRule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: "Add name for every atom call"
        },
        fixable: 'code'
    },
    create: function (context: Rule.RuleContext): Rule.RuleListener {
        return {
            VariableDeclaration: node => {
                node.declarations.forEach(d => {
                    if (d.init?.type !== 'CallExpression') return;
                    if (d.init.callee.type !== 'Identifier') return;
                    if (d.init.callee.name !== 'atom') return;
                    if (d.id.type !== 'Identifier') return;

                    if (d.init.arguments.length === 1) {
                        context.report({ 
                            message: `atom name is not defined`,
                            node,
                            fix: fixer => fixer.insertTextAfterRange(d.init.arguments[0].range, `, "${d.id.name}"`)
                        })
                    }

                    if (d.init.arguments[1]?.type !== 'Literal') return;

                    if (d.init.arguments[1].value !== d.id.name) {
                        context.report({
                             message: `atom name is defined bad`, 
                             node,
                             fix: fixer => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`)
                        })
                    }
                })
            }
        };
    }
}
