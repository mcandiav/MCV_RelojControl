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
axios.defaults.baseURL= 'http://192.168.101.5:8000/' //'http://128.1.1.197:8000/' //'http://192.168.101.5:8000/' //'http://128.1.1.197:8000/' //'http://192.168.101.4:8000/'//'http://192.168.101.4:8000/'//'http://128.1.1.197:8000/'//'http://192.168.101.20:8000'//'http://128.1.1.77:8000/'
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';
//axios.defaults.baseURL = 'http://52.207.214.131:8000'

// Vue.config.productionTip = false
// axios.defaults.baseURL='http://192.168.101.19:8000/'
// axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';
// //axios.defaults.baseURL = 'http://52.207.214.131:8000'

store.dispatch('auth/attempt', localStorage.getItem(`token_${window.name}`)).then(() => {
  Vue.use(VueSession)
  Vue.use(VueCookies)
  Vue.$cookies.config('1d')
  new Vue({
    router,
    store,
    vuetify,
    render: h => h(App)
  }).$mount('#app')
})