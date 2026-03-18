<template>
  <v-container fluid fill-height class="login-bg">
    <v-layout align-center justify-center>
      <v-flex xs12 sm8 md6 lg4 xl3>

        <!-- Logo / Título -->
        <div class="text-center mb-6">
          <div class="display-1 font-weight-bold white--text">BIGNOTTI</div>
          <div class="subtitle-1 white--text opacity-70">Sistema de Control de Tiempos</div>
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
              <v-card-text class="pa-6">
                <div class="mb-5">
                  <v-select
                    v-model="operarioSeleccionado"
                    :items="operarios"
                    item-text="nombreCompleto"
                    item-value="username"
                    label="¿Quién sos?"
                    outlined
                    rounded
                    hide-details
                    :loading="cargandoOperarios"
                    no-data-text="No hay operarios disponibles"
                    class="select-grande"
                  ></v-select>
                </div>

                <!-- Display del PIN -->
                <div class="pin-display mb-4">
                  <span
                    v-for="i in 6"
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
                    >
                      <span class="tecla-texto">{{ num }}</span>
                    </v-btn>
                    <div v-else class="ma-1" style="height: 60px;"></div>
                  </v-col>
                </v-row>

                <v-alert v-if="error.status && modo === 0" type="error" dense rounded class="mt-4">
                  {{ error.message }}
                </v-alert>
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
    }
  },

  methods: {
    ...mapActions({ signIn: 'auth/signIn' }),

    async cargarOperarios() {
      this.cargandoOperarios = true
      try {
        const res = await axios.get('/auth/operarios')
        this.operarios = res.data.map(u => ({
          ...u,
          nombreCompleto: `${u.name} ${u.lastname}`
        }))
      } catch (e) {
        console.error('Error cargando operarios', e)
      } finally {
        this.cargandoOperarios = false
      }
    },

    presionarTecla(tecla) {
      this.error = { status: false, message: '' }
      if (tecla === '⌫') {
        this.pin = this.pin.slice(0, -1)
        return
      }
      if (this.pin.length >= 6) return
      this.pin += String(tecla)

      if (this.pin.length === 6) {
        this.ingresarOperario()
      }
    },

    async ingresarOperario() {
      if (!this.operarioSeleccionado) {
        this.error = { status: true, message: 'Seleccioná tu nombre primero.' }
        this.pin = ''
        return
      }
      this.cargando = true
      try {
        await this.signIn({ username: this.operarioSeleccionado, password: this.pin })
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

.select-grande >>> .v-input__slot {
  min-height: 64px !important;
  font-size: 1.2rem;
}

.pin-display {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.pin-punto {
  font-size: 2rem;
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
