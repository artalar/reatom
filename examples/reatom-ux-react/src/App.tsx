import { reatomComponent } from '@reatom/react'
import { reatomCheckbox } from '@reatom/ux'

/**
 * The same headless model the no-framework example uses, bound with React this
 * time. `@reatom/ux` carries no view dependency, so the only thing that changes
 * between adapters is how the prop record reaches the element — here a plain
 * React spread of `item(value).props.control()`.
 *
 * The group value is an array of the checked item values.
 */
const fruits = reatomCheckbox<Array<string>>({ value: [], name: 'fruits' })
const options = ['apple', 'orange', 'pear']

// `reatomComponent` re-renders whenever an atom read in its body changes, so
// reading the prop record and the group value is all the wiring needed.
export const App = reatomComponent(
  () => (
    <main>
      <h1>@reatom/ux — React</h1>

      {options.map((value) => (
        <label key={value} style={{ display: 'block' }}>
          <input {...fruits.item(value).props.control()} /> {value}
        </label>
      ))}

      <pre>checked: {JSON.stringify(fruits())}</pre>
    </main>
  ),
  'App',
)
