<template>
  <div>
    <v-app-bar
      color="blue"
      dense
      dark
    >
      <v-app-bar-nav-icon></v-app-bar-nav-icon>

      <v-toolbar-title>BIGNOTTI Reloj Control</v-toolbar-title>

      <v-spacer></v-spacer>

      <v-menu
        left
        bottom
      >
      </v-menu>

      <v-btn @click.prevent="signOut" icon>
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>
  </div>
</template>


<script>
import { mapActions } from 'vuex'
export default {
  methods: {
    ...mapActions({
        signOutAction: 'auth/signOut',
    }),
    signOut(){
      this.signOutAction().then(() => {
        this.$router.replace({
          name: 'Login'
        })
      })
    },
    },
}
</script>

<style>
</style>