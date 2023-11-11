import { RuleTester } from 'eslint'
import { actionRule } from './action-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('reatom/action-rule', actionRule, {
  valid: [
    {
      code: `
        import { action } from '@reatom/framework'
        const doSome = action("doSome");
      `,
    },
    {
      code: `
        import { action } from '@reatom/framework'
        const doSome = action(() => {}, "doSome");
      `,
    },
    {
      code: `
        import { action } from '@reatom/framework'
        const doSome = action(() => {}, \`\${domain}.doSome\`);
      `,
    },
    {
      code: `const doSome = action();`,
    },
    {
      code: `const doSome = action("do");`,
    },
    {
      code: `const doSome = action(() => {});`,
    },
    {
      code: `const doSome = action(() => {}, "do");`,
    },
    {
      code: `const doSome = action(() => {}, \`\${domain}.doSome\`);`,
    },
  ],
  invalid: [
    {
      code: `
            import { action } from '@reatom/framework'
            const doSome = action();
            `,
      errors: [
        { message: 'action "doSome" should has a name inside action() call' },
      ],
      output: `
            import { action } from '@reatom/framework'
            const doSome = action("doSome");
            `,
    },
    {
      code: `
            import { action } from '@reatom/framework'
            const doSome = action("do");
            `,
      errors: [
        {
          message: `action "doSome" should be named as it's variable name, rename it to "doSome"`,
        },
      ],
      output: `
            import { action } from '@reatom/framework'
            const doSome = action("doSome");
            `,
    },
    {
      code: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {});
            `,
      errors: [
        { message: `action "doSome" should has a name inside action() call` },
      ],
      output: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "doSome");
            `,
    },
    {
      code: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "do");
            `,
      errors: [
        {
          message: `action "doSome" should be named as it's variable name, rename it to "doSome"`,
        },
      ],
      output: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "doSome");
            `,
    },
    {
      code: `
      import { action as createAction } from '@reatom/framework'
      const inputChanged = createAction(() => {})
      `,
      errors: [
        {
          message: `action "inputChanged" should has a name inside action() call`,
        },
      ],
      output: `
      import { action as createAction } from '@reatom/framework'
      const inputChanged = createAction(() => {}, "inputChanged")
      `,
    },
    {
      code: `
      import { action } from "@reatom/framework"
      const handler = {
        draggable: action(ctx => {})
      }
      `,
      errors: [
        {
          message: `action "draggable" should has a name inside action() call`,
        },
      ],
      output: `
      import { action } from "@reatom/framework"
      const handler = {
        draggable: action(ctx => {}, "draggable")
      }
      `,
    },
    {
      code: `
      import { action } from "@reatom/framework";
      const SomeModule = () => {
        const factory = () => {
          return action(ctx => {}, "")
        }
        return factory
      }
      `,
      errors: [
        {
          message: `action "factory" should be named as it's variable name, rename it to "factory"`,
        },
      ],
      output: `
      import { action } from "@reatom/framework";
      const SomeModule = () => {
        const factory = () => {
          return action(ctx => {}, "factory")
        }
        return factory
      }
      `,
    },
  ],
})
