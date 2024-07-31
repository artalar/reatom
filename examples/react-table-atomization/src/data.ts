import { random } from '@reatom/framework'
import { DataList } from './types'

export const getData = (length = 50): DataList =>
  Array.from({ length }, () => ({
    name: random(1e10, 1e20).toString(32),
    calories: random(0, 100),
    fat: random(0, 100),
    carbs: random(0, 100),
    protein: random(0, 100),
  }))
