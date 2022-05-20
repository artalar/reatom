import { State, TreeId } from './kernel';
import { NonUndefined, Unit } from './shared';
import { Action, PayloadActionCreator } from './declareAction';
declare const DEPS: unique symbol;
declare const DEPS_SHAPE: unique symbol;
export declare const init: import("./declareAction").ActionCreator<"@@Reatom/init">;
export declare const initAction: Action<undefined, "@@Reatom/init">;
declare type AtomName = TreeId | [string];
declare type AtomsMap = {
    [key: string]: Atom<any>;
};
declare type Reducer<TState, TValue> = (state: TState, value: TValue) => TState;
/**
 * This interface needed for correct type inference with TypeScript 3.5
 * @see https://github.com/artalar/reatom/issues/301
 */
interface DependencyMatcherOn<TState> {
    <T>(dependency: Atom<T>, reducer: Reducer<TState, T>): void;
    <T>(dependency: PayloadActionCreator<T>, reducer: Reducer<TState, T>): void;
    <T>(dependency: Atom<T> | PayloadActionCreator<T>, reducer: Reducer<TState, T>): void;
}
declare type DependencyMatcher<TState> = (on: DependencyMatcherOn<TState>) => any;
export interface Atom<T> extends Unit {
    (state?: State, action?: Action<any>): Record<string, T | any>;
    [DEPS]: Set<TreeId>;
    [DEPS_SHAPE]?: AtomsMap | TupleOfAtoms;
}
export declare function declareAtom<TState>(initialState: TState, dependencyMatcher: DependencyMatcher<TState>): Atom<TState>;
export declare function declareAtom<TState>(name: AtomName, initialState: TState, dependencyMatcher: DependencyMatcher<TState>): Atom<TState>;
export declare function getState<T>(state: State, atom: Atom<T>): T | undefined;
export declare function map<T, TSource = unknown>(source: Atom<TSource>, mapper: (dependedAtomState: TSource) => NonUndefined<T>): Atom<T>;
export declare function map<T, TSource = unknown>(name: AtomName, source: Atom<TSource>, mapper: (dependedAtomState: TSource) => NonUndefined<T>): Atom<T>;
declare type TupleOfAtoms = [Atom<unknown>] | Atom<unknown>[];
export declare function combine<T extends AtomsMap | TupleOfAtoms>(shape: T): Atom<{
    [key in keyof T]: T[key] extends Atom<infer S> ? S : never;
}>;
export declare function combine<T extends AtomsMap | TupleOfAtoms>(name: AtomName, shape: T): Atom<{
    [key in keyof T]: T[key] extends Atom<infer S> ? S : never;
}>;
export declare function getDepsShape(thing: Atom<any>): AtomsMap | TupleOfAtoms | undefined;
export {};
