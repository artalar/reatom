import { takeNested } from '@reatom/effects'

console.warn("This package is outdated and will be removed soon, `all-settled` is `takeNested` now and part of the [effects](https://www.reatom.dev/packages/effects) package")

/**
 * @deprecated use {@link @reatom/effects#takeNested}
 */
export const allSettled = takeNested
