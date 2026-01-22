import axios from "axios"

export default {
    namespaced: true,
    state: {
        getWorksOrders: null,
        getStats: null,
        lastId: null, // El ultimo id utilizado en los csv.
        search: null, // La ultima busqueda realizada.
        timeServer: null, // La hora del servidor.
    },

    getters: {
        allWorksOrders(state){
            return state.getWorksOrders
        },
        statsOrders(state){
            return state.getStats
        },
        currentLastId(state){
            return state.lastId
        },
        currentSearch(state){
            return state.search
        },
        currentTimeServer(state){
            return state.timeServer
        }
    },

    mutations: {
        SET_LIST_WORKS_ORDERS(state, data){
            state.getWorksOrders = data
        },
        SET_STATS_ORDERS(state, data){
            state.getStats = data
        },
        SET_LAST_ID(state, data){
            state.lastId = data
        },
        SET_LAST_SEARCH(state, data){
            state.search = data
        },
        SET_TIME_SERVER(state, data){
            state.timeServer = data
        }
    },

    actions: {
        getListOrder({ commit }, {search, pagination, itemsPerPage, status}) {
            console.log('Buscando...', search, pagination, status)
            axios.get('/order?search=' + search + '&pag=' + pagination + '&items=' + itemsPerPage + '&status=' + status).then((response) => {
                if(response.status == 200){
                    commit("SET_LIST_WORKS_ORDERS", response.data.orders)
                    commit("SET_STATS_ORDERS", response.data.group)
                    commit("SET_LAST_SEARCH", search)
                }
            })
        },
        getTimeServer({ commit }){
            axios.get('/order/serverTime').then((response) => {
                if(response.status == 200){
                    //console.log(response.data)
                    commit("SET_TIME_SERVER", response.data.serverTime)
                }
            })
        },
        getListsRecords({ commit }, search) {
            console.log('Buscando...', search)
            axios.get('/order/download?search=' + search).then((response) => {
                if(response.status == 200){
                    //console.log(response.data)
                    commit("SET_LIST_WORKS_ORDERS", response.data.orders)
                    commit("SET_STATS_ORDERS", response.data.group)
                    commit("SET_LAST_SEARCH", search)
                }
            })
        },
        createOrder({ commit }, { payload }){
            axios.post('/order', payload).then((response) => {
                if(response.status == 200){
                    //console.log(response.data)
                    commit("SET_LIST_WORKS_ORDERS", response.data)
                    this.getListOrder()
                }
            })
        },
        getLastId({ commit }){
            axios.get('/order/lastid').then((response) => {
                if(response.status == 200){
                    //console.log(response.data)
                    commit("SET_LAST_ID", response.data.lastId)
                }
            })
        },
        updatelastId({ commit }, payload){
            axios.post('/order/updateid', payload).then((response) => {
                if(response.status == 200){
                    //console.log(response.data)
                    commit("SET_LAST_ID", response.data.lastId)
                }
            })
        },
    }
}