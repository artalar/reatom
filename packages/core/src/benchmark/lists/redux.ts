import { Reducer, combineReducers, createStore } from 'redux'
import { createSelector } from 'reselect'

type ReducerType<R> = R extends Reducer<infer T> ? T : never
export type Addresses = {
  ids: string[]
  cities: Record<string, string>
  streets: Record<string, string>
  houses: Record<string, number>
}

export const fetchAddressesDone = (payload: Addresses) => ({
  type: 'FETCH_ADDRESSES_DONE' as const,
  payload,
})
// export const changeCite = (payload) =>...
// export const changeStreet = (payload) =>...
export const changeHouse = (payload: { id: string; value: number }) => ({
  type: 'CHANGE_HOUSE' as const,
  payload,
})
export const changeInput = (payload: string) => ({
  type: 'CHANGE_INPUT' as const,
  payload,
})

type Actions =
  | ReturnType<typeof fetchAddressesDone>
  | ReturnType<typeof changeHouse>
  | ReturnType<typeof changeInput>

export const addressesIdsListReducer = (
  state: Addresses['ids'] = [],
  action: Actions,
): Addresses['ids'] => {
  if (action.type === 'FETCH_ADDRESSES_DONE') return action.payload.ids
  return state
}
export const citiesReducer = (
  state: Addresses['cities'] = {},
  action: Actions,
): Addresses['cities'] => {
  if (action.type === 'FETCH_ADDRESSES_DONE') return action.payload.cities
  return state
}
export const streetsReducer = (
  state: Addresses['streets'] = {},
  action: Actions,
): Addresses['streets'] => {
  if (action.type === 'FETCH_ADDRESSES_DONE') return action.payload.streets
  return state
}
export const housesReducer = (
  state: Addresses['houses'] = {},
  action: Actions,
): Addresses['houses'] => {
  if (action.type === 'FETCH_ADDRESSES_DONE') return action.payload.houses
  if (action.type === 'CHANGE_HOUSE')
    return { ...state, [action.payload.id]: action.payload.value }
  return state
}
export const inputReducer = (state = '', action: Actions): string => {
  if (action.type === 'CHANGE_INPUT') return action.payload
  return state
}

const root = combineReducers({
  addressesIdsList: addressesIdsListReducer,
  cities: citiesReducer,
  streets: streetsReducer,
  houses: housesReducer,
  input: inputReducer,
})

type RootState = ReducerType<typeof root>

export const createSelectorCitiesCell = (id, cb: () => any) =>
  createSelector(
    createSelector(
      (state: RootState) => state.cities,
      value => value[id],
    ),
    cb,
  )

export const createSelectorStreetsCell = (id, cb: () => any) =>
  createSelector(
    createSelector(
      (state: RootState) => state.streets,
      value => value[id],
    ),
    cb,
  )

export const createSelectorHousesCell = (id, cb: () => any) =>
  createSelector(
    createSelector(
      (state: RootState) => state.houses,
      value => value[id],
    ),
    cb,
  )
export const createSelectorInput = (cb: () => any) =>
  createSelector(
    (state: RootState) => state.input,
    cb,
  )

export const initializeStore = () => createStore(root)
