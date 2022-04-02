export declare type Leaf = string;
export declare type TreeId = string | symbol;
export declare type State = Record<TreeId, unknown>;
export declare type Fn = {
    (ctx: Ctx): any;
    _ownerAtomId: TreeId;
};
export declare type Ctx = ReturnType<typeof createCtx>;
export declare type BaseAction<T = any> = {
    type: Leaf;
    payload: T;
};
export declare function createCtx(state: State, { type, payload }: BaseAction): {
    state: Record<TreeId, unknown>;
    stateNew: Record<TreeId, unknown>;
    type: string;
    payload: any;
    changedIds: TreeId[];
};
declare class SetCounted {
    _counter: Map<Fn, number>;
    add(el: Fn): void;
    delete(el: Fn): boolean;
    forEach(cb: (fn: Fn) => any): void;
}
export declare class Tree {
    id: TreeId;
    isLeaf: boolean;
    fnsMap: Map<Leaf, SetCounted>;
    constructor(id: TreeId, isLeaf?: boolean);
    _getFns(key: Leaf): SetCounted;
    addFn(fn: Fn, key: Leaf): void;
    union(tree: Tree): void;
    disunion(tree: Tree, cb: (key: TreeId) => any): void;
    forEach(key: Leaf, ctx: Ctx): void;
}
export {};
