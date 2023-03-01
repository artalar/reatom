import { Rule } from "eslint";
import { CallExpression, Identifier, Literal, VariableDeclarator, ArrowFunctionExpression } from "estree";
import { isIdentifier, isLiteral } from "../lib";

type ActionCallExpression =
    CallExpression
    & { callee: Identifier, arguments: [] | [Literal] | [ArrowFunctionExpression] | [ArrowFunctionExpression, Literal] }
type ActionVariableDeclarator = VariableDeclarator & { id: Identifier, init: ActionCallExpression }

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
                if (!isActionVariableDeclarator(d)) return;

                const initArgs = d.init.arguments;

                if (initArgs.length === 0) {
                    context.report({
                        message: `action name is not defined`,
                        node: d,
                        fix: fixer => fixer.replaceText(d.init, `action("${d.id.name}")`)
                    });
                    return;
                }

                if (isLiteral(initArgs[0]) && initArgs[0].value !== d.id.name) {
                    context.report({
                        message: `action name is defined bad`,
                        node: d,
                        fix: fixer => fixer.replaceText(initArgs[0], `"${d.id.name}"`)
                    });
                    return;
                }

                if (initArgs[0].type === 'ArrowFunctionExpression') {
                    if (initArgs.length === 1) {
                        context.report({
                            message: `action name is not defined`,
                            node: d,
                            fix: fixer => fixer.insertTextAfter(d.init.arguments[0], `, "${d.id.name}"`)
                        });
                        return;
                    }

                    if (initArgs.length === 2 && initArgs[1].value !== d.id.name) {
                        context.report({
                            message: `action name is defined bad`,
                            node: d,
                            fix: fixer => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`)
                        });
                        return;
                    }
                }
            }
        };
    }
}

function isActionCallExpression(node: any): node is ActionCallExpression {
    return node?.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name === 'action' &&
        (node.arguments.length === 0 ||
            (node.arguments.length === 1 && node.arguments[0].type === 'Literal') ||
            (node.arguments.length === 1 && node.arguments[0].type === 'ArrowFunctionExpression') ||
            (node.arguments.length === 2 && node.arguments[0].type === 'ArrowFunctionExpression' && node.arguments[1].type == 'Literal'));
}

function isActionVariableDeclarator(node: any): node is ActionVariableDeclarator {
    return isActionCallExpression(node.init) && isIdentifier(node.id);
}
