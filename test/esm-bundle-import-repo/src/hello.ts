import {atom, createCtx} from '@reatom/framework'
const me = atom('hello', 'me')
const ctx = createCtx()
console.log('mol:', ctx.get(me))