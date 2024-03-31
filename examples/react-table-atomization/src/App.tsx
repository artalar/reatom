import React from 'react'
import { TableWithUseState } from './TableWithUseState'
import { TableWithReatom } from './TableWithReatom'
import { TableWithAtomization } from './TableWithAtomization'
import { TableWithComponentAtomization } from './TableWithComponentAtomization'
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ThemeProvider,
  createTheme,
} from '@mui/material'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

export const App = () => {
  const [state, setState] = React.useState('useState')

  console.time('table mount')
  React.useEffect(() => console.timeEnd('table mount'))

  const Component = {
    useState: TableWithUseState,
    Reatom: TableWithReatom,
    Atomization: TableWithAtomization,
    ComponentAtomization: TableWithComponentAtomization,
  }[state]

  return (
    <ThemeProvider theme={darkTheme}>
      <FormControl fullWidth>
        <InputLabel id="type-select">Type</InputLabel>
        <Select
          labelId="type-select"
          value={state}
          label="Type"
          onChange={(e) => setState(e.target.value)}
        >
          <MenuItem value="useState">useState</MenuItem>
          <MenuItem value="Reatom">Reatom</MenuItem>
          <MenuItem value="Atomization">Atomization</MenuItem>
          <MenuItem value="ComponentAtomization">
            Component Atomization
          </MenuItem>
        </Select>
      </FormControl>
      <br />
      {Component && <Component />}
    </ThemeProvider>
  )
}
