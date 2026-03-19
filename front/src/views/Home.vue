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

      <v-tabs v-model="activeTab" background-color="transparent" class="mb-4">
        <v-tab>Operación</v-tab>
        <v-tab v-if="isAdmin">Usuarios</v-tab>
      </v-tabs>

      <v-tabs-items v-model="activeTab" class="transparent">
        <v-tab-item>
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
                <v-text-field
                  v-model.trim="uploadFilename"
                  label="Archivo en uploads (ej: Resultados...xls)"
                  dense
                  outlined
                  class="mb-2"
                />
                <v-btn class="mr-2 mb-2" color="secondary" :loading="loadingImportUpload" @click="importarDesdeUpload">
                  Importar upload
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
                  <th>Planificado (min)</th>
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
                  <td>{{ op.planned_operation_minutes != null ? op.planned_operation_minutes : '-' }}</td>
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
                      <th>Planificado (min)</th>
                      <th>Transcurrido</th>
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
                      <td>{{ row.WorkOrderOperation && row.WorkOrderOperation.planned_operation_minutes != null ? row.WorkOrderOperation.planned_operation_minutes : '-' }}</td>
                      <td>{{ formatElapsed(row) }}</td>
                      <td>{{ row.status }}</td>
                      <td>{{ row.User ? (row.User.name + ' ' + row.User.lastname) : '-' }}</td>
                    </tr>
                  </tbody>
                </v-simple-table>
                <div v-else class="grey--text">No hay cronometros activos.</div>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>

        <v-tab-item v-if="isAdmin">
          <v-row>
            <v-col cols="12" md="4">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-3">Nuevo usuario</div>
                <v-text-field v-model.trim="newUser.name" label="Nombre" dense outlined />
                <v-text-field v-model.trim="newUser.lastname" label="Apellido" dense outlined />
                <v-text-field v-model.trim="newUser.username" label="Usuario" dense outlined />
                <v-text-field v-model="newUser.password" label="Password / PIN" dense outlined type="password" />
                <v-select v-model="newUser.RoleId" :items="roles" item-text="name" item-value="id" label="Rol" dense outlined />
                <v-select v-model="newUser.WorkplaceId" :items="workplaces" item-text="name" item-value="id" label="Area" dense outlined />
                <v-btn color="primary" :loading="loadingCreateUser" @click="crearUsuario">Crear usuario</v-btn>
              </v-card>
            </v-col>
            <v-col cols="12" md="8">
              <v-card outlined class="pa-4">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="text-subtitle-1 font-weight-bold">Usuarios</div>
                  <v-btn small color="secondary" @click="loadAdminCatalogs">Actualizar</v-btn>
                </div>
                <v-simple-table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Area</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="u in users" :key="u.id">
                      <td>{{ u.name }} {{ u.lastname }}</td>
                      <td>{{ u.username }}</td>
                      <td>{{ u.Role && u.Role.name }}</td>
                      <td>{{ u.Workplace && u.Workplace.name }}</td>
                      <td><v-btn x-small color="error" @click="eliminarUsuario(u.id)">Eliminar</v-btn></td>
                    </tr>
                  </tbody>
                </v-simple-table>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>
      </v-tabs-items>
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
      activeTab: 0,
      operations: [],
      activeBoard: [],
      loadingOps: false,
      loadingSeed: false,
      loadingImportUpload: false,
      loadingShiftClose: false,
      loadingCreateUser: false,
      errorOps: '',
      errorBoard: '',
      users: [],
      roles: [],
      workplaces: [],
      nowTick: Date.now(),
      clockInterval: null,
      uploadFilename: 'ResultadosZIMDataRelojControlDefaultView285.xls',
      newUser: {
        name: '',
        lastname: '',
        username: '',
        password: '',
        RoleId: null,
        WorkplaceId: null
      }
    }
  },
  created() {
    this.refreshBoard()
    if (this.isAdmin) this.loadAdminCatalogs()
    this.clockInterval = setInterval(() => { this.nowTick = Date.now() }, 1000)
  },
  beforeDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval)
  },
  methods: {
    formatElapsed(row) {
      const persisted = Number(row.total_elapsed_seconds || 0)
      let extra = 0
      if (row.status === 'ACTIVE' && row.active_since) {
        const since = new Date(row.active_since).getTime()
        if (Number.isFinite(since)) extra = Math.max(0, Math.floor((this.nowTick - since) / 1000))
      }
      const total = Math.max(0, persisted + extra)
      const hrs = Math.floor(total / 3600)
      const mins = Math.floor((total % 3600) / 60)
      const secs = total % 60
      const hh = String(hrs).padStart(2, '0')
      const mm = String(mins).padStart(2, '0')
      const ss = String(secs).padStart(2, '0')
      return `${hh}:${mm}:${ss}`
    },
    async loadAdminCatalogs() {
      try {
        const [users, roles, workplaces] = await Promise.all([
          axios.get('/auth/users'),
          axios.get('/auth/roles'),
          axios.get('/auth/workplaces')
        ])
        this.users = users.data || []
        this.roles = roles.data || []
        this.workplaces = workplaces.data || []
        if (!this.newUser.RoleId && this.roles.length > 0) this.newUser.RoleId = this.roles[0].id
        if (!this.newUser.WorkplaceId && this.workplaces.length > 0) this.newUser.WorkplaceId = this.workplaces[0].id
      } catch (error) {
        alert('No fue posible cargar catalogos de usuarios.')
      }
    },
    async crearUsuario() {
      if (!this.newUser.name || !this.newUser.lastname || !this.newUser.username || !this.newUser.password || !this.newUser.RoleId || !this.newUser.WorkplaceId) {
        alert('Completa todos los campos del usuario.')
        return
      }
      this.loadingCreateUser = true
      try {
        await axios.post('/auth/signup', this.newUser)
        this.newUser = { name: '', lastname: '', username: '', password: '', RoleId: this.newUser.RoleId, WorkplaceId: this.newUser.WorkplaceId }
        await this.loadAdminCatalogs()
        alert('Usuario creado.')
      } catch (error) {
        alert('No fue posible crear el usuario.')
      } finally {
        this.loadingCreateUser = false
      }
    },
    async eliminarUsuario(id) {
      if (!confirm('¿Eliminar usuario?')) return
      try {
        await axios.delete(`/auth/users/${id}`)
        await this.loadAdminCatalogs()
      } catch (error) {
        alert('No fue posible eliminar el usuario.')
      }
    },
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
    async importarDesdeUpload() {
      if (!this.uploadFilename) {
        alert('Debes ingresar el nombre del archivo en uploads.')
        return
      }
      this.loadingImportUpload = true
      try {
        const res = await axios.post('/chronometer/wip/import-upload', { filename: this.uploadFilename })
        alert(`Importacion OK. Filas: ${res.data.total_rows}, Operaciones: ${res.data.imported_operations}`)
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || 'No fue posible importar upload.'
        alert(msg)
      } finally {
        this.loadingImportUpload = false
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