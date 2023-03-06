import { Identifier, Literal, Node } from "estree";

export function isIdentifier(node: Node): node is Identifier {
    return node?.type === 'Identifier';
}

export function isLiteral(node: Node): node is Literal {
    return node?.type === 'Literal';
}
