import * as reatom from '../../build'

const { declareAtom, declareAction, createStore, map, combine } = reatom

export type Addresses = {
  ids: string[]
  cities: Record<string, string>
  streets: Record<string, string>
  houses: Record<string, number>
}

export const fetchAddressesDone = declareAction<Addresses>()
// export const changeCite = declareAction...
// export const changeStreet = declareAction...
export const changeHouse = declareAction<{
  id: string
  value: number
}>()
export const changeInput = declareAction<string>()

export const AddressesIdsList = declareAtom<Addresses['ids']>([], (reduce) => [
  reduce(fetchAddressesDone, (state, { ids }) => ids),
])
export const Cities = declareAtom<Addresses['cities']>({}, (reduce) => [
  reduce(fetchAddressesDone, (state, { cities }) => cities),
])
export const Streets = declareAtom<Addresses['streets']>({}, (reduce) => [
  reduce(fetchAddressesDone, (state, { streets }) => streets),
])
export const Houses = declareAtom<Addresses['houses']>({}, (reduce) => [
  reduce(fetchAddressesDone, (state, { houses }) => houses),
  reduce(changeHouse, (state, { id, value }) => ({ ...state, [id]: value })),
])
export const Input = declareAtom('', (reduce) => [
  reduce(changeInput, (state, input) => input),
])

const Root = combine([AddressesIdsList, Cities, Streets, Houses, Input])

export const declareCitiesCell = (id: string) =>
  map(Cities, (cities) => cities[id])
export const declareStreetsCell = (id: string) =>
  map(Streets, (streets) => streets[id])
export const declareHousesCell = (id: string) =>
  map(Houses, (houses) => houses[id])

export const initializeStore = () => createStore(Root)
