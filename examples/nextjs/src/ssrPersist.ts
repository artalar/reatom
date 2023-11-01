import { createMemStorage, reatomPersist } from '@reatom/persist'

const ssrStorage = createMemStorage({ name: 'ssr', subscribe: false })
export const { snapshotAtom } = ssrStorage
// eslint-disable-next-line @reatom/reatom-prefix-rule
export const withSsr = reatomPersist(ssrStorage)
