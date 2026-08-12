<template>
  <v-app>
    <router-view/>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'
import axios from 'axios'
import { getReleaseStamp, isTestBuild, releaseState, refreshApiProductVersion } from '@/utils/buildMode'

export default {
  name: 'App',
  components: {
  },
  data() {
    return {
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user'
    }),
    _releaseStampWatch() {
      return releaseState.apiVersion
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
    },
    _releaseStampWatch() {
      this.syncDocumentTitle()
    }
  },
  async created() {
    await refreshApiProductVersion(axios)
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
