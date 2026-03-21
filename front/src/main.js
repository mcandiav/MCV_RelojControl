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
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*'
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