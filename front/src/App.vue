<template>
  <v-app>
    <router-view/>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'
import { getReleaseStamp, isTestBuild } from '@/utils/buildMode'

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
      const base = `Cronometro ${getReleaseStamp()}`
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

<style>
.release-stamp {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-weight: 800;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
</style>
