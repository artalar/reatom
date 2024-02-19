import ReactDOM from 'react-dom/client'
import { createCtx, connectLogger } from '@reatom/framework'
import { reatomContext } from '@reatom/npm-react'
import { App } from './App'
import './index.css'

const ctx = createCtx()
connectLogger(ctx)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <reatomContext.Provider value={ctx}>
    <App />
  </reatomContext.Provider>,
)
