import type * as estree from 'estree'

export const reatomFactoryList = ['atom', 'action', 'reaction'] as const
export const reatomFactoryPattern = new RegExp(`^(reatom\\w+|${reatomFactoryList.join('|')})$`)

export const patternNames = (pattern: estree.Pattern): estree.Identifier[] => {
  if (pattern.type === 'AssignmentPattern') {
    return patternNames(pattern.left)
  }
  if (pattern.type === 'Identifier') {
    return [pattern]
  }
  if (pattern.type === 'ArrayPattern') {
    return pattern.elements.flatMap(patternNames)
  }
  if (pattern.type === 'ObjectPattern') {
    return pattern.properties.flatMap((property) => (property.key.type === 'Identifier' ? property.key : []))
  }
  return []
}

export const checkCallExpressionNode = (node: estree.CallExpression) =>
  node.callee.type === 'MemberExpression' &&
  node.callee.object.type === 'Identifier' &&
  node.callee.property.type === 'Identifier'
