<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card outlined class="pa-4">
          <div class="text-h6 font-weight-bold mb-2">Test Pull · POST /chronometer/netsuite/pull-dataset</div>
          <div class="text-body-2 grey--text text--darken-1 mb-3">
            1 botón y 1 consola: muestra respuesta o error del pull real.
          </div>

          <div class="d-flex flex-wrap align-center" style="gap: 8px">
            <v-btn color="error" :loading="loadingPull" @click="runPullDataset">
              Probar pull (dry-run)
            </v-btn>
            <span class="text-caption grey--text">
              baseURL: <code>{{ apiBaseUrl }}</code>
            </span>
          </div>

          <v-alert v-if="pullConsoleError" type="error" dense class="mt-3">
            {{ pullConsoleError }}
          </v-alert>

          <v-alert v-if="pullConsole" type="info" dense outlined class="mt-3">
            <pre class="ns-json" style="white-space: pre-wrap; margin: 0">{{ pullConsole }}</pre>
          </v-alert>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import axios from 'axios'

// Pull NetSuite suele tardar varios minutos; el timeout real lo maneja el backend + axios.
const NETSUITE_AXIOS_TIMEOUT_MS = 180000

export default {
  name: 'Test',
  data() {
    return {
      loadingPull: false,
      pullConsole: '',
      pullConsoleError: '',
    }
  },
  computed: {
    apiBaseUrl() {
      return axios.defaults.baseURL || ''
    }
  },
  methods: {
    netsuiteAxiosErrorPayload(error) {
      const base = String(axios.defaults.baseURL || '').replace(/\/$/, '')
      if (error && error.code === 'ECONNABORTED') {
        return { message: 'Timeout agotado.', code: 'ECONNABORTED' }
      }
      if (error && error.message === 'Network Error') {
        return {
          message:
            'Network Error (sin respuesta HTTP). Conecta pero falló POST/timeout/proxy/TLS intermedio.',
          code: 'NETWORK_ERROR',
          axios_baseURL: axios.defaults.baseURL || null
        }
      }
      if (error && error.response) {
        return {
          message: error.response.data && error.response.data.message ? error.response.data.message : 'Error HTTP en API.',
          status: error.response.status,
          code: error.code || null,
          errorData: error.response.data || null
        }
      }
      return { message: (error && error.message) || 'Error de red', code: error && error.code }
    },

    async runPullDataset() {
      this.loadingPull = true
      this.pullConsole = ''
      this.pullConsoleError = ''
      try {
        const res = await axios.get('/chronometer/netsuite/pull-dataset-dry-run?sample=10', { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.pullConsole = JSON.stringify({ ok: true, response: res.data }, null, 2)
      } catch (error) {
        const payload = this.netsuiteAxiosErrorPayload(error)
        this.pullConsoleError = payload.message || 'Error en pull-dataset'
        this.pullConsole = JSON.stringify(
          { ok: false, ...payload, axios_baseURL: axios.defaults.baseURL || null },
          null,
          2
        )
      } finally {
        this.loadingPull = false
      }
    },
  }
}
</script>

<style scoped>
.ns-json {
  font-size: 12px;
  white-space: pre-wrap;
}
</style>

