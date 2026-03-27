import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import NetsuiteDiagnostic from '@/views/NetsuiteDiagnostic.vue'
import NotFound from '@/views/NotFound.vue'
import store from '@/store'

Vue.use(VueRouter)

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
        beforeEnter: (to, from, next) => {
            if(store.getters['auth/authenticated']){
                return next()
            }else{
                next({name: 'Login'})
            }
        }
      },
    {
        path: '/diagnostic',
        name: 'NetsuiteDiagnostic',
        component: NetsuiteDiagnostic,
        beforeEnter: (to, from, next) => {
            if (!store.getters['auth/authenticated']) {
                return next({ name: 'Login' })
            }
            if (!store.getters['auth/isAdmin']) {
                return next({ name: 'Home' })
            }
            return next()
        }
      },
    {
        path: '/login',
        name: 'Login',
        component: Login,
    },
    { 
        path: '*',
        name: 'NotFound',
        component: NotFound
    }
]

const router = new VueRouter({
    base: process.env.BASE_URL,
    routes
})

export default router