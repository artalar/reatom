import { atom, random } from '@reatom/framework'
import { reatomZod } from '@reatom/npm-zod'
import { DataList } from './types'

export const getData = (length: number): DataList =>
  Array.from({ length }, () => ({
    name: random(1e10, 1e20).toString(32),
    calories: random(0, 100),
    fat: random(0, 100),
    carbs: random(0, 100),
    protein: random(0, 100),
  }))

export const dataRows = getData(20)

export const atomizedRows = dataRows.map((data) => ({
  name: data.name,
  calories: atom(data.calories, 'calories'),
  fat: atom(data.fat, 'fat'),
  carbs: atom(data.carbs, 'carbs'),
  protein: atom(data.protein, 'protein'),
}))

export const zodRows = reatomZod(DataList, { initState: dataRows })
