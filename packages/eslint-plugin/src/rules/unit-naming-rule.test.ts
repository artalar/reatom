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
    { atomPrefix: '$' },
    { atomPostfix: 'Atom' },
    { domainVariable: 'domain' },
  ].flatMap((options) => {
    const prefix = options.atomPrefix ?? ''
    const postfix = options.atomPostfix ?? ''
    const domain = options.domainVariable ?? 'name'
    return [
      {
        code: `${ImportAtom}; const ${prefix}some${postfix} = atom(0, '${prefix}some${postfix}')`,
        options: [options],
      },
      {
        code: `${ImportAtom}; let ${domain}; const ${prefix}some${postfix} = atom(0, \`\${${domain}}.${prefix}some${postfix}\`)`,
        options: [options],
      },
      {
        code: `${ImportAtom}; const obj = { ${prefix}some${postfix}: atom(0, 'obj.${prefix}some${postfix}') }`,
        options: [options],
      },
      {
        code: `${ImportAtom}; let ${domain}; const obj = { ${prefix}some${postfix}: atom(0, \`\${${domain}}.obj.${prefix}some${postfix}\`) }`,
        options: [options],
      },
    ]
  }),
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
