<template>
  <v-container fluid fill-height class="login-bg">
    <v-layout align-center justify-center>
      <v-flex xs12 sm8 md6 lg4 xl3>

        <!-- Logo / Título -->
        <div class="text-center mb-6">
          <div class="display-1 font-weight-bold white--text">BIGNOTTI</div>
          <div class="subtitle-1 white--text opacity-70">Cronometro v2</div>
        </div>

        <v-card class="rounded-xl elevation-10">

          <!-- Selector de modo -->
          <v-tabs v-model="modo" grow color="primary" slider-color="primary">
            <v-tab class="tab-grande">
              <v-icon left>mdi-account-hard-hat</v-icon>
              Operario
            </v-tab>
            <v-tab class="tab-grande">
              <v-icon left>mdi-shield-account</v-icon>
              Administrador
            </v-tab>
          </v-tabs>

          <v-tabs-items v-model="modo">

            <!-- ======================== -->
            <!-- MODO OPERARIO            -->
            <!-- ======================== -->
            <v-tab-item>
              <v-card-text class="pa-4">

                <!-- PASO 1: Seleccionar nombre -->
                <div v-if="!operarioSeleccionado">
                  <div class="text-subtitle-1 font-weight-bold text-center mb-3 grey--text text--darken-2">
                    Tocá tu nombre
                  </div>
                  <div v-if="cargandoOperarios" class="text-center py-4">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                  </div>
                  <template v-else>
                    <v-alert v-if="errorOperarios" type="error" dense rounded class="mb-3">
                      {{ errorOperarios }}
                    </v-alert>
                    <div v-else-if="operarios.length === 0" class="text-center grey--text py-4">
                      No hay operarios registrados
                    </div>
                    <div v-else class="lista-operarios">
                      <v-btn
                        v-for="op in operarios"
                        :key="op.username"
                        @click="seleccionarOperario(op)"
                        block
                        x-large
                        class="nombre-btn mb-2"
                        color="blue darken-4"
                        dark
                        elevation="2"
                      >
                        <span class="nombre-texto">{{ op.name }} {{ op.lastname }}</span>
                      </v-btn>
                    </div>
                  </template>
                </div>

                <!-- PASO 2: Ingresar PIN -->
                <div v-else>
                  <div class="d-flex align-center mb-4">
                    <v-btn icon @click="operarioSeleccionado = null; pin = ''" color="grey">
                      <v-icon>mdi-arrow-left</v-icon>
                    </v-btn>
                    <div class="ml-2">
                      <div class="text-subtitle-2 grey--text">Operario</div>
                      <div class="text-h6 font-weight-bold">{{ operarioSeleccionado.name }} {{ operarioSeleccionado.lastname }}</div>
                    </div>
                  </div>

                  <!-- Display del PIN -->
                  <div class="pin-display mb-4">
                    <span
                      v-for="i in 4"
                      :key="i"
                      class="pin-punto"
                      :class="{ 'pin-punto--activo': i <= pin.length }"
                    >●</span>
                  </div>

                  <!-- Teclado numérico -->
                  <v-row no-gutters class="pin-teclado">
                    <v-col cols="4" v-for="(num, idx) in teclado" :key="idx">
                      <v-btn
                        v-if="num !== null"
                        @click="presionarTecla(num)"
                        x-large
                        block
                        class="tecla ma-1"
                        :color="num === '⌫' ? 'error' : 'grey lighten-3'"
                        :elevation="2"
                        :loading="cargando && num !== '⌫'"
                      >
                        <span class="tecla-texto">{{ num }}</span>
                      </v-btn>
                      <div v-else class="ma-1" style="height: 60px;"></div>
                    </v-col>
                  </v-row>

                  <v-alert v-if="error.status" type="error" dense rounded class="mt-4">
                    {{ error.message }}
                  </v-alert>
                </div>

              </v-card-text>
            </v-tab-item>

            <!-- ======================== -->
            <!-- MODO ADMINISTRADOR       -->
            <!-- ======================== -->
            <v-tab-item>
              <v-card-text class="pa-6">
                <v-text-field
                  v-model="username"
                  label="Usuario"
                  outlined
                  rounded
                  prepend-inner-icon="mdi-account"
                  class="mb-3"
                  hide-details
                  @keyup.enter="$refs.passwordField.focus()"
                ></v-text-field>

                <v-text-field
                  v-model="password"
                  label="Contraseña"
                  :type="mostrarPassword ? 'text' : 'password'"
                  outlined
                  rounded
                  prepend-inner-icon="mdi-lock"
                  :append-icon="mostrarPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  @click:append="mostrarPassword = !mostrarPassword"
                  hide-details
                  ref="passwordField"
                  @keyup.enter="ingresar"
                ></v-text-field>

                <v-alert v-if="error.status && modo === 1" type="error" dense rounded class="mt-4">
                  {{ error.message }}
                </v-alert>
              </v-card-text>

              <v-card-actions class="px-6 pb-6">
                <v-btn
                  @click="ingresar"
                  color="primary"
                  x-large
                  block
                  rounded
                  :loading="cargando"
                  elevation="2"
                >
                  <v-icon left>mdi-login</v-icon>
                  Ingresar
                </v-btn>
              </v-card-actions>
            </v-tab-item>

          </v-tabs-items>

        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import axios from 'axios'
