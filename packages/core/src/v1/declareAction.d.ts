import { Leaf, BaseAction } from './kernel';
import { Unit } from './shared';
import { Store } from './createStore';
export declare type ActionType = Leaf;
export declare type Reaction<T> = (payload: T, store: Store) => any;
export declare type Action<Payload, Type extends ActionType = string> = BaseAction<Payload> & {
    type: Type;
    reactions?: Reaction<Payload>[];
};
export declare type BaseActionCreator<Type extends string = string> = {
    getType: () => Type;
} & Unit;
export declare type ActionCreator<Type extends string = string> = BaseActionCreator<Type> & (() => Action<undefined, Type>);
export declare type PayloadActionCreator<Payload, Type extends string = string> = BaseActionCreator<Type> & ((payload: Payload) => Action<Payload, Type>);
export declare function declareAction(name?: string | Reaction<undefined>, ...reactions: Reaction<undefined>[]): ActionCreator<string>;
export declare function declareAction<Type extends ActionType>(name: [Type], ...reactions: Reaction<undefined>[]): ActionCreator<Type>;
export declare function declareAction<Payload>(name?: string | Reaction<Payload>, ...reactions: Reaction<Payload>[]): PayloadActionCreator<Payload, string>;
export declare function declareAction<Payload, Type extends ActionType>(name: [Type], ...reactions: Reaction<Payload>[]): PayloadActionCreator<Payload, Type>;
