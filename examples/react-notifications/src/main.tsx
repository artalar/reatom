import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.tsx'
import { reatomContext } from '@reatom/npm-react'
import { connectLogger, createCtx } from '@reatom/framework'

const ctx = createCtx()

if (import.meta.env.DEV) {
  connectLogger(ctx)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <reatomContext.Provider value={ctx}>
      <App />
    </reatomContext.Provider>
  </React.StrictMode>,
)
