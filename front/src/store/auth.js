import axios from "axios"

export default {
    namespaced: true,
    state: {
        token: null,
        user: null
    },

    getters: {
        authenticated(state){
            return state.token && state.user
        },

        user(state){
            return state.user
        },

        isAdmin(state){
            return state.user && state.user.Role && state.user.Role.name == 'admin'
        }
    },

    mutations: {
        SET_TOKEN(state, token){
            state.token = token
        },

        SET_USER(state, id){
            state.user = id
        }

    },

    actions: {
        async signIn ({ dispatch } , credentials) {
            let response = await axios.post('/auth/signin', credentials)

            return dispatch('attempt', response.data.token)
        },

        async attempt({ commit } , token){
            if(token){
                commit('SET_TOKEN', token)
            } else {
                return
            }

            try {
                let response = await axios.get('auth/me')
                commit('SET_USER', response.data)
            } catch (error) {
                commit('SET_TOKEN', null)
                commit('SET_USER', null)
            }
        },
        signOut({ commit }){
            return axios.post('/auth/signout').then(() => {
                commit('SET_TOKEN', null)
                commit('SET_USER', null)
            })
        }
    }
}