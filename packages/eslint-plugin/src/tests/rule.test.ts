import { RuleTester } from "eslint";
import { actionRule } from "../rules/action-rule";
import { atomRule } from "../rules/atom-rule";
import { reatomPrefixRule } from "../rules/reatom-prefix-rule";

const tester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
    }
});

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

tester.run('reatom/action-rule', actionRule, {
    valid: [
        {
            code: 'const doSome = action("doSome");'
        },
        {
            code: 'const doSome = action(() => {}, "doSome");'
        }
    ],
    invalid: [
        {
            code: `const doSome = action();`,
            errors: [{ message: 'action name is not defined' }],
            output: 'const doSome = action("doSome");'
        },
        {
            code: `const doSome = action("do");`,
            errors: [{ message: 'action name is defined bad' }],
            output: 'const doSome = action("doSome");'
        },
        {
            code: `const doSome = action(() => {});`,
            errors: [{ message: 'action name is not defined' }],
            output: 'const doSome = action(() => {}, "doSome");'
        },
        {
            code: `const doSome = action(() => {}, "do");`,
            errors: [{ message: 'action name is defined bad' }],
            output: 'const doSome = action(() => {}, "doSome");'
        }
    ]
});


tester.run('reatom/reatom-prefux-rule', reatomPrefixRule, {
    valid: [
        {
            code: 'const fetchUser = reatomAsync(() => {}, "fetchUser");'
        },
        {
            code: `const fetchUser = reatomAsync(() => {}, {
                name: "fetchUser",
                onRequest: () => {},
              });`
        },
        {
            code: `const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });`
        }
    ],
        invalid: [
            {
                code: `const fetchUser = reatomAsync(() => {});`,
                errors: [{ message: `some reatom* name is not defined` }],
                output: 'const fetchUser = reatomAsync(() => {}, "fetchUser");'
            },
            {
                code: `const fetchUser = reatomAsync(() => {}, "fetch");`,
                errors: [{ message: `some reatom* name is defined bad` }],
                output: `const fetchUser = reatomAsync(() => {}, "fetchUser");`
            },
            {
                code: `const fetchUser = reatomAsync(() => {}, { onRequest: () => {} });`,
                errors: [{ message: `some reatom* name is not defined` }],
                output: `const fetchUser = reatomAsync(() => {}, { name: "fetchUser", onRequest: () => {} });`
            },
            {
                code: `const fetchUser = reatomAsync(() => {}, { name: "fetch" });`,
                errors: [{ message: `some reatom* name is defined bad` }],
                output: `const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });`
            },

    ]
});
