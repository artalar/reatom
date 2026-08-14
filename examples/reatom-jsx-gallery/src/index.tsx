import { mount } from '@reatom/jsx'

import { App } from './App'

// Mount app within created context
const { unmount } = mount(document.getElementById('app')!, <App />)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unmount()
  })
  import.meta.hot.accept()
}
