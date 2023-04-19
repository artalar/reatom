import { RuleTester } from 'eslint'
import { atomPostfixRule } from '../rules/atom-postifx-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    atomPostfix: 'Atom'
  }
})

tester.run('reatom/atom-postfix-rule', atomPostfixRule, {
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
            const count = atom(0);
            `,
      errors: [
        { message: 'atom "count" should have postfix "Atom"' },
      ],
      output: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0);
            `,
    },
    {
      code: `
      import { atom as createStore } from '@reatom/framework'
      const store = createStore(0)
      `,
      errors: [
        {
          message: `atom "store" should have postfix "Atom"`,
        },
      ],
      output: `
      import { atom as createStore } from '@reatom/framework'
      const storeAtom = createStore(0)
      `,
    },
    {
      code: `
      import { atom as createAtom } from '@reatom/framework'
      const store = createAtom((ctx) => {}, '')
      `,
      errors: [
        {
          message: `atom "store" should have postfix "Atom"`,
        },
      ],
      output: `
      import { atom as createAtom } from '@reatom/framework'
      const storeAtom = createAtom((ctx) => {}, '')
      `,
    },
    {
      code: `
      import { atom } from "@reatom/framework"
      const handler = {
        draggable: atom({})
      } 
      `,
      errors: [
        {
          message: `atom "draggable" should have postfix "Atom"`,
        },
      ],
      output: `
      import { atom } from "@reatom/framework"
      const handler = {
        draggableAtom: atom({})
      } 
      `,
    },
    {
      code: `
      import { atom } from "@reatom/core"
      class SomeService {
        some = atom({}, "")
      }
      `,
      errors: [
        {
          message: `atom "some" should have postfix "Atom"`,
        },
      ],
      output: `
      import { atom } from "@reatom/core"
      class SomeService {
        someAtom = atom({}, "")
      }
      `,
    },
  ],
})
