import { Rule } from "eslint";

export const atomRule: Rule.RuleModule = {
    create: function (context: Rule.RuleContext): Rule.RuleListener {
        return {
            VariableDeclaration: node => {
                node.declarations.forEach(d => {
                    if (d.init?.type !== 'CallExpression') return;
                    if (d.init.callee.type !== 'Identifier') return;
                    if (d.init.callee.name !== 'atom') return;
                    if (d.id.type !== 'Identifier') return;

                    if (d.init.arguments.length <= 1) {
                        context.report({ 
                            message: `atom name is not defined`,
                            node,
                        })
                    }

                    if (d.init.arguments[1]?.type !== 'Literal') return;

                    if (d.init.arguments[1].value !== d.id.name) {
                        context.report({ message: `atom name is defined bad`, node })
                    }
                })
            }
        };
    }
}
