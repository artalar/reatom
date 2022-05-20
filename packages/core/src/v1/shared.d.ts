import { Tree, TreeId } from './kernel';
import { Atom } from './declareAtom';
import { PayloadActionCreator } from './declareAction';
export { TreeId };
export declare type GenId = (name: string | [string] | symbol) => TreeId;
export declare const TREE: unique symbol;
export declare type Unit = {
    [TREE]: Tree;
};
export declare type NonUndefined<T> = Exclude<T, undefined>;
/**
 * Helper for retrieving the data type used in an atom or action
 * @example
 * type MyAtomType = InferType<typeof myAtom>
 * type MyActionType = InferType<typeof myAction>
 */
export declare type InferType<T> = T extends Atom<infer R> | PayloadActionCreator<infer R> ? R : never;
export declare function noop(): void;
export declare const assign: {
    <T, U>(target: T, source: U): T & U;
    <T_1, U_1, V>(target: T_1, source1: U_1, source2: V): T_1 & U_1 & V;
    <T_2, U_2, V_1, W>(target: T_2, source1: U_2, source2: V_1, source3: W): T_2 & U_2 & V_1 & W;
    (target: object, ...sources: any[]): any;
};
export declare const equals: (value1: any, value2: any) => boolean;
export declare function getTree(thing: Unit): Tree;
export declare function getName(treeId: TreeId): string;
export declare function getIsAtom(thing: any): thing is Atom<any>;
export declare function getIsAction(thing: any): thing is Atom<any>;
export declare function nameToIdDefault(name: string | [string] | symbol): TreeId;
export declare function nameToId(name: string | [string] | symbol): TreeId;
export declare function setNameToId(gen: GenId): void;
export declare function throwError(error: string): void;
export declare function safetyStr(str: string, name: string): string;
export declare function safetyFunc<T extends Function>(func: T | undefined, name: string): T;
export declare function getOwnKeys<T extends object>(obj: T): Array<keyof T>;
