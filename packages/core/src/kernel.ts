export type Leaf = string // unique
export type TreeId = string // unique
export type State = Record<TreeId, any>
// reatom specific
export type AtomUpdater = <TPayload>(ctx: Ctx<TPayload>) => void
export type Action<TPayload = undefined, TType extends Leaf = Leaf> = {
  type: TType;
  payload: TPayload
}
export type Ctx<TPayload> = {
  state: State;
  stateNew: State;
  type: Leaf;
  payload: TPayload;
  changedTreeIds: TreeId[];
}
interface ISetCounted {
  add(f: AtomUpdater): void;
  delete(f: AtomUpdater): void;
  forEach(cb: (f: AtomUpdater) => any): void;
}
export function createCtx<TPayload>(
  state: State,
  { type, payload }: Action<TPayload>,
): Ctx<TPayload> {
  return {
    state,
    stateNew: {},
    type,
    payload,
    changedTreeIds: [],
  }
}
// TODO: try to replace by class
function createSetCounted(): ISetCounted {
  const _counter = new Map<AtomUpdater, number>()

  return {
    add(el: AtomUpdater) {
      _counter.set(el, (_counter.get(el) || 0) + 1)
    },
    delete(el: AtomUpdater) {
      const count = _counter.get(el)
      if (count === 1) _counter.delete(el)
      else if (count! > 1) _counter.set(el, count! - 1)
    },
    forEach(cb: (fn: AtomUpdater) => any) {
      _counter.forEach((_, fn) => cb(fn))
    },
  }
}

export class Tree {
  id: TreeId
  isLeaf: boolean
  fnsMap: Map<Leaf, ISetCounted>
  constructor(id: TreeId, isLeaf = false) {
    this.id = id
    this.isLeaf = isLeaf
    this.fnsMap = new Map()
  }
  _getFns(key: Leaf) {
    let counted = this.fnsMap.get(key);

    if (!counted) {
      counted = createSetCounted();
      this.fnsMap.set(key, counted);
    }

    return counted;
  }
  _manageFns(tree: Tree, type: 'add' | 'delete') {
    tree.fnsMap.forEach((set, key) => {
      set.forEach(this._getFns(key)[type])
    })
  }
  addFn(fn: AtomUpdater, key: Leaf) {
    this._getFns(key).add(fn)
  }
  union(tree: Tree) {
    this._manageFns(tree, 'add')
  }
  disunion(tree: Tree) {
    this._manageFns(tree, 'delete')
  }
  forEach(key: Leaf, ctx: Ctx<any>) {
    const setCounted = this.fnsMap.get(key)
    if (setCounted) setCounted.forEach(fn => fn(ctx))
  }
}
