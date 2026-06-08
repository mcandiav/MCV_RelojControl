<template>
  <v-app>
    <router-view/>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'
import { getUiVersion, isTestBuild } from '@/utils/buildMode'

export default {
  name: 'App',
  components: {
  },
  data() {
    return {
    }
  },
  watch: {
    '$route.path'() {
      this.syncDocumentTitle()
    },
    user: {
      handler() {
        this.syncDocumentTitle()
      },
      deep: true
    }
  },
  mounted() {
  },
  created() {
    this.syncDocumentTitle()
  },
  methods: {
    syncDocumentTitle() {
      const who = this.user
        ? String(this.user.username || [this.user.name, this.user.lastname].filter(Boolean).join(' ') || 'Usuario').trim()
        : 'Usuario'
      const base = `Cronometro - ${getUiVersion()}`
      document.title = isTestBuild() ? `${who} - ${base} [TEST]` : `${who} - ${base}`
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user'
    })
  }

}
</script>
