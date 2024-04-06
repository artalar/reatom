import { Atom, __count } from '@reatom/core'
import { assign } from '@reatom/utils'

export const withAssign =
  <Target extends Atom, Props extends object>(
    getProps: (target: Target, name: string) => Props,
  ) =>
  (target: Target) => {
    const name = target.__reatom.name ?? __count('withAssign')
    return assign(target, getProps(target, name)) as Target & Props
  }
