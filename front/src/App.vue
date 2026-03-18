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
        console.log(this.$route)
        console.log(this.user)
        if(this.user !== null){
          document.title = this.user.name + " " + this.user.lastname
        }else{
          document.title = "Reloj Control"
        }
      }
    },
  },
  mounted(){
  },
  created(){
    if(this.user !== null){
      document.title = this.user.name + " " + this.user.lastname
    }else{
      document.title = "Reloj Control"
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