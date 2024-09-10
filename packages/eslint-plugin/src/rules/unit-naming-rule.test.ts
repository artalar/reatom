import { RuleTester } from 'eslint'
import { unitNamingRule } from './unit-naming-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

tester.run('unit-naming-rule', unitNamingRule, {
  valid: [
    `const some = atom(0, '_some')`,
    `const some = action(0, 'some')`,
    {
      code: `const $some = atom(0, '$some')`,
      options: [{ atomPrefix: '$' }],
    },
    {
      code: `const someAtom = atom(0, '_someAtom')`,
      options: [{ atomSuffix: 'Atom' }],
    },
    {
      code: `function reatomSome() { const someAtom = atom(0, 'reatomSome.someAtom') }`,
    },
    {
      code: `const Atoms = { someAtom: atom(0, 'Atoms.someAtom') }`,
    },
    {
      code: `function reatomSome() { const Atoms = { someAtom: atom(0, 'reatomSome.Atoms.someAtom') } }`,
    },
  ],
  invalid: [
    {
      code: `const some = atom(0)`,
      errors: [{ message: /missing/ }],
      output: `const some = atom(0, 'some')`,
    },
    {
      code: `const some = atom(0, lololo)`,
      errors: [{ message: /must be a correctly formatted string literal/ }],
      output: `const some = atom(0, 'some')`,
    },
    {
      code: `const some = atom(0, 'unrelated')`,
      errors: [{ message: /name must be/ }],
      output: `const some = atom(0, 'some')`,
    },
    {
      code: `const some = atom(0, 'some')`,
      options: [{ atomPrefix: '$' }],
      errors: [{ message: /name must start with/ }],
      output: `const $some = atom(0, '$some')`,
    },
    {
      code: `const some = atom(0, 'some')`,
      options: [{ atomSuffix: 'Atom' }],
      errors: [{ message: /name must end with/ }],
      output: `const someAtom = atom(0, 'someAtom')`,
    },
    {
      code: `function reatomSome() { const field = atom(0, 'reatomSome._unrelated'); }`,
      errors: [{ message: /name must be/ }],
      output: `function reatomSome() { const field = atom(0, 'reatomSome._field'); }`,
    },
    {
      code: `function reatomSome() { const field = atom(0, 'field') }`,
      errors: [{ message: /domain must be/ }],
      output: `function reatomSome() { const field = atom(0, 'reatomSome.field') }`,
    },
    {
      code: `function reatomSome() { const field = atom(0, 'Some.field') }`,
      errors: [{ message: /domain must be/ }],
      output: `function reatomSome() { const field = atom(0, 'reatomSome.field') }`,
    },
    {
      code: `function reatomSome({name}) { const field = atom(0, 'field'); }`,
      errors: [{ message: /domain must be set to the value of/ }],
      output: `function reatomSome({name}) { const field = atom(0, \`\${name}.field\`); }`,
    },
    {
      code: `function reatomSome({name}) { const field = atom(0, 'Some.field'); }`,
      errors: [{ message: /domain must be set to the value/ }],
      output: `function reatomSome({name}) { const field = atom(0, \`\${name}.field\`); }`,
    },
  ],
})
