import { RuleTester } from 'eslint'
import { atomRule } from './atom-rule'

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
        import { atom } from '@reatom/framework';
        const count = 'count';
        const countAtom = atom(0, \`\${count}Atom\`);
      `,
    },
    {
      code: `
        import { atom } from '@reatom/framework';
        const domain = (name) => 'some.' + name;
        const countAtom = atom(0, domain\`count\`);
      `,
    },
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
      errors: [{ messageId: 'nameMissing' }],
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
          messageId: 'nameIncorrect',
          line: 3,
          column: 39,
          endColumn: 46,
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
          messageId: 'nameMissing',
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
          messageId: 'nameIncorrect',
          line: 3,
          column: 49,
          endColumn: 51,
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
          messageId: 'nameMissing',
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
          messageId: 'nameIncorrect',
          line: 4,
          column: 29,
          endColumn: 31,
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
