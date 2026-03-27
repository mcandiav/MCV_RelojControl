<template>
  <div>
    <v-app-bar
      color="blue"
      dense
      dark
    >
      <v-app-bar-nav-icon></v-app-bar-nav-icon>

      <v-toolbar-title>{{ appTitle }}</v-toolbar-title>

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
import { isTestBuild } from '@/utils/buildMode'
export default {
  computed: {
    appTitle() {
      const buildLabel = String(process.env.VUE_APP_BUILD_VERSION || process.env.VUE_APP_BUILD_LABEL || 'V2').trim()
      const base = `BIGNOTTI Cronómetro v3 ${buildLabel}`.trim()
      return isTestBuild() ? `${base} [TEST]` : base
    }
  },
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