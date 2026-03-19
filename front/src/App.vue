<template>
  <v-app>
    <router-view/>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'App',
  components: {
  },
  data (){
    return {
    }
  },
  watch: {
    '$route.path': {
      handler(){
        if(this.user !== null){
          document.title = "Cronometro v2 - " + this.user.name + " " + this.user.lastname
        }else{
          document.title = "Cronometro v2"
        }
      }
    },
  },
  mounted(){
  },
  created(){
    if(this.user !== null){
      document.title = "Cronometro v2 - " + this.user.name + " " + this.user.lastname
    }else{
      document.title = "Cronometro v2"
    }
  },
  methods: {
  },
  computed: {
    ...mapGetters({
      user: 'auth/user'
    })
  }

};
</script>