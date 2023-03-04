import { RuleTester } from "eslint";
import { actionRule } from "../rules/action-rule";
import { atomRule } from "../rules/atom-rule";
import { reatomPrefixRule } from "../rules/reatom-prefix-rule";

const tester = new RuleTester({
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module'
    }
});

tester.run('reatom/atom-rule', atomRule, {
    valid: [
        {
            code: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "countAtom");
            `
        },
        {
            code: `const countAtom = atom(0);`,
        },
        {
            code: 'const countAtom = atom(0, "count");',
        },
    ],
    invalid: [
        {
            code: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0);
            `,
            errors: [{ message: 'atom "countAtom" should has a name inside atom() call', }],
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
            errors: [{ message: `atom "countAtom" should be named as it's variable name, rename it to "countAtom"` }],
            output: `
            import { atom } from '@reatom/framework'
            const countAtom = atom(0, "countAtom");
            `,
        },
    ]
});

tester.run('reatom/action-rule', actionRule, {
    valid: [
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action("doSome");
            `
        },
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "doSome");
            `
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
        }
    ],
    invalid: [
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action();
            `,
            errors: [{ message: 'action "doSome" should has a name inside action() call' }],
            output: `
            import { action } from '@reatom/framework'
            const doSome = action("doSome");
            `
        },
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action("do");
            `,
            errors: [{ message: `action "doSome" should be named as it's variable name, rename it to "doSome"` }],
            output: `
            import { action } from '@reatom/framework'
            const doSome = action("doSome");
            `
        },
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {});
            `,
            errors: [{ message: `action "doSome" should has a name inside action() call` }],
            output: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "doSome");
            `
        },
        {
            code: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "do");
            `,
            errors: [{ message: `action "doSome" should be named as it's variable name, rename it to "doSome"` }],
            output: `
            import { action } from '@reatom/framework'
            const doSome = action(() => {}, "doSome");
            `
        }
    ]
});


tester.run('reatom/reatom-prefux-rule', reatomPrefixRule, {
    valid: [
        {
            code: `
            import { reatomAsync } from '@reatom/framework'
            const fetchUser = reatomAsync(() => {}, "fetchUser");
            `
        },
        {
            code: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, {
                    name: "fetchUser",
                    onRequest: () => {},
                  });
              `
        },
        {
            code: `
            import { reatomAsync } from '@reatom/framework'
            const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });
            `
        },
        {
            code: `const fetchUser = reatomAsync(() => {});`,
        },
        {
            code: `const fetchUser = reatomAsync(() => {}, "fetch");`,
        },
        {
            code: `const fetchUser = reatomAsync(() => {}, { onRequest: () => {} });`,
        },
        {
            code: `const fetchUser = reatomAsync(() => {}, { name: "fetch" });`,
        },
        {
            code: `
            import { reatomRecord } from '@reatom/framework'
            const user = reatomRecord({}, "user");
            `
        }
    ],
        invalid: [
            {
                code: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {});
                `,
                errors: [{ message: `variable with prefix reatom "fetchUser" should has a name inside reatom*() call` }],
                output: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, "fetchUser");
                `
            },
            {
                code: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, "fetch");
                `,
                errors: [{ message: `variable with prefix reatom "fetchUser" should be named as it's variable name, rename it to "fetchUser"` }],
                output: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, "fetchUser");
                `
            },
            {
                code: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, { onRequest: () => {} });
                `,
                errors: [{ message: `variable with prefix reatom "fetchUser" should has a name inside reatom*() call` }],
                output: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, { name: "fetchUser", onRequest: () => {} });
                `
            },
            {
                code: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, { name: "fetch" });
                `,
                errors: [{ message: `variable with prefix reatom "fetchUser" should be named as it's variable name, rename it to "fetchUser"` }],
                output: `
                import { reatomAsync } from '@reatom/framework'
                const fetchUser = reatomAsync(() => {}, { name: "fetchUser" });
                `
            },
            {
                code: `
                import { reatomRecord } from '@reatom/framework'
                const user = reatomRecord({});
                `,
                errors: [{ message: `variable with prefix reatom "user" should has a name inside reatom*() call` } ],
                output: `
                import { reatomRecord } from '@reatom/framework'
                const user = reatomRecord({}, "user");
                `
            },
            {
                code: `
                import { reatomRecord } from '@reatom/framework'
                const user = reatomRecord({}, "u");
                `,
                errors: [{ message: `variable with prefix reatom "user" should be named as it's variable name, rename it to "user"` } ],
                output: `
                import { reatomRecord } from '@reatom/framework'
                const user = reatomRecord({}, "user");
                `
            },

    ]
});