import { mapActions } from 'vuex'

export default {
  data() {
    return {
      modo: 0,
      // Operario
      operarios: [],
      operarioSeleccionado: null,
      pin: '',
      teclado: [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'],
      cargandoOperarios: false,
      errorOperarios: '',
      // Admin
      username: '',
      password: '',
      mostrarPassword: false,
      // Compartido
      cargando: false,
      error: { status: false, message: '' }
    }
  },

  created() {
    this.cargarOperarios()
  },

  watch: {
    modo() {
      this.error = { status: false, message: '' }
      this.pin = ''
      this.operarioSeleccionado = null
    }
  },

  methods: {
    ...mapActions({ signIn: 'auth/signIn' }),

    async cargarOperarios() {
      this.cargandoOperarios = true
      this.errorOperarios = ''
      try {
        const res = await axios.get('/auth/operarios')
        this.operarios = Array.isArray(res.data) ? res.data : []
      } catch (e) {
        console.error('Error cargando operarios', e)
        const base = String(axios.defaults.baseURL || '').trim() || '(vacío)'
        const onHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
        const baseEsLocal = /localhost|127\.0\.0\.1/i.test(base)
        const msg =
          (e.response && e.response.data && (e.response.data.message || e.response.data.text)) ||
          (e.message === 'Network Error'
            ? onHttps && baseEsLocal
              ? `Sin respuesta del API. El sitio es HTTPS (${window.location.host}) pero axios usa baseURL "${base}" (localhost). El build del front debe incluir VUE_APP_API_URL=https://reloj-api.at-once.cl/ — reconstruí/redeploy el contenedor front (Dockerfile ARG).`
              : `Sin respuesta del API (Network Error). baseURL axios: "${base}". Revisá F12 → Red: la petición a /auth/operarios, que el API esté arriba y la URL sea la del servidor (no localhost en producción).`
            : null) ||
          'No se pudo cargar la lista de operarios.'
        this.errorOperarios = msg
        this.operarios = []
      } finally {
        this.cargandoOperarios = false
      }
    },

    seleccionarOperario(op) {
      this.operarioSeleccionado = op
      this.pin = ''
      this.error = { status: false, message: '' }
    },

    presionarTecla(tecla) {
      if (this.cargando) return
      this.error = { status: false, message: '' }
      if (tecla === '⌫') {
        this.pin = this.pin.slice(0, -1)
        return
      }
      if (this.pin.length >= 4) return
      this.pin += String(tecla)

      if (this.pin.length === 4) {
        this.ingresarOperario()
      }
    },

    async ingresarOperario() {
      this.cargando = true
      try {
        await this.signIn({ username: this.operarioSeleccionado.username, password: this.pin })
        this.$router.push('/')
      } catch {
        this.error = { status: true, message: 'PIN incorrecto. Intentá de nuevo.' }
        this.pin = ''
      } finally {
        this.cargando = false
      }
    },

    async ingresar() {
      if (!this.username || !this.password) {
        this.error = { status: true, message: 'Completá usuario y contraseña.' }
        return
      }
      this.cargando = true
      try {
        await this.signIn({ username: this.username, password: this.password })
        this.$router.push('/')
      } catch {
        this.error = { status: true, message: 'Usuario o contraseña incorrectos.' }
      } finally {
        this.cargando = false
      }
    }
  }
}
</script>

<style scoped>
.login-bg {
  background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #1565c0 100%);
  min-height: 100vh;
}

.tab-grande {
  font-size: 1rem !important;
  font-weight: 600;
  min-height: 56px;
}

.lista-operarios {
  max-height: 380px;
  overflow-y: auto;
}

.nombre-btn {
  border-radius: 12px !important;
  height: 60px !important;
}

.nombre-texto {
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.pin-display {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.pin-punto {
  font-size: 2.5rem;
  color: #e0e0e0;
  transition: color 0.15s;
}

.pin-punto--activo {
  color: #1a237e;
}

.pin-teclado {
  max-width: 320px;
  margin: 0 auto;
}

.tecla {
  min-height: 64px !important;
  border-radius: 12px !important;
}

.tecla-texto {
  font-size: 1.5rem;
  font-weight: 600;
}
</style>
