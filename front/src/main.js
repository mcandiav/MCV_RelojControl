import Vue from 'vue'
import '@/styles/bignotti-brand.css'
import App from './App.vue'
import axios from 'axios'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import VueSession from 'vue-session'
import VueCookies from 'vue-cookies'
import { getBuildPath } from './utils/buildMode'

require('@/store/subscriber')

Vue.config.productionTip = false

function resolveApiBaseURL() {
  const w =
    typeof window !== 'undefined' &&
    window.__CRONOMETRO_API_BASE__ != null &&
    String(window.__CRONOMETRO_API_BASE__).trim() !== ''
      ? String(window.__CRONOMETRO_API_BASE__).trim()
      : ''
  const env = (process.env.VUE_APP_API_URL && String(process.env.VUE_APP_API_URL).trim()) || ''
  const raw = w || env
  if (!raw) return ''
  return raw.endsWith('/') ? raw : `${raw}/`
}

const resolvedApiBaseURL = resolveApiBaseURL()
axios.defaults.baseURL = resolvedApiBaseURL
if (typeof window !== 'undefined') {
  window.__CRONOMETRO_BUILD_PATH__ = getBuildPath()
}

if (!resolvedApiBaseURL) {
  console.error(
    '[Cronometro] API URL no configurada. Defini window.__CRONOMETRO_API_BASE__ (runtime) o VUE_APP_API_URL (build).'
  )
  axios.interceptors.request.use(() =>
    Promise.reject(new Error('API URL no configurada. Defini window.__CRONOMETRO_API_BASE__ o VUE_APP_API_URL.'))
  )
}

// Mixed content: pagina HTTPS no puede llamar a http://localhost.
if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
  const bu = String(axios.defaults.baseURL || '')
  if (/localhost|127\.0\.0\.1/i.test(bu) || /^http:\/\//i.test(bu)) {
    console.error(
      '[Cronometro] API URL incompatible con HTTPS:',
      bu,
      '-> Revisa public/api-config.js en el servidor o inyecta VUE_APP_API_URL con URL HTTPS del ambiente.'
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
    console.error('[bootstrap] auth/attempt fallo, se monta la app igual:', err)
  })
  .finally(() => {
    mountApp()
  })
