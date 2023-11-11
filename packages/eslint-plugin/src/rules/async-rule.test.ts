import { RuleTester } from 'eslint'
import { asyncRule } from './async-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('async-rule', asyncRule, {
  valid: [
    'import {reatomAsync} from "@reatom/framework"; const reatomSomething = reatomAsync(async ctx => await ctx.schedule(() => doSomething()))',
    'import {reatomAsync as createAsync} from "@reatom/framework"; const reatomSomething = createAsync(async ctx => await ctx.schedule(() => doSomething()))',
  ],
  invalid: [
    {
      code: 'import {reatomAsync} from "@reatom/framework"; const reatomSomething = reatomAsync(async ctx => await doSomething())',
      errors: 1,
      output:
        'import {reatomAsync} from "@reatom/framework"; const reatomSomething = reatomAsync(async ctx => await ctx.schedule(() => doSomething()))',
    },
    {
      code: 'import {reatomAsync as createAsync} from "@reatom/framework"; const reatomSomething = createAsync(async ctx => await doSomething())',
      errors: 1,
      output:
        'import {reatomAsync as createAsync} from "@reatom/framework"; const reatomSomething = createAsync(async ctx => await ctx.schedule(() => doSomething()))',
    },
  ],
})
