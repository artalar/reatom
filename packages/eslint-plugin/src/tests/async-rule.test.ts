import { RuleTester } from 'eslint'
import { asyncRule } from '../rules/async-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('async-rule', asyncRule, {
  valid: [
    'const reatomSomething = reatomAsync(async ctx => await ctx.schedule(() => doSomething()))',
  ],
  invalid: [
    {
      code: 'const reatomSomething = reatomAsync(async ctx => await doSomething())',
      errors: 1,
      output:
        'const reatomSomething = reatomAsync(async ctx => await ctx.schedule(() => doSomething()))',
    },
  ],
})
