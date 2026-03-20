<template>
  <div>
    <v-app-bar
      color="blue darken-2"
      dense
      dark
      class="appbar-main"
    >
      <v-app-bar-nav-icon disabled class="d-none d-sm-flex" />

      <v-toolbar-title class="font-weight-bold">BIGNOTTI Cronometro v2</v-toolbar-title>

      <v-spacer />

      <v-btn
        color="white"
        outlined
        class="btn-salir font-weight-bold"
        elevation="2"
        @click.prevent="signOut"
      >
        <v-icon left class="mr-1">mdi-logout</v-icon>
        Salir del programa
      </v-btn>
    </v-app-bar>
  </div>
</template>

<script>
import { mapActions } from 'vuex'
export default {
  methods: {
    ...mapActions({
      signOutAction: 'auth/signOut'
    }),
    signOut() {
      this.signOutAction().then(() => {
        this.$router.replace({
          name: 'Login'
        })
      })
    }
  }
}
</script>

<style scoped>
.btn-salir {
  border-width: 2px !important;
  letter-spacing: 0.02em;
}
.appbar-main {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}
</style>
