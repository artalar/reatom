import { atom, Atom, Ctx } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'

import { AsyncAction } from '.'
import { isShallowEqual } from '@reatom/utils'

export interface AsyncStatusesNeverPending {
  isPending: false
  isFulfilled: false
  isRejected: false
  isSettled: false

  isFirstPending: false
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

  isFirstPending: true
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

  isFirstPending: false
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

  isFirstPending: false
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

  isFirstPending: false
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

const memo =
  (reducer: (state: AsyncStatuses) => AsyncStatuses) =>
  (state: AsyncStatuses): AsyncStatuses => {
    const newState = reducer(state)
    return isShallowEqual(state, newState) ? state : newState
  }

export const withStatusesAtom =
  <
    T extends AsyncAction & {
      statusesAtom?: AsyncStatusesAtom
      retriesAtom?: Atom<number>
    },
  >({ pendingWhileRetrying }: { pendingWhileRetrying?: boolean } = {}) =>
  (anAsync: T): T & { statusesAtom: AsyncStatusesAtom } => {
    if (!anAsync.statusesAtom) {
      const statusesAtom = (anAsync.statusesAtom = atom<AsyncStatuses>(
        {
          isPending: false,
          isFulfilled: false,
          isRejected: false,
          isSettled: false,

          isFirstPending: false,
          // isAnotherPending: false,
          isEverPending: false,
          // isNeverPending: true,
          isEverSettled: false,
          // isNeverSettled: true,
        },
        `${anAsync.__reatom.name}.statusesAtom`,
      ))
      anAsync.onCall((ctx, payload) => {
        statusesAtom(
          ctx,
          memo((statuses) => {
            return {
              isPending: ctx.get(anAsync.pendingAtom) > 0,
              isFulfilled: false,
              isRejected: false,
              isSettled: false,

              isFirstPending: !statuses.isEverSettled,
              // isAnotherPending: statuses.isEverPending,
              isEverPending: true,
              // isNeverPending: false,
              isEverSettled: statuses.isEverSettled,
              // isNeverSettled: statuses.isNeverSettled,
            } as AsyncStatuses
          }),
        )

        function checkIfTheAsyncIsPending(ctx: Ctx) {
          if (ctx.get(anAsync.pendingAtom) > 0) return true

          if (pendingWhileRetrying && anAsync.retriesAtom)
            return ctx.get(anAsync.retriesAtom) > 0

          return false
        }

        __thenReatomed(
          ctx,
          payload,
          () =>
            statusesAtom(
              ctx,
              memo(() => {
                const isPending = checkIfTheAsyncIsPending(ctx)
                return {
                  isPending,
                  isFulfilled: !isPending,
                  isRejected: false,
                  isSettled: !isPending,

                  isFirstPending: false,
                  // isAnotherPending: false,
                  isEverPending: true,
                  // isNeverPending: false,
                  isEverSettled: true,
                  // isNeverSettled: false,
                } as AsyncStatuses
              }),
            ),
          () =>
            statusesAtom(
              ctx,
              memo(() => {
                const isPending = checkIfTheAsyncIsPending(ctx)
                return {
                  isPending,
                  isFulfilled: false,
                  isRejected: !isPending,
                  isSettled: !isPending,

                  isFirstPending: false,
                  // isAnotherPending: false,
                  isEverPending: true,
                  // isNeverPending: false,
                  isEverSettled: true,
                  // isNeverSettled: false,
                } as AsyncStatuses
              }),
            ),
        )
      })
    }

    return anAsync as T & { statusesAtom: Atom<AsyncStatuses> }
  }
