import { deprecateCtxScheduleRule } from "./wrap-schedule-instead-of-ctx-schedule-rule";

const { RuleTester } = require("eslint");


const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run(
  "wrap-schedule-instead-ctx-schedule",
  deprecateCtxScheduleRule,
  {
    valid: [
      {
        code: `import { wrap } from "@reatom/framework";\nwrap(ctx, () => {})`,
      },
      {
        code: `import { wrap } from "@reatom/framework";\nwrap(ctx, () => 'Dev')`,
      },
      {
        code: `import { schedule } from "@reatom/framework";\nschedule(ctx, () => 'Dev', -1)`,
      },
      {
        code: `import { schedule } from "@reatom/framework";\nschedule(ctx, () => 'Dev', -1)`,
      },

    ],
    invalid: [
      {
        code: "ctx.schedule()",
        output: `import { wrap } from "@reatom/framework";\nwrap(ctx, () => {})`,
        errors: [{message: "Use 'wrap(ctx, cb)' instead of deprecated 'ctx.schedule(cb, n)'."}]
      },
      {
        code: "ctx.schedule(() => 'Dev')",
        output: `import { wrap } from "@reatom/framework";\nwrap(ctx, () => 'Dev')`,
        errors: [{message: "Use 'wrap(ctx, cb)' instead of deprecated 'ctx.schedule(cb, n)'."}]
      },
      {
        code: "ctx.schedule(() => 'Dev', -1)",
        output: `import { schedule } from "@reatom/framework";\nschedule(ctx, () => 'Dev', -1)`,
        errors: [{message: "Use 'schedule(ctx, cb, n)' instead of deprecated 'ctx.schedule(cb, n)'."}]
      },
      {
        code: `import { schedule } from "@reatom/framework";\nctx.schedule(() => 'Dev', -1)`,
        output: `import { schedule } from "@reatom/framework";\nschedule(ctx, () => 'Dev', -1)`,
        errors: [{message: "Use 'schedule(ctx, cb, n)' instead of deprecated 'ctx.schedule(cb, n)'."}]
      },
    ],
  }
);
