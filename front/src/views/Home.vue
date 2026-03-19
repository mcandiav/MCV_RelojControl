<template>
  <v-app>
    <appbar />
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="text-h6 font-weight-bold mb-2">Cronometro v2</div>
            <div v-if="user" class="subtitle-2">
              Usuario: {{ user.name }} {{ user.lastname }} |
              Rol: {{ user.Role && user.Role.name }} |
              Area: {{ user.Workplace && user.Workplace.name }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" md="6">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Buscar OT</div>
            <v-text-field
              v-model.trim="otNumber"
              label="Numero de OT"
              outlined
              dense
              @keyup.enter="buscarOperaciones"
            />
            <v-btn color="primary" :loading="loadingOps" @click="buscarOperaciones">
              Buscar operaciones
            </v-btn>
          </v-card>
        </v-col>

        <v-col cols="12" md="6" v-if="isAdmin">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Acciones admin de prueba</div>
            <v-btn class="mr-2 mb-2" color="secondary" :loading="loadingSeed" @click="seedWip">
              Seed WIP sample
            </v-btn>
            <v-btn class="mb-2" color="error" :loading="loadingShiftClose" @click="cerrarTurno">
              Ejecutar cierre de turno
            </v-btn>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Operaciones por OT</div>
            <v-alert v-if="errorOps" type="error" dense class="mb-3">{{ errorOps }}</v-alert>
            <v-simple-table v-if="operations.length > 0">
              <thead>
                <tr>
                  <th>OT</th>
                  <th>Secuencia</th>
                  <th>Operacion</th>
                  <th>Recurso</th>
                  <th>Area</th>
                  <th>Accion</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="op in operations" :key="op.id">
                  <td>{{ op.ot_number }}</td>
                  <td>{{ op.operation_sequence }}</td>
                  <td>{{ op.operation_name }}</td>
                  <td>{{ op.resource_code }}</td>
                  <td>{{ op.area }}</td>
                  <td>
                    <v-btn x-small color="success" @click="timerAction('start', op.id)">Start</v-btn>
                    <v-btn x-small class="ml-1" color="warning" @click="timerAction('pause', op.id)">Pause</v-btn>
                    <v-btn x-small class="ml-1" color="info" @click="timerAction('resume', op.id)">Resume</v-btn>
                    <v-btn x-small class="ml-1" color="error" @click="timerAction('stop', op.id)">Stop</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-simple-table>
            <div v-else class="grey--text">Sin operaciones cargadas.</div>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="text-subtitle-1 font-weight-bold mb-3">Tablero de cronometros activos</div>
            <v-alert v-if="errorBoard" type="error" dense class="mb-3">{{ errorBoard }}</v-alert>
            <v-simple-table v-if="activeBoard.length > 0">
              <thead>
                <tr>
                  <th>OT</th>
                  <th>Operacion</th>
                  <th>Recurso</th>
                  <th>Area</th>
                  <th>Estado</th>
                  <th>Operario</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in activeBoard" :key="row.id">
                  <td>{{ row.WorkOrderOperation && row.WorkOrderOperation.ot_number }}</td>
                  <td>{{ row.WorkOrderOperation && row.WorkOrderOperation.operation_name }}</td>
                  <td>{{ row.resource_code }}</td>
                  <td>{{ row.WorkOrderOperation && row.WorkOrderOperation.area }}</td>
                  <td>{{ row.status }}</td>
                  <td>{{ row.User ? (row.User.name + ' ' + row.User.lastname) : '-' }}</td>
                </tr>
              </tbody>
            </v-simple-table>
            <div v-else class="grey--text">No hay cronometros activos.</div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>

<script>
import axios from 'axios'
import '@mdi/font/css/materialdesignicons.css'
import appbar from '@/components/navegation/appbar.vue'
import { mapGetters } from 'vuex'

export default {
  name: 'Home',
  components: { appbar },
  data() {
    return {
      otNumber: '',
      operations: [],
      activeBoard: [],
      loadingOps: false,
      loadingSeed: false,
      loadingShiftClose: false,
      errorOps: '',
      errorBoard: ''
    }
  },
  created() {
    this.refreshBoard()
  },
  methods: {
    async buscarOperaciones() {
      this.errorOps = ''
      this.operations = []
      if (!this.otNumber) {
        this.errorOps = 'Ingresa un numero de OT.'
        return
      }
      this.loadingOps = true
      try {
        const res = await axios.get(`/chronometer/operations/${encodeURIComponent(this.otNumber)}`)
        this.operations = res.data.operations || []
      } catch (error) {
        this.errorOps = (error.response && error.response.data && error.response.data.message) || 'No fue posible buscar operaciones.'
      } finally {
        this.loadingOps = false
      }
    },
    async refreshBoard() {
      this.errorBoard = ''
      try {
        const res = await axios.get('/chronometer/board/active')
        this.activeBoard = Array.isArray(res.data) ? res.data : []
      } catch (error) {
        this.errorBoard = (error.response && error.response.data && error.response.data.message) || 'No fue posible cargar el tablero.'
      }
    },
    async timerAction(action, operationId) {
      try {
        await axios.post(`/chronometer/timers/${action}`, { work_order_operation_id: operationId })
        await this.refreshBoard()
      } catch (error) {
        const msg = (error.response && error.response.data && (error.response.data.message || error.response.data.text)) || `No fue posible ejecutar ${action}.`
        alert(msg)
      }
    },
    async seedWip() {
      this.loadingSeed = true
      try {
        await axios.post('/chronometer/wip/seed-sample')
        alert('Seed WIP ejecutado.')
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || 'Error al ejecutar seed.'
        alert(msg)
      } finally {
        this.loadingSeed = false
      }
    },
    async cerrarTurno() {
      this.loadingShiftClose = true
      try {
        await axios.post('/chronometer/shift/close')
        await this.refreshBoard()
        alert('Cierre de turno ejecutado.')
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || 'Error al cerrar turno.'
        alert(msg)
      } finally {
        this.loadingShiftClose = false
      }
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user',
      isAdmin: 'auth/isAdmin'
    })
  }
}
</script>