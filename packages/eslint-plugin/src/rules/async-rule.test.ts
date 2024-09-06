import { RuleTester } from 'eslint'
import { asyncRule } from './async-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

const ImportReatomAsync = 'import {reatomAsync} from "@reatom/framework"'
const ImportReatomAsyncAlias = 'import {reatomAsync as createAsync} from "@reatom/framework"'

tester.run('async-rule', asyncRule, {
  valid: [
    `${ImportReatomAsync}; const reatomSome = reatomAsync(async ctx => await ctx.schedule(() => someEffect()))`,
    `${ImportReatomAsyncAlias}; const reatomSome = createAsync(async ctx => await ctx.schedule(() => someEffect()))`,
  ],
  invalid: [
    {
      code: `${ImportReatomAsync}; const reatomSome = reatomAsync(async ctx => await someEffect())`,
      errors: [{ messageId: 'scheduleMissing' }],
      output: `${ImportReatomAsync}; const reatomSome = reatomAsync(async ctx => await ctx.schedule(() => someEffect()))`,
    },
  ],
})
