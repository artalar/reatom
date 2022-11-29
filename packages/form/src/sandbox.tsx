import {
  createCtx,
  connectLogger,
  parseAtoms,
  onUpdate,
} from '@reatom/framework'
import { reatomContext, useCtxBind } from '@reatom/npm-react'
import * as ReactDOMClient from 'react-dom/client'
import React from 'react'
import { reatomHTMLForm } from './form-web'

const form = reatomHTMLForm({
  // you could use `fieldsListAtom` for dynamic forms
  onSubmit(ctx, { fieldsListAtom }) {
    const data = parseAtoms(ctx, {
      name: nameFieldAtom,
      age: ageFieldAtom,
      sex: sexFieldsAtom,
      driver: driverFieldAtom,
      hobby: hobbyFieldAtom,
    })
    console.log(data)
  },
})
const nameFieldAtom = form.reatomHTMLField('')
const ageFieldAtom = form.reatomHTMLField(14)
const driverFieldAtom = form.reatomHTMLField(false)
const sexFieldsAtom = form.reatomHTMLField({
  male: false,
  female: false,
})
const hobbyFieldAtom = form.reatomHTMLField(
  new Array<'swim' | 'walk' | 'draw' | 'music'>(),
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
        <input ref={bind(sexFieldsAtom.female.register)} required />
        <input ref={bind(sexFieldsAtom.male.register)} required />
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
// connectLogger(ctx);
// ctx.subscribe(console.log);

const rootElement = document.getElementById('root')!
const root = ReactDOMClient.createRoot(rootElement)

ctx.get(() => {
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
})
