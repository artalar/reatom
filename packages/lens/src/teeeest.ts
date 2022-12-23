import { action, atom, createCtx } from '@reatom/core'
import { filter } from '.'

let res = []

const fib = (n: number): number => (n < 2 ? 1 : fib(n - 1) + fib(n - 2))

const hard = (n: number) => n + fib(16)

const set = action()
const A = atom(0)
const B = atom(0)
const C = atom((ctx) => (ctx.spy(A) % 2) + (ctx.spy(B) % 2))
const D = atom((ctx) => [ctx.spy(A) - ctx.spy(B)] as const).pipe(filter((ctx, a, b) => a[0] !== b[0]))
const E = atom((ctx) => hard(ctx.spy(C) + ctx.spy(A) + ctx.spy(D)[0]))
const F = atom((ctx) => {
  const state = ctx.spy(D)[0]
  console.log('F', state)
  return hard(state && ctx.spy(B))
})
const G = atom(
  (ctx) => ctx.spy(C) + (ctx.spy(C) || ctx.spy(E)) + ctx.spy(D)[0] + ctx.spy(F),
)
const ctx = createCtx()
let H = ctx.subscribe(G, (v) => {
  res.push(hard(v))
  console.log('H')
})
let I = ctx.subscribe(G, (v) => {
  res.push(v)
  console.log('I')
})
let J = ctx.subscribe(F, (v) => {
  res.push(hard(v))
  console.log('J')
})

ctx.get( ()=> { B( ctx, 1 ); A( ctx, 1 ) } )
ctx.get( ()=> { A( ctx, 2 ); B( ctx, 2 ) } )
ctx.get( ()=> { B( ctx, 1 ); A( ctx, 1 ) } )
ctx.get( ()=> { A( ctx, 2 ); B( ctx, 2 ) } )
