import { atom } from '@reatom/framework'

const createData = (
  name: string,
  calories: number,
  fat: number,
  carbs: number,
  protein: number,
) => ({ name, calories, fat, carbs, protein })

export type Data = ReturnType<typeof createData>

export const rows = [
  createData('Frozen yoghurt', 159, 6.0, 24, 4.0),
  createData('Ice cream sandwich', 237, 9.0, 37, 4.3),
  createData('Eclair', 262, 16.0, 24, 6.0),
  createData('Cupcake', 305, 3.7, 67, 4.3),
  createData('Gingerbread', 356, 16.0, 49, 3.9),
]
rows.push(...rows)
rows.push(...rows)
rows.push(...rows)

export const atomizedRows = rows.map(
  ({ name, calories, fat, carbs, protein }) => ({
    name,
    calories: atom(calories, 'calories'),
    fat: atom(fat, 'fat'),
    carbs: atom(carbs, 'carbs'),
    protein: atom(protein, 'protein'),
  }),
)
