import Vue from 'vue'
import App from './App.vue'
import axios from 'axios'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import VueSession from 'vue-session'
import VueCookies from 'vue-cookies'

require('@/store/subscriber')

Vue.config.productionTip = false
axios.defaults.baseURL = process.env.VUE_APP_API_URL || 'http://localhost:8000/'
// Mixed content: página HTTPS no puede llamar a http://localhost — falla en <1s como "Network Error".
if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
  const bu = String(axios.defaults.baseURL || '')
  if (/localhost|127\.0\.0\.1/i.test(bu) || /^http:\/\//i.test(bu)) {
    console.error(
      '[Cronómetro] API URL incompatible con HTTPS:',
      bu,
      '→ Rebuild del front con VUE_APP_API_URL=https://reloj-api.at-once.cl/ (en EasyPanel no dejes el build-arg vacío).'
    )
  }
}
// Evita pantalla en blanco indefinida si la API no responde (attempt espera auth/me).
axios.defaults.timeout = 20000

function mountApp() {
  Vue.use(VueSession)
  Vue.use(VueCookies)
  Vue.$cookies.config('1d')
  new Vue({
    router,
    store,
    vuetify,
    render: h => h(App)
  }).$mount('#app')
}

store
  .dispatch('auth/attempt', localStorage.getItem(`token_${window.name}`))
  .catch((err) => {
    console.error('[bootstrap] auth/attempt falló, se monta la app igual:', err)
  })
  .finally(() => {
    mountApp()
  })