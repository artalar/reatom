export type { FilterConfigInput } from './engine'
export { createEngineManager } from './engine'
export { createExpressionManager, evaluateExpression } from './expression'
export type { AtomRegistry, FrameIndex } from './predicates'
export {
  evaluatePredicate,
  matchCause,
  matchError,
  matchKind,
  matchRegex,
  matchSession,
  matchText,
  matchTimeRange,
} from './predicates'
export { createSearchManager } from './search'
export { createTagsManager } from './tags'
