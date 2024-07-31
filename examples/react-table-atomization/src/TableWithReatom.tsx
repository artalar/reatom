import { atom } from '@reatom/core'
import { reatomComponent, useAction } from '@reatom/npm-react'
import { withLocalStorage } from '@reatom/persist-web-storage'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell, { TableCellProps } from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import { getData } from './data'
import { Data } from './types'
import { isShallowEqual, select } from '@reatom/framework'

const listAtom = atom(getData(), 'listAtom').pipe(
  withLocalStorage('TableWithReatom'),
)
const namesAtom = atom((ctx, state?: Array<string>) => {
  const names = ctx.spy(listAtom).map(({ name }) => name)
  return isShallowEqual(names, state) ? state! : names
}, 'namesAtom')

const Cell = reatomComponent<
  TableCellProps & {
    idx: number
    name: keyof Data
  }
>(({ ctx, idx, name, ...tableCellProps }) => {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useAction(
    (ctx, { currentTarget: { value } }) => {
      listAtom(ctx, (list) => {
        const newList = [...list]
        const newRecord = { ...list[idx], [name]: value }
        newList[idx] = newRecord
        return newList
      })
    },
  )

  return (
    <TableCell {...tableCellProps}>
      <TextField
        value={select(ctx, (ctx) => ctx.spy(listAtom)[idx][name])}
        onChange={handleChange}
        label={name}
        variant="standard"
      />
    </TableCell>
  )
})

export const TableWithReatom = reatomComponent(
  ({ ctx }) => (
    <TableContainer component={Paper}>
      <Table aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Dessert (100g serving)</TableCell>
            <TableCell align="right">Calories</TableCell>
            <TableCell align="right">Fat&nbsp;(g)</TableCell>
            <TableCell align="right">Carbs&nbsp;(g)</TableCell>
            <TableCell align="right">Protein&nbsp;(g)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ctx.spy(namesAtom).map((name, i) => (
            <TableRow
              key={name}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {name}
              </TableCell>
              <Cell name="calories" idx={i} align="right" />
              <Cell name="fat" idx={i} align="right" />
              <Cell name="carbs" idx={i} align="right" />
              <Cell name="protein" idx={i} align="right" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  ),
  'TableWithReatom',
)
