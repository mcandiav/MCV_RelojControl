<template>
  <v-app>
    <appbar />
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="text-h6 font-weight-bold mb-2">Diagnóstico NetSuite (build test)</div>
            <div class="text-body-2">
              Usuario: {{ userLabel }} | API: <code>{{ apiBaseUrl }}</code> | Origen: <code>{{ browserOrigin }}</code>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="4">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Conectividad</div>
            <v-btn class="mr-2 mb-2" small outlined :loading="loadingPing" @click="testApiCorsPing">Probar API</v-btn>
            <v-btn class="mr-2 mb-2" small outlined :loading="loadingStatus" @click="loadNsStatus">Estado NetSuite</v-btn>
            <v-simple-table v-if="nsStatus" dense>
              <tbody>
                <tr v-for="row in nsStatusFlat" :key="row.key">
                  <td class="text-caption font-weight-medium">{{ row.key }}</td>
                  <td class="text-caption">{{ row.val }}</td>
                </tr>
              </tbody>
            </v-simple-table>
          </v-card>
        </v-col>

        <v-col cols="12" md="8">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Pruebas integración</div>
            <div class="d-flex flex-wrap" style="gap: 8px">
              <v-btn color="primary" :loading="loadingPeek" @click="peekDataset">Peek dataset</v-btn>
              <v-btn color="primary" :loading="loadingPull" @click="pullDataset">Pull dataset</v-btn>
              <v-btn color="secondary" :loading="loadingPush" @click="pushActuals">Push actuals</v-btn>
              <v-btn color="warning" :loading="loadingClearToken" @click="clearOAuthCache">Clear token cache</v-btn>
            </div>
            <v-alert v-if="lastResult" type="info" dense outlined class="mt-3 mb-0 text-left">
              <pre class="diag-json">{{ lastResult }}</pre>
            </v-alert>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>

<script>
import axios from 'axios'
import appbar from '@/components/navegation/appbar.vue'
import { mapGetters } from 'vuex'

const NETSUITE_AXIOS_TIMEOUT_MS = 180000

export default {
  name: 'NetsuiteDiagnostic',
  components: { appbar },
  data() {
    return {
      loadingPing: false,
      loadingStatus: false,
      loadingPeek: false,
      loadingPull: false,
      loadingPush: false,
      loadingClearToken: false,
      nsStatus: null,
      lastResult: ''
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user'
    }),
    userLabel() {
      if (!this.user) return '—'
      const name = [this.user.name, this.user.lastname].filter(Boolean).join(' ').trim()
      const role = this.user.Role && this.user.Role.name ? this.user.Role.name : '-'
      return `${name || '-'} (${role})`
    },
    apiBaseUrl() {
      return String((axios.defaults && axios.defaults.baseURL) || '(sin baseURL)')
    },
    browserOrigin() {
      if (typeof window === 'undefined') return '—'
      return window.location.origin || '—'
    },
    nsStatusFlat() {
      if (!this.nsStatus || typeof this.nsStatus !== 'object') return []
      return Object.keys(this.nsStatus).map((k) => ({
        key: k,
        val: typeof this.nsStatus[k] === 'object' ? JSON.stringify(this.nsStatus[k]) : String(this.nsStatus[k])
      }))
    }
  },
  methods: {
    setResult(payload) {
      this.lastResult = JSON.stringify(payload, null, 2)
    },
    normalizeAxiosError(error) {
      if (error && error.response) return error.response.data || { message: error.message }
      return { message: (error && error.message) || 'Error de red', code: error && error.code }
    },
    async testApiCorsPing() {
      this.loadingPing = true
      try {
        const base = String(axios.defaults.baseURL || '').replace(/\/$/, '')
        const url = `${base}/cors-ping`
        const res = await axios.get(url, { timeout: 25000 })
        this.setResult({ ok: true, url, data: res.data })
      } catch (error) {
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingPing = false
      }
    },
    async loadNsStatus() {
      this.loadingStatus = true
      try {
        const res = await axios.get('/chronometer/netsuite/status', { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsStatus = res.data || null
        this.setResult(res.data || {})
      } catch (error) {
        this.nsStatus = null
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingStatus = false
      }
    },
    async peekDataset() {
      this.loadingPeek = true
      try {
        const res = await axios.get('/chronometer/netsuite/peek-dataset?limit=5', { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.setResult(res.data || {})
      } catch (error) {
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingPeek = false
      }
    },
    async pullDataset() {
      this.loadingPull = true
      try {
        const res = await axios.post('/chronometer/netsuite/pull-dataset', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.setResult(res.data || {})
      } catch (error) {
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingPull = false
      }
    },
    async pushActuals() {
      this.loadingPush = true
      try {
        const res = await axios.post('/chronometer/netsuite/push-actuals', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.setResult(res.data || {})
      } catch (error) {
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingPush = false
      }
    },
    async clearOAuthCache() {
      this.loadingClearToken = true
      try {
        const res = await axios.post('/chronometer/netsuite/oauth/clear-cache', {}, { timeout: 30000 })
        this.setResult(res.data || {})
      } catch (error) {
        this.setResult(this.normalizeAxiosError(error))
      } finally {
        this.loadingClearToken = false
      }
    }
  }
}
</script>

<style scoped>
.diag-json {
  max-height: 420px;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
</style>
