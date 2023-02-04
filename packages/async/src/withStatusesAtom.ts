import { atom, Atom } from '@reatom/core'
import { onUpdate } from '@reatom/hooks'
import { AsyncAction } from '.'

export interface AsyncStatusesNeverPending {
  isPending: false
  isFulfilled: false
  isRejected: false
  isSettled: false

  // isFirstPending: false
  // isAnotherPending: false
  isEverPending: false
  // isNeverPending: true
  isEverSettled: false
  // isNeverSettled: true
}

export interface AsyncStatusesFirstPending {
  isPending: true
  isFulfilled: false
  isRejected: false
  isSettled: false

  // isFirstPending: true
  // isAnotherPending: false
  isEverPending: true
  // isNeverPending: false
  isEverSettled: false
  // isNeverSettled: true
}

export interface AsyncStatusesFulfilled {
  isPending: false
  isFulfilled: true
  isRejected: false
  isSettled: true

  // isFirstPending: false
  // isAnotherPending: false
  isEverPending: true
  // isNeverPending: false
  isEverSettled: true
  // isNeverSettled: false
}

export interface AsyncStatusesRejected {
  isPending: false
  isFulfilled: false
  isRejected: true
  isSettled: true

  // isFirstPending: false
  // isAnotherPending: false
  isEverPending: true
  // isNeverPending: false
  isEverSettled: true
  // isNeverSettled: false
}

export interface AsyncStatusesAnotherPending {
  isPending: true
  isFulfilled: false
  isRejected: false
  isSettled: false

  // isFirstPending: false
  // isAnotherPending: true
  isEverPending: true
  // isNeverPending: false
  isEverSettled: true
  // isNeverSettled: false
}

export type AsyncStatusesPending =
  | AsyncStatusesFirstPending
  | AsyncStatusesAnotherPending

export type AsyncStatuses =
  | AsyncStatusesNeverPending
  | AsyncStatusesPending
  | AsyncStatusesFulfilled
  | AsyncStatusesRejected

export interface AsyncStatusesAtom extends Atom<AsyncStatuses> {
  // TODO how to reset during pending?
  // reset: Action<[], AsyncStatuses>
}

export const withStatusesAtom =
  <
    T extends AsyncAction & {
      statusesAtom?: AsyncStatusesAtom
    },
  >() =>
  (anAsync: T): T & { statusesAtom: AsyncStatusesAtom } => {
    if (!anAsync.statusesAtom) {
      const statusesAtom = (anAsync.statusesAtom = atom<AsyncStatuses>(
        {
          isPending: false,
          isFulfilled: false,
          isRejected: false,
          isSettled: false,

          // isFirstPending: false,
          // isAnotherPending: false,
          isEverPending: false,
          // isNeverPending: true,
          isEverSettled: false,
          // isNeverSettled: true,
        },
        `${anAsync.__reatom.name}.statusesAtom`,
      ))
      onUpdate(anAsync, (ctx) =>
        statusesAtom(ctx, (statuses) => ({
          isPending: true,
          isFulfilled: false,
          isRejected: false,
          isSettled: false,

          // isFirstPending: !statuses.isEverPending,
          // isAnotherPending: statuses.isEverPending,
          isEverPending: true,
          // isNeverPending: false,
          isEverSettled: statuses.isEverSettled,
          // isNeverSettled: statuses.isNeverSettled,
        })),
      )
      onUpdate(anAsync.onFulfill, (ctx) =>
        statusesAtom(ctx, (statuses) => ({
          isPending: false,
          isFulfilled: true,
          isRejected: false,
          isSettled: true,

          // isFirstPending: false,
          // isAnotherPending: false,
          isEverPending: true,
          // isNeverPending: false,
          isEverSettled: true,
          // isNeverSettled: false,
        })),
      )
      onUpdate(anAsync.onReject, (ctx) =>
        statusesAtom(ctx, (statuses) => ({
          isPending: false,
          isFulfilled: false,
          isRejected: true,
          isSettled: true,

          // isFirstPending: false,
          // isAnotherPending: false,
          isEverPending: true,
          // isNeverPending: false,
          isEverSettled: true,
          // isNeverSettled: false,
        })),
      )
    }

    return anAsync as T & { statusesAtom: Atom<AsyncStatuses> }
  }
