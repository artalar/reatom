import { State, BaseAction } from './kernel';
import { Action, PayloadActionCreator } from './declareAction';
import { Atom } from './declareAtom';
declare type ActionsSubscriber = (action: Action<unknown>, stateDiff: State) => any;
declare type SubscribeFunction = {
    <T>(target: Atom<T> | PayloadActionCreator<T>, listener: (state: T) => any): () => void;
    (listener: ActionsSubscriber): () => void;
};
declare type GetStateFunction = {
    <T>(target: Atom<T>): T;
    (): State;
};
export declare type Store = {
    dispatch: <T>(action: Action<T>) => void;
    subscribe: SubscribeFunction;
    getState: GetStateFunction;
    bind: <A extends (...a: any[]) => BaseAction>(a: A) => (...a: A extends (...a: infer Args) => any ? Args : never) => void;
};
export declare function createStore(initState?: State): Store;
export declare function createStore(atom: Atom<any>, initState?: State): Store;
export {};
