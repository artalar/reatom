import { createApp } from 'vue'
import App from './App.vue'
import { createReatomVue } from '@reatom/npm-vue'
import { createCtx } from '@reatom/core'
import { Quasar, Notify } from 'quasar'
import 'quasar/src/css/index.sass'

const ctx = createCtx()

const app = createApp(App)

app.use(Quasar, {
  plugins: {
    Notify,
  },
  config: {
    notify: {},
  },
})
app.use(createReatomVue(ctx))

app.mount('#app')
