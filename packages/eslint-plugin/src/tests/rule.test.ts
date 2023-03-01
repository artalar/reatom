import { RuleTester, Rule } from "eslint";
import { atomRule } from "../rules/atom-rule";

// @ts-ignore
RuleTester.setDefaultConfig({
    parserOptions: {
      ecmaVersion: 6,
    }
})

const tester = new RuleTester();

tester.run('reatom/atom-rule', atomRule, {
    valid: [
        {
            code: 'const countAtom = atom(0, "countAtom");'
        },
    ],
    invalid: [
        {
            code: `const countAtom = atom(0);`,
            errors: [{ message: 'atom name is not defined', }],
            output: `const countAtom = atom(0, "countAtom");`,
        },
        {
            code: 'const countAtom = atom(0, "count");',
            errors: [{ message: 'atom name is defined bad'}],
            output: `const countAtom = atom(0, "countAtom");`,
        },
    ]
});
