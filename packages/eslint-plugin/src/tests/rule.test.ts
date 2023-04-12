import { RuleTester } from 'eslint'
import { actionRule } from '../rules/action-rule'
import { atomRule } from '../rules/atom-rule'
import { reatomPrefixRule } from '../rules/reatom-prefix-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('reatom/atom-rule', atomRule, {
  valid: [
    {
      code: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "countAtom");
            `,
    },
    {
      code: `const countAtom = atom(0);`,
    },
    {
      code: 'const countAtom = atom(0, "count");',
    },
    {
      code: `
      import { atom } from "@reatom/framework"
      const factory = ()=> {
        const someAtom = atom("", "someAtom")
        const set = action(ctx => {}, "set")
        return Object.assign(someAtom, {
          set
        })
      }
      `,
    },
  ],
  invalid: [
    {
      code: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0);
            `,
      errors: [
        { message: 'atom "countAtom" should has a name inside atom() call' },
      ],
      output: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "countAtom");
            `,
    },
    {
      code: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "count");
            `,
      errors: [
        {
          message: `atom "countAtom" should be named as it's variable name, rename it to "countAtom"`,
        },
      ],
      output: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "countAtom");
            `,
    },
    {
      code: `
      import { atom as createStore } from '@reatom/framework'
      const storeAtom = createStore(0)
      `,
      errors: [
        {
          message: `atom "storeAtom" should has a name inside atom() call`,
        },
      ],
      output: `
      import { atom as createStore } from '@reatom/framework'
      const storeAtom = createStore(0, "storeAtom")
      `,
    },
    {
      code: `
      import { atom as createAtom } from '@reatom/framework'
      const storeAtom = createAtom((ctx) => {}, '')
      `,
      errors: [
        {
          message: `atom "storeAtom" should be named as it's variable name, rename it to "storeAtom"`,
        },
      ],
      output: `
      import { atom as createAtom } from '@reatom/framework'
      const storeAtom = createAtom((ctx) => {}, "storeAtom")
      `,
    },
    {
      code: `
      import { atom } from "@reatom/framework"
      const handler = {
        draggableAtom: atom({})
      } 
      `,
      errors: [
        {
          message: `atom "draggableAtom" should has a name inside atom() call`,
        },
      ],
      output: `
      import { atom } from "@reatom/framework"
      const handler = {
        draggableAtom: atom({}, "draggableAtom")
      } 
      `,
    },
    {
      code: `
      import { atom } from "@reatom/core"
      class SomeService {
        someAtom = atom({}, "")
      }
      `,
      errors: [
        {
          message: `atom "someAtom" should be named as it's variable name, rename it to "someAtom"`,
        },
      ],
      output: `
      import { atom } from "@reatom/core"
      class SomeService {
        someAtom = atom({}, "someAtom")
      }
      `,
    },
  ],
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

const expectedReatomMessage = {
  noname(assignedVariable: string, methodName: string) {
    return `variable assigned to ${methodName} should has a name "${assignedVariable}" inside ${methodName} call`
  },
  unCorrect(assignedVariable: string, methodName: string) {
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
          message: expectedReatomMessage.noname('fetchUser', 'reatomAsync'),
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
          message: expectedReatomMessage.unCorrect('fetchUser', 'reatomAsync'),
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
          message: expectedReatomMessage.noname('fetchUser', 'reatomAsync'),
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
          message: expectedReatomMessage.unCorrect('fetchUser', 'reatomAsync'),
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
          message: expectedReatomMessage.noname('fetchUser', 'reatomAsync'),
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
          message: expectedReatomMessage.unCorrect('user', 'reatomRecord'),
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
          message: expectedReatomMessage.unCorrect('fetchTodo', 'asyncFn'),
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
          message: expectedReatomMessage.unCorrect(
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
  ],
})
