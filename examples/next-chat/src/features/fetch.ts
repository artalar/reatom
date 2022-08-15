import { declareAtom } from '@reatom/core'

export const fetchAtom = declareAtom(($, state = fetch) => state, `fetch/root`)
