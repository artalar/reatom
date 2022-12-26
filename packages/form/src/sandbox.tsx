import {
  createCtx,
  connectLogger,
  parseAtoms,
  onUpdate,
} from '@reatom/framework'
import { reatomContext, useAtom, useCtxBind } from '@reatom/npm-react'
import * as ReactDOMClient from 'react-dom/client'
import React from 'react'
import { reatomHTMLForm } from './form-web'

import { unstable_batchedUpdates } from 'react-dom'
import { setupBatch } from '@reatom/npm-react'

setupBatch(unstable_batchedUpdates)

const form = reatomHTMLForm({
  name: 'example',
  // you could use `fieldsListAtom` for dynamic forms
  onSubmit(ctx, { fieldsListAtom }) {
    const data = parseAtoms(ctx, {
      name: nameFieldAtom,
      age: ageFieldAtom,
      pet: petFieldsAtom,
      driver: driverFieldAtom,
      hobby: hobbyFieldAtom,
    })
    console.log(data)
  },
})
const nameFieldAtom = form.reatomHTMLField('', 'name')
const ageFieldAtom = form.reatomHTMLField(14, 'age')
const driverFieldAtom = form.reatomHTMLField(false, 'driver')
const petFieldsAtom = form.reatomHTMLField(
  {
    cat: false,
    dog: false,
  },
  'sex',
)
const hobbyFieldAtom = form.reatomHTMLField(
  new Array<'swim' | 'walk' | 'draw' | 'music'>(),
  'hobby',
)
onUpdate(ageFieldAtom, (ctx, age) => {
  driverFieldAtom.attributesAtom.merge(ctx, { disabled: age < 18 })
})

export default function App() {
  const bind = useCtxBind()
  const rerenders = React.useRef(0)

  return (
    <form ref={bind(form.register)} className="form">
      <label>
        Name:
        <input ref={bind(nameFieldAtom.register)} autoFocus required />
      </label>
      <label>
        Age:
        <input ref={bind(ageFieldAtom.register)} required min="14" />
      </label>
      <label>
        Sex:
        <br />
        <label>
          Cat
          <input ref={bind(petFieldsAtom.cat.register)} required />
        </label>
        <br />
        <label>
          Dog
          <input ref={bind(petFieldsAtom.dog.register)} required />
        </label>
      </label>
      <label>
        Hobby:
        <select ref={bind(hobbyFieldAtom.register)}>
          <option value="swim">swim</option>
          <option value="walk">walk</option>
          <option value="draw">draw</option>
          <option value="music">music</option>
        </select>
      </label>
      <label>
        Driver license:
        <input ref={bind(driverFieldAtom.register)} disabled />
      </label>
      <input type="submit" />
      <button onClick={bind(form.reset)}>reset</button>

      <p>rerenders: {rerenders.current++}</p>
    </form>
  )
}

const ctx = createCtx()
connectLogger(ctx)

const rootElement = document.getElementById('root')!
const root = ReactDOMClient.createRoot(rootElement)

root.render(
  <reatomContext.Provider value={ctx}>
    <App />
    <style>{`
        .form {
          width: 5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }  
      `}</style>
  </reatomContext.Provider>,
)
