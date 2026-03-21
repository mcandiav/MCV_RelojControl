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

const stationId = String(process.env.VUE_APP_STATION_ID || 'default-station').trim().slice(0, 64)
axios.defaults.headers.common['x-station-id'] = stationId

function bootstrapVue() {
  Vue.use(VueSession)
  Vue.use(VueCookies)
  Vue.$cookies.config('1d')
  new Vue({
    router,
    store,
    vuetify,
    render: (h) => h(App)
  }).$mount('#app')
}

store
  .dispatch('auth/attempt', localStorage.getItem(`token_${window.name}`))
  .then(() => bootstrapVue())
  .catch(() => bootstrapVue())