import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { atomizedRows } from './data'

export const TableWithComponentAtomization = () => (
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
        {atomizedRows.map((row, i) => (
          <TableRow
            key={i}
            sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
          >
            <TableCell component="th" scope="row">
              {row.name}
            </TableCell>
            <TableCell align="right">
              <row.calories.Component label="calories" variant="standard" />
            </TableCell>
            <TableCell align="right">
              <row.fat.Component label="fat" variant="standard" />
            </TableCell>
            <TableCell align="right">
              <row.carbs.Component label="carbs" variant="standard" />
            </TableCell>
            <TableCell align="right">
              <row.protein.Component label="protein" variant="standard" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
)
