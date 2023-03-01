import {Rule} from "eslint";
import {CallExpression, Identifier, Literal, VariableDeclarator} from 'estree';
import {isIdentifier, isLiteral} from "../lib";

type AtomCallExpression = CallExpression & { callee: Identifier, arguments: [Literal] | [Literal, Literal] }
type AtomVariableDeclarator = VariableDeclarator & { id: Identifier, init: AtomCallExpression }
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
            VariableDeclarator: d => {
                if (!isAtomVariableDeclarator(d)) return;

                if (d.init.arguments.length === 1) {
                    reportUndefinedAtomName(context, d);
                } else if (isLiteral(d.init.arguments[1]) && d.init.arguments[1].value !== d.id.name) {
                    reportBadAtomName(context, d);
                }
            }
        };
    }
}

function isAtomCallExpression(node: any): node is AtomCallExpression {
    return node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'atom';
}

function isAtomVariableDeclarator(node: any): node is AtomVariableDeclarator {
    return isAtomCallExpression(node.init) && isIdentifier(node.id);
}

function reportUndefinedAtomName(context: Rule.RuleContext, d: AtomVariableDeclarator) {
    context.report({
        message: `atom name is not defined`,
        node: d,
        fix: fixer => fixer.insertTextAfter(d.init.arguments[0], `, "${d.id.name}"`)
    });
}

function reportBadAtomName(context: Rule.RuleContext, d: AtomVariableDeclarator) {
    context.report({
        message: `atom name is defined bad`,
        node: d,
        fix: fixer => fixer.replaceText(d.init.arguments[1], `"${d.id.name}"`)
    });
}
