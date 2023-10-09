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
  equal<T>(
    clause: {} | Atom | ((ctx: Ctx, expression: Expression) => boolean),
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

  cases: Array<{
    clause: (ctx: Ctx, expression: Expression) => boolean
    statement:
      | {}
      | Atom
      | ((ctx: Ctx, expression: Expression) => State | Default)
  }>
}

export function match<T>(
  expression: T | Atom<T> | ((ctx: CtxSpy) => T),
  name = __count('match'),
): Match<T> {
  const cases: Match<T>['cases'] = []
  const theAtom = atom((ctxSpy) => {
    const value = isAtom(expression)
      ? ctxSpy.spy(expression)
      : typeof expression === 'function'
      ? (expression as Fn)(ctxSpy)
      : expression
    const ctx = merge(ctxSpy, { spy: undefined })

    for (const { clause, statement } of cases) {
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
    equal(clause: any, statement: any) {
      cases.push({
        clause: isAtom(clause)
          ? (ctx, value) => isDeepEqual(value, ctx.get(clause))
          : typeof clause === 'function'
          ? clause
          : (ctx, value) => isDeepEqual(value, clause),
        statement,
      })
      return theAtom
    },
    truthy(statement: any) {
      cases.push({ clause: (ctx, value) => !!value, statement })
      return theAtom
    },
    falsy(statement: any) {
      cases.push({ clause: (ctx, value) => !value, statement })
      return theAtom
    },
    default(statement = () => throwReatomError(true, 'no match') as never) {
      cases.push({ clause: (ctx, value) => true, statement })
      return theAtom
    },

    cases,
  }) as Match<T>
}
