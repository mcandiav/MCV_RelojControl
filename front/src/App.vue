<template>
  <v-app>
    <router-view/>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'
import { isTestBuild } from '@/utils/buildMode'

export default {
  name: 'App',
  components: {
  },
  data (){
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
      const buildLabel = String(process.env.VUE_APP_BUILD_LABEL || 'V2').trim()
      const baseCore = `Bignotti · Cronómetro v3 ${buildLabel}`.trim()
      const base = isTestBuild() ? `${baseCore} [TEST]` : baseCore
      if (this.user != null) {
        const who = [this.user.name, this.user.lastname].filter(Boolean).join(' ').trim()
        document.title = who ? `${base} – ${who}` : base
      } else {
        document.title = base
      }
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user'
    })
  }

};
</script>