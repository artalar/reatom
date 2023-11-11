import { RuleTester } from 'eslint'
import { reatomPrefixRule } from './reatom-prefix-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})
const expectedReatomMessage = {
  nameMissing(assignedVariable: string, methodName: string) {
    return `variable assigned to ${methodName} should has a name "${assignedVariable}" inside ${methodName} call`
  },
  nameIncorrect(assignedVariable: string, methodName: string) {
    return `variable assigned to ${methodName} should be named as it's variable name, rename it to "${assignedVariable}"`
  },
}

tester.run('reatom/reatom-prefix-rule', reatomPrefixRule, {
  valid: [
    {
      code: `
        import { reatomAsync } from '@reatom/framework'
        const fetchUser = reatomAsync(() => {}, "fetchUser");
        `,
    },
    {
      code: `
        import { reatomAsync } from '@reatom/framework'
        const fetchUser = reatomAsync(() => {}, {
          name: "fetchUser",
          onRequest: () => {},
        });
        `,
    },
    {
      code: `
        import { reatomAsync } from '@reatom/framework'
        const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });
        `,
    },
    {
      code: `
        import { reatomRecord } from '@reatom/framework'
        const user = reatomRecord({}, "user");
        `,
    },
  ],
  invalid: [
    {
      code: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {});
      `,
      errors: [
        {
          message: expectedReatomMessage.nameMissing(
            'fetchUser',
            'reatomAsync',
          ),
        },
      ],
      output: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, "fetchUser");
      `,
    },
    {
      code: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, "fetch");
      `,
      errors: [
        {
          message: expectedReatomMessage.nameIncorrect(
            'fetchUser',
            'reatomAsync',
          ),
        },
      ],
      output: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, "fetchUser");
      `,
    },
    {
      code: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, { onRequest: () => {} });
      `,
      errors: [
        {
          message: expectedReatomMessage.nameMissing(
            'fetchUser',
            'reatomAsync',
          ),
        },
      ],
      output: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, { name: "fetchUser", onRequest: () => {} });
      `,
    },
    {
      code: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, { name: "fetch" });
      `,
      errors: [
        {
          message: expectedReatomMessage.nameIncorrect(
            'fetchUser',
            'reatomAsync',
          ),
        },
      ],
      output: `
      import { reatomAsync } from '@reatom/framework'
      const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });
      `,
    },
    {
      code: `
            import { reatomAsync } from '@reatom/framework'
            const fetchUser = reatomAsync(() => {});
            `,
      errors: [
        {
          message: expectedReatomMessage.nameMissing(
            'fetchUser',
            'reatomAsync',
          ),
        },
      ],
      output: `
            import { reatomAsync } from '@reatom/framework'
            const fetchUser = reatomAsync(() => {}, "fetchUser");
            `,
    },
    {
      code: `
            import { reatomRecord } from '@reatom/framework'
            const user = reatomRecord({}, "u");
            `,
      errors: [
        {
          message: expectedReatomMessage.nameIncorrect('user', 'reatomRecord'),
        },
      ],
      output: `
            import { reatomRecord } from '@reatom/framework'
            const user = reatomRecord({}, "user");
            `,
    },
    {
      code: `
      import { reatomAsync as asyncFn } from '@reatom/framework'
      const fetchTodo = asyncFn(() => {}, '')
      `,
      errors: [
        {
          message: expectedReatomMessage.nameIncorrect('fetchTodo', 'asyncFn'),
        },
      ],
      output: `
      import { reatomAsync as asyncFn } from '@reatom/framework'
      const fetchTodo = asyncFn(() => {}, "fetchTodo")
      `,
    },
    {
      code: `
      import { reatomBoolean as booleanState } from '@reatom/framework'
      const openModalState = booleanState(() => {}, '')
      `,
      errors: [
        {
          message: expectedReatomMessage.nameIncorrect(
            'openModalState',
            'booleanState',
          ),
        },
      ],
      output: `
      import { reatomBoolean as booleanState } from '@reatom/framework'
      const openModalState = booleanState(() => {}, "openModalState")
      `,
    },
    {
      code: `
      import { reatomRecord as record } from "@reatom/framework"
      class SomeService {
        someRecord = record({})
      }
      `,
      errors: [
        {
          message: expectedReatomMessage.nameMissing('someRecord', 'record'),
        },
      ],
      output: `
      import { reatomRecord as record } from "@reatom/framework"
      class SomeService {
        someRecord = record({}, "someRecord")
      }
      `,
    },
  ],
})
