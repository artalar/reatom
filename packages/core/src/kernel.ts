export type Leaf = string // unique
export type TreeId = string // unique
export type State = Record<TreeId, any>
// reatom specific
export type Fn = (ctx: Ctx) => any
export type Ctx = ReturnType<typeof createCtx>
export type BaseAction<T = any> = { type: Leaf; payload: any }
export function createCtx(state: State, { type, payload }: BaseAction) {
  return {
    state,
    stateNew: {} as State,
    type,
    payload,
    changedIds: [] as TreeId[],
  }
}
// TODO: try to replace by class
type SetCounted = ReturnType<typeof createSetCounted>
function createSetCounted() {
  const _counter = new Map<Fn, number>()

  return {
    add(el: Fn) {
      _counter.set(el, (_counter.get(el) || 0) + 1)
    },
    delete(el: Fn) {
      const count = _counter.get(el)
      if (count === 1) _counter.delete(el)
      else if (count! > 1) _counter.set(el, count! - 1)
    },
    forEach(cb: (fn: Fn) => any) {
      _counter.forEach((_, fn) => cb(fn))
    },
  }
}

export class Tree {
  id: TreeId
  isLeaf: boolean
  fnsMap: Map<Leaf, SetCounted>
  constructor(id: TreeId, isLeaf = false) {
    this.id = id
    this.isLeaf = isLeaf
    this.fnsMap = new Map()
  }
  _getFns(key: Leaf) {
    return (
      this.fnsMap.get(key) ||
      (this.fnsMap.set(key, createSetCounted()).get(key) as SetCounted)
    )
  }
  _manageFns(tree: Tree, type: 'add' | 'delete') {
    tree.fnsMap.forEach((set, key) => {
      set.forEach(this._getFns(key)[type])
    })
  }
  addFn(fn: Fn, key: Leaf) {
    this._getFns(key).add(fn)
  }
  union(tree: Tree) {
    this._manageFns(tree, 'add')
  }
  disunion(tree: Tree) {
    this._manageFns(tree, 'delete')
  }
  forEach(key: Leaf, ctx: Ctx) {
    const setCounted = this.fnsMap.get(key)
    if (setCounted) setCounted.forEach(fn => fn(ctx))
  }
}
