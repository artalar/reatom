import { Rule } from "eslint";
import { ArrowFunctionExpression, CallExpression, Identifier, Literal, Node, VariableDeclarator, ObjectExpression } from "estree";
import { isIdentifier } from "../lib";

type ReatomPrefixCallExpression =
    CallExpression
    & { callee: Identifier, arguments: [ArrowFunctionExpression] | [ArrowFunctionExpression, Literal] | [ArrowFunctionExpression, ObjectExpression] }
type ReatomPrefixVariableDeclarator = VariableDeclarator & { id: Identifier, init: ReatomPrefixCallExpression }

const noname = (varName: string) => `variable with prefix reatom "${varName}" should has a name inside reatom*() call`;
const invalidName = (varName: string) => `variable with prefix reatom "${varName}" should be named as it's variable name, rename it to "${varName}"`;

export const reatomPrefixRule: Rule.RuleModule = {
    meta: {
        type: 'suggestion',
        docs: {
            description: "Add name for every reatom* call"
        },
        fixable: 'code'
    },
    create: function (context: Rule.RuleContext): Rule.RuleListener {
        let importedFromReatom = false;

        return {
            ImportSpecifier(node) {
                // @ts-ignore
                const from = node.parent.source.value;
                if (from.startsWith('@reatom')) {
                    importedFromReatom = true;
                }
            },
            VariableDeclarator: d => {
                if (!isReatomPrefixVariableDeclarator(d) || !importedFromReatom) return;

                const initArguments = d.init.arguments

                if (initArguments.length === 1) {
                    context.report({
                        message: noname(d.id.name),
                        node: d,
                        fix: fixer => fixer.insertTextAfter(initArguments[0], `, "${d.id.name}"`)
                    })
                }

                if (initArguments.length === 2) {
                    if (initArguments[1]?.type === 'Literal' && initArguments[1].value !== d.id.name) {
                        context.report({
                            message: invalidName(d.id.name),
                            node: d,
                            fix: fixer => fixer.replaceText(initArguments[1], `"${d.id.name}"`)
                        })
                    }

                    if (initArguments[1]?.type === 'ObjectExpression') {
                        if (initArguments[1].properties.every(value => value.type === 'Property' && value.key.type === 'Identifier' && value.key.name !== 'name')) {
                            context.report({
                                message: noname(d.id.name),
                                node: d,
                                // TODO fix this
                                // @ts-ignore
                                fix: fixer => fixer.insertTextBefore(initArguments[1]?.properties[0], `name: "${d.id.name}", `)
                            })
                        }

                        const badProperty = initArguments[1].properties.find(
                            value =>
                                value.type === 'Property' &&
                                value.key.type === 'Identifier' &&
                                value.key.name === 'name' &&
                                value.value.type === 'Literal' &&
                                value.value.value !== d.id.name
                        )

                        if (badProperty) {
                            context.report({
                                message: invalidName(d.id.name),
                                node: d,
                                fix: fixer => fixer.replaceText(badProperty.value, `"${d.id.name}"`)
                            })
                        }
                    }
                }                           
            }
        };
    }
}


function isReatomPrefixCallExpression(node?: Node | null): node is ReatomPrefixCallExpression {
    return node?.type === 'CallExpression' &&
        node.callee?.type === 'Identifier' &&
        node.callee.name.startsWith('reatom') &&
        (
            node.arguments.length === 1 ||
            (node.arguments.length === 2 && node.arguments[1]?.type == 'Literal') ||
            (node.arguments.length === 2 && node.arguments[1]?.type == 'ObjectExpression')
        )
}

function isReatomPrefixVariableDeclarator(node: VariableDeclarator): node is ReatomPrefixVariableDeclarator {
    return isReatomPrefixCallExpression(node?.init) && isIdentifier(node.id);
}
