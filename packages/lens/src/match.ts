import {
  Atom,
  Ctx,
  CtxSpy,
  Fn,
  __count,
  atom,
  isAtom,
  throwReatomError,
} from '@reatom/core'
import { isDeepEqual, merge } from '@reatom/utils'

interface Match<Expression = any, State = never, Default = undefined>
  extends Atom<State | Default> {
  is<T>(
    clause:
      | Expression
      | Atom<Expression>
      | ((ctx: Ctx, expression: Expression) => boolean),
    statement: T | Atom<T> | ((ctx: CtxSpy, expression: Expression) => T),
  ): Match<Expression, State | T, Default>
  truthy<T>(
    statement: T | Atom<T> | ((ctx: CtxSpy, expression: Expression) => T),
  ): Match<Expression, State | T, Default>
  falsy<T>(
    statement: T | Atom<T> | ((ctx: CtxSpy, expression: Expression) => T),
  ): Match<Expression, State | T, Default>
  default<T = never>(
    statement?: T | Atom<T> | ((ctx: CtxSpy, expression: Expression) => T),
  ): Match<Expression, State, T>
}

export function match<T>(
  expression: T | Atom<T> | ((ctx: CtxSpy) => T),
  name = __count('match'),
): Match<T> {
  const cases: Array<{
    clause: (ctx: Ctx, expression: T) => boolean
    statement: {} | Atom | ((ctx: Ctx, expression: T) => any)
  }> = []
  let _truthy: (typeof cases)[number]
  let _falsy: (typeof cases)[number]
  let _default: (typeof cases)[number]

  const theAtom = atom((ctxSpy) => {
    const value = isAtom(expression)
      ? ctxSpy.spy(expression)
      : typeof expression === 'function'
      ? (expression as Fn)(ctxSpy)
      : expression
    const ctx = merge(ctxSpy, { spy: undefined })
    const list = [...cases, _truthy, _falsy, _default].filter(Boolean)

    for (const { clause, statement } of list) {
      if (clause(ctx, value)) {
        return isAtom(statement)
          ? ctxSpy.spy(statement)
          : typeof statement === 'function'
          ? statement(ctxSpy, value)
          : statement
      }
    }
    return undefined
  }, name)

  return Object.assign(theAtom, {
    is(clause: any, statement: any) {
      cases.push({
        clause: isAtom(clause)
          ? (ctx, value) => Object.is(value, ctx.get(clause))
          : typeof clause === 'function'
          ? clause
          : (ctx, value) => Object.is(value, clause),
        statement,
      })
      return theAtom
    },
    truthy(statement: any) {
      throwReatomError(_truthy, 'the case is already defined')
      _truthy = { clause: (ctx, value) => !!value, statement }
      return theAtom
    },
    falsy(statement: any) {
      throwReatomError(_falsy, 'the case is already defined')
      _falsy = { clause: (ctx, value) => !value, statement }
      return theAtom
    },
    default(statement = () => throwReatomError(true, 'no match') as never) {
      throwReatomError(_default, 'the case is already defined')
      _default = { clause: (ctx, value) => true, statement }
      return theAtom
    },
  }) as Match<T>
}
