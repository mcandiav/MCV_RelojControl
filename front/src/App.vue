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
      const base = isTestBuild() ? 'Bignotti · Cronómetro v3 [TEST]' : 'Bignotti · Cronómetro v3'
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