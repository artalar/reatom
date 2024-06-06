import { RuleTester } from 'eslint'
import { MESSAGES, unitNamingRule } from './unit-naming-rule'

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

const Imports = 'import { action, atom } from "@reatom/framework";'

tester.run('unit-naming-rule', unitNamingRule, {
  valid: [
    { atomPrefix: '$' },
    { atomPostfix: 'Atom' },
    { domainVariable: 'domain' },
  ].flatMap((options) => {
    const prefix = options.atomPrefix ?? ''
    const postfix = options.atomPostfix ?? ''
    const domain = options.domainVariable ?? 'name'
    const name = `${prefix}some${postfix}`
    return [
      {
        code: `${Imports} const ${name} = atom(0, '${name}')`,
        options: [options],
      },
      {
        code: `${Imports} const doSome = action(() => {}, 'doSome')`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const ${name} = atom(0, \`\${${domain}}.${name}\`)`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const doSome = action(0, \`\${${domain}}.doSome\`)`,
        options: [options],
      },
      {
        code: `${Imports} const obj = { ${name}: atom(0, 'obj.${name}') }`,
        options: [options],
      },
      {
        code: `${Imports} const obj = { doSome: action(() => {}, 'obj.doSome') }`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const obj = { ${name}: atom(0, \`\${${domain}}.obj.${name}\`) }`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const obj = { doSome: action(() => {}, \`\${${domain}}.obj.doSome\`) }`,
        options: [options],
      },
    ]
  }),
  invalid: [
    { atomPrefix: '$' },
    { atomPostfix: 'Atom' },
    { domainVariable: 'domain' },
  ].flatMap((options) => {
    const prefix = options.atomPrefix ?? ''
    const postfix = options.atomPostfix ?? ''
    const domain = options.domainVariable ?? 'name'
    const name = `${prefix}some${postfix}`
    return [
      {
        code: `${Imports} const ${name} = atom(0)`,
        errors: [{ messageId: MESSAGES.nameMissing }],
        output: `${Imports} const ${name} = atom(0, '${name}')`,
        options: [options],
      },
      {
        code: `${Imports} const doSome = action(() => {})`,
        errors: [{ messageId: MESSAGES.nameMissing }],
        output: `${Imports} const doSome = action(() => {}, 'doSome')`,
        options: [options],
      },
      {
        code: `${Imports} const obj = { ${name}: atom(0, 'dodge.${name}') }`,
        errors: [{ messageId: MESSAGES.nameIncorrect }],
        output: `${Imports} const obj = { ${name}: atom(0, 'obj.${name}') }`,
        options: [options],
      },
      {
        code: `${Imports} const obj = { doSome: action(() => {}, 'obj.doRun') }`,
        errors: [{ messageId: MESSAGES.nameIncorrect }],
        output: `${Imports} const obj = { doSome: action(() => {}, 'obj.doSome') }`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const obj = { ${name}: atom(0, \`\${${domain}}.dodge.${name}\`) }`,
        errors: [{ messageId: MESSAGES.nameDomainIncorrect }],
        output: `${Imports} let ${domain}; const obj = { ${name}: atom(0, \`\${${domain}}.obj.${name}\`) }`,
        options: [options],
      },
      {
        code: `${Imports} let ${domain}; const obj = { doSome: action(() => {}, \`\${${domain}}WAT.obj.doSome\`) }`,
        errors: [{ messageId: MESSAGES.nameDomainIncorrect }],
        output: `${Imports} let ${domain}; const obj = { doSome: action(() => {}, \`\${${domain}}.obj.doSome\`) }`,
        options: [options],
      },
    ]
  }),
})
