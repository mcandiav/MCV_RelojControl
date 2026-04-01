<template>
  <div>
    <v-app-bar color="blue" dense dark>
      <v-menu offset-y>
        <template v-slot:activator="{ on, attrs }">
          <v-app-bar-nav-icon v-bind="attrs" v-on="on" />
        </template>
        <v-list dense>
          <v-list-item @click="goToTab('operacion')">
            <v-list-item-title>Operacion</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('usuarios')">
            <v-list-item-title>Usuarios</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('sistema')">
            <v-list-item-title>Sistema</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('sincronizacion')">
            <v-list-item-title>Sincronizacion</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-toolbar-title class="d-flex align-center">
        <img src="/logo-bignotti-doc.png" alt="Bignotti" class="app-logo">
        <span>{{ appTitle }}</span>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <v-btn @click.prevent="signOut" outlined class="salir-btn">
        <v-icon left>mdi-logout</v-icon>
        Salir
      </v-btn>
    </v-app-bar>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import { isTestBuild } from '@/utils/buildMode'

export default {
  computed: {
    ...mapGetters({
      isAdmin: 'auth/isAdmin'
    }),
    appTitle() {
      const buildLabel = String(process.env.VUE_APP_BUILD_VERSION || process.env.VUE_APP_BUILD_LABEL || 'V2').trim()
      const base = `BIGNOTTI Cronometro v3 ${buildLabel}`.trim()
      return isTestBuild() ? `${base} [TEST]` : base
    }
  },
  methods: {
    ...mapActions({
      signOutAction: 'auth/signOut'
    }),
    goToTab(tab) {
      this.$router.push({ name: 'Home', query: { tab } })
    },
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
.app-logo {
  height: 24px;
  width: auto;
  margin-right: 8px;
}

.salir-btn {
  min-height: 36px;
}
</style>
