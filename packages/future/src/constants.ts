export const INTERNAL = Symbol('REATOM_FUTURE_INTERNAL')

export type INTERNAL = typeof INTERNAL

/**
 * Token to stop reactive update propagation.
 * (filtered to undefined for executors and subscribers)
 *
 * TODO: May by Symbol???
 */
export const STOP = 'REATOM_STOP_TOKEN' as const

export type STOP = typeof STOP
