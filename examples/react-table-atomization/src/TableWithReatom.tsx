import { AtomMut } from '@reatom/core'
import { useAction, useAtom } from '@reatom/npm-react'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell, { TableCellProps } from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import { Data, rows } from './data'

const Cell = ({
  idx,
  name,
  listAtom,
  ...tableCellProps
}: TableCellProps & {
  idx: number
  name: keyof Data
  listAtom: AtomMut<typeof rows>
}) => {
  const [value] = useAtom((ctx) => ctx.spy(listAtom)[idx][name])
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
        value={value}
        onChange={handleChange}
        label={name}
        variant="standard"
      />
    </TableCell>
  )
}

export const TableWithReatom = () => {
  const [list, , listAtom] = useAtom(rows, [], { subscribe: false })

  return (
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
          {list.map((row, i) => (
            <TableRow
              key={i}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {row.name}
              </TableCell>
              <Cell name="calories" idx={i} listAtom={listAtom} align="right" />
              <Cell name="fat" idx={i} listAtom={listAtom} align="right" />
              <Cell name="carbs" idx={i} listAtom={listAtom} align="right" />
              <Cell name="protein" idx={i} listAtom={listAtom} align="right" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
