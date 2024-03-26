import * as React from 'react'
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
  list,
  setList,
  ...tableCellProps
}: TableCellProps & {
  idx: number
  name: keyof Data
  list: typeof rows
  setList: React.Dispatch<React.SetStateAction<typeof rows>>
}) => {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> =
    React.useCallback(
      ({ currentTarget: { value } }) => {
        setList((list) => {
          const newList = [...list]
          const newRecord = { ...list[idx], [name]: value }
          newList[idx] = newRecord
          return newList
        })
      },
      [idx, name, setList],
    )

  return (
    <TableCell {...tableCellProps}>
      <TextField
        value={list[idx][name]}
        onChange={handleChange}
        label={name}
        variant="standard"
      />
    </TableCell>
  )
}

export const TableWithUseState = () => {
  const [list, setList] = React.useState(rows)

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
              <Cell
                name="calories"
                idx={i}
                list={list}
                setList={setList}
                align="right"
              />
              <Cell
                name="fat"
                idx={i}
                list={list}
                setList={setList}
                align="right"
              />
              <Cell
                name="carbs"
                idx={i}
                list={list}
                setList={setList}
                align="right"
              />
              <Cell
                name="protein"
                idx={i}
                list={list}
                setList={setList}
                align="right"
              />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
