import * as React from 'react'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import { getData } from './data'
import { Data, DataList } from './types'

const Field = React.memo(function Field({
  idx,
  name,
  list,
  onChange,
}: {
  idx: number
  name: keyof Data
  list: DataList
  onChange: (idx: number, name: keyof Data, value: string) => void
}) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> =
    React.useCallback(
      ({ currentTarget: { value } }) => onChange(idx, name, value),
      [idx, name, onChange],
    )

  return (
    <TextField
      value={list[idx][name]}
      onChange={handleChange}
      label={name}
      variant="standard"
    />
  )
})

const KEY = 'TableWithUseState'
export const TableWithUseState = () => {
  const [list, setList] = React.useState((): DataList => {
    const snapshot = localStorage.getItem(KEY)
    return snapshot ? JSON.parse(snapshot) : getData()
  })

  React.useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(list))
  }, [list])

  const handleItemChange = React.useCallback(
    (idx: number, name: keyof Data, value: string) => {
      setList((list) => {
        const newList = [...list]
        const newRecord = { ...list[idx], [name]: value }
        newList[idx] = newRecord
        return newList
      })
    },
    [setList],
  )

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
              <TableCell align="right">
                <Field
                  name="calories"
                  idx={i}
                  list={list}
                  onChange={handleItemChange}
                />
              </TableCell>
              <TableCell align="right">
                <Field
                  name="fat"
                  idx={i}
                  list={list}
                  onChange={handleItemChange}
                />
              </TableCell>
              <TableCell align="right">
                <Field
                  name="carbs"
                  idx={i}
                  list={list}
                  onChange={handleItemChange}
                />
              </TableCell>
              <TableCell align="right">
                <Field
                  name="protein"
                  idx={i}
                  list={list}
                  onChange={handleItemChange}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
