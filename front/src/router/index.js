import Vue from 'vue'
import VueRouter from 'vue-router'
import Home from '@/views/Home.vue'
import Test from '@/views/Test.vue'
import Login from '@/views/Login.vue'
import NotFound from '@/views/NotFound.vue'
import store from '@/store'

Vue.use(VueRouter)

const routes = [
    {
        path: '/test',
        name: 'Test',
        component: Test
    },
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