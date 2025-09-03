import Vue from "vue";
import Vuex from "vuex";

import order from './order'
import auth from "./auth"
import alert from "./alert";

Vue.use(Vuex);


export default new Vuex.Store({
	state: {
		//
	},
	mutations: {
		//
	},
	actions: {
		//
	},
	modules: {
		order, 
		auth,
		alert
	}
});