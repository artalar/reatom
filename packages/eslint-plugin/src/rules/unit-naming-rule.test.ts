import { RuleTester } from 'eslint'
import { unitNamingRule } from './unit-naming-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

const ImportAtom = 'import {atom} from "@reatom/framework"'

tester.run('unit-naming-rule', unitNamingRule, {
  valid: [
    `${ImportAtom}; const some = atom(0, 'some')`,
    {
      code: `${ImportAtom}; const $some = atom(0, '$some')`,
      options: [{ atomPrefix: '$' }],
    },
    {
      code: `${ImportAtom}; const someAtom = atom(0, 'someAtom')`,
      options: [{ atomPostfix: 'Atom' }],
    },
  ],
  invalid: [
    {
      code: `${ImportAtom}; const some = atom(0)`,
      errors: [{ messageId: 'nameMissing' }],
      output: `${ImportAtom}; const some = atom(0, 'some')`,
    },
    {
      code: `${ImportAtom}; const some = atom(0, 'unrelated')`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; const some = atom(0, 'some')`,
    },
    {
      code: `${ImportAtom}; const some = atom(0, 'some')`,
      options: [{ atomPostfix: 'Atom' }],
      errors: [{ messageId: 'postfixMissing' }],
      output: `${ImportAtom}; const someAtom = atom(0, 'someAtom')`,
    },
    {
      code: `${ImportAtom}; function reatomSome() { const field = atom(0, 'reatomSome._unrelated'); }`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; function reatomSome() { const field = atom(0, 'reatomSome._field'); }`,
    },
    {
      code: `${ImportAtom}; function reatomSome() { const field = atom(0, 'field') }`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; function reatomSome() { const field = atom(0, 'reatomSome.field') }`,
    },
    {
      code: `${ImportAtom}; function reatomSome() { const field = atom(0, 'Some.field') }`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; function reatomSome() { const field = atom(0, 'reatomSome.field') }`,
    },
    {
      code: `${ImportAtom}; function reatomSome({name}) { const field = atom(0, 'field'); }`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; function reatomSome({name}) { const field = atom(0, \`\${name}.field\`); }`,
    },
    {
      code: `${ImportAtom}; function reatomSome({name}) { const field = atom(0, 'Some.field'); }`,
      errors: [{ messageId: 'nameIncorrect' }],
      output: `${ImportAtom}; function reatomSome({name}) { const field = atom(0, \`\${name}.field\`); }`,
    },
  ],
})
