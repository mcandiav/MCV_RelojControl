<template>
  <div>
    <v-app-bar class="bignotti-app-bar" color="#f7f5f2" dense elevation="0">
      <v-menu offset-y>
        <template v-slot:activator="{ on, attrs }">
          <v-app-bar-nav-icon v-bind="attrs" v-on="on" />
        </template>
        <v-list dense>
          <v-list-item @click="goToTab('operacion')">
            <v-list-item-title>Operación</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('usuarios')">
            <v-list-item-title>Usuarios</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('sistema')">
            <v-list-item-title>Sistema</v-list-item-title>
          </v-list-item>
          <v-list-item v-if="isAdmin" @click="goToTab('sincronizacion')">
            <v-list-item-title>Sincronización</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-toolbar-title class="brand-title">
        <span class="brand-cluster">
          <img src="/logo.png" alt="Bignotti" class="app-logo app-logo--bignotti">
          <span class="brand-word">BIGNOTTI</span>
        </span>
        <span class="brand-cluster">
          <img :src="atOnceLogo" alt="At-Once" class="app-logo app-logo--atonce">
          <span class="brand-word">{{ cronometroTitle }}</span>
        </span>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <v-btn @click.prevent="signOut" outlined color="primary" class="salir-btn">
        <v-icon left>mdi-logout</v-icon>
        Salir
      </v-btn>
    </v-app-bar>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import { isTestBuild } from '@/utils/buildMode'
import atOnceLogo from '@/assets/at-once-logo.png'

export default {
  data() {
    return {
      atOnceLogo
    }
  },
  computed: {
    ...mapGetters({
      isAdmin: 'auth/isAdmin'
    }),
    cronometroTitle() {
      const buildLabel = String(process.env.VUE_APP_BUILD_VERSION || process.env.VUE_APP_BUILD_LABEL || 'V2').trim()
      const base = `Cronómetro v3 ${buildLabel}`.trim()
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
  margin-right: 6px;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-cluster {
  display: inline-flex;
  align-items: center;
}

.brand-word {
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #212121;
}

.app-logo--bignotti {
  height: 22px;
}

.app-logo--atonce {
  height: 22px;
}

.salir-btn {
  min-height: 36px;
}

.bignotti-app-bar {
  border-bottom: 1px solid #e0ddd8;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1) !important;
}
</style>
