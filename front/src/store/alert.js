export default {
    namespaced: true,
    state: {
        snack: null,
        show: false,
        color: 'success'
    },

    getters: {
        snack(state){
            return state.snack
        },
        snackShow(state){
            return state.show
        },
        snackColor(state){
            return state.color
        }
    },

    mutations: {
        SET_SNACK_TEXT(state, text){
            state.snack = text
        },
        SET_SNACK_SHOW(state, value){
            state.show = value
        },
        SET_SNACK_COLOR(state, value){
            state.color = value
        }
    },

    actions: {
        snack({ commit }, {text, color}) {
            console.log('text: ', text, ' color: ', color)
            commit('SET_SNACK_TEXT', text)
            commit('SET_SNACK_COLOR', color)
            commit('SET_SNACK_SHOW', true)

            setTimeout(() => {
                commit('SET_SNACK_SHOW', false)
                commit('SET_SNACK_TEXT', null)
            }, 2000)
        },
    }
}