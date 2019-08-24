// github.com/artalar/flaxom

import React from 'react'
import ReactDOM from 'react-dom'
import { createStore, createAtom } from 'flaxom'

import { Root, context } from './root'

const { Provider } = context
const store = createStore(
  createAtom('static atom only for store creation', null, () => {}),
)

ReactDOM.render(
  <Provider value={store}>
    <Root />
  </Provider>,
  document.getElementById('app'),
)
