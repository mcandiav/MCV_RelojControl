<template>
  <v-app>
    <!-- Tablero tipo protector: 4 cuadrantes (inactividad o prueba manual). Clic para cerrar. -->
    <transition name="fade">
      <div
        v-if="showIdleBoard"
        class="idle-board-overlay"
        role="dialog"
        aria-modal="true"
        @click="closeIdleBoard"
      >
        <div class="idle-board-grid">
        <div
          v-for="(cell, idx) in idleQuadrants"
          :key="'q-' + idx"
          class="idle-quadrant"
          :class="{
            'idle-quadrant--empty': !cell,
            'idle-quadrant--active': cell && cell.status === 'ACTIVE',
            'idle-quadrant--paused': cell && cell.status === 'PAUSED'
          }"
        >
          <template v-if="cell">
            <div class="status-pill" :class="cell.status === 'ACTIVE' ? 'pill-run' : 'pill-pause'">
              {{ cell.status === 'ACTIVE' ? 'EN CURSO' : 'PAUSA' }}
            </div>
            <div class="timer-big">{{ formatElapsed(cell) }}</div>
            <div class="ot-big">{{ cell.WorkOrderOperation && cell.WorkOrderOperation.ot_number }}</div>
            <div class="meta">
              {{ cell.User ? (cell.User.name + ' ' + cell.User.lastname) : '—' }}
            </div>
            <div class="meta resource-line">{{ cell.resource_code }}</div>
          </template>
          <template v-else>
            <div class="empty-label">Sin cronómetro</div>
            <div class="meta">Cuadrante {{ idx + 1 }}</div>
          </template>
        </div>
        </div>
        <div class="idle-board-footer">
          Toca en cualquier lugar para volver · Actualiza cada {{ boardPollSeconds }}s mientras está abierto
        </div>
      </div>
    </transition>

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
              hide-details
                />
            <div class="grey--text text-caption mt-2">Busqueda automatica al escribir el numero.</div>
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
                <v-alert v-if="lastSeedResponse" type="info" dense outlined class="mt-3 mb-0 seed-debug-alert">
                  <div class="font-weight-bold mb-1">Respuesta del servidor (ultimo Seed)</div>
                  <pre class="seed-json text-left">{{ lastSeedResponse }}</pre>
                  <div class="text-caption mt-2">
                    Codigo nuevo: <code>total</code> debe ser <strong>10</strong> y <code>ot_numbers</code> debe incluir <strong>OT4444</strong>.
                    Si ves <code>total: 6</code> sin OT4444, el contenedor del <strong>backend</strong> sigue con imagen antigua (rebuild/redeploy API).
                  </div>
                </v-alert>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-3">Operaciones por OT</div>
                <v-alert v-if="errorOps" type="error" dense class="mb-3">{{ errorOps }}</v-alert>
                <v-alert v-if="!errorOps && emptyOpsHint" type="info" dense class="mb-3">{{ emptyOpsHint }}</v-alert>
            <v-simple-table v-if="operations.length > 0" class="compact-table">
                  <thead>
                    <tr>
                      <th>Operacion</th>
                      <th>Recurso</th>
                  <th>OT</th>
                  <th>Secuencia</th>
                  <th>Estado</th>
                  <th>Tiempo planificado montaje (min)</th>
                  <th>Tiempo en uso</th>
                  <th>Tiempo planificado ejecucion (min)</th>
                  <th>Tiempo en uso</th>
                  <th>Cantidad planificada</th>
                  <th>Cantidad</th>
                      <th>Area</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="op in operations" :key="op.id">
                      <td>{{ op.operation_name }}</td>
                      <td>{{ op.resource_code }}</td>
                  <td>{{ op.ot_number }}</td>
                  <td>{{ op.operation_sequence }}</td>
                  <td>{{ op.status || 'STOPPED' }}</td>
                  <td>{{ op.planned_setup_minutes != null ? op.planned_setup_minutes : '-' }}</td>
                  <td>{{ formatElapsedFromSeconds(op.elapsed_seconds || 0) }}</td>
                  <td>{{ op.planned_operation_minutes != null ? op.planned_operation_minutes : '-' }}</td>
                  <td>{{ formatElapsedFromSeconds(op.elapsed_seconds || 0) }}</td>
                  <td>{{ op.planned_quantity != null ? op.planned_quantity : '-' }}</td>
                  <td>{{ op.completed_quantity != null ? op.completed_quantity : '-' }}</td>
                  <td>{{ op.area }}</td>
                  <td class="actions-cell">
                    <div class="action-buttons">
                      <v-btn x-small color="success" @click="timerAction('start', op.id)">Play</v-btn>
                      <v-btn x-small color="warning" @click="timerAction('pause', op.id)">Pausa</v-btn>
                      <v-btn x-small color="error" @click="timerAction('stop', op.id)">Stop</v-btn>
                    <template v-if="isAdmin">
                      <v-btn x-small color="error" @click="borrarOperacion(op.id)">Borrar</v-btn>
                    </template>
                    </div>
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
                <div class="d-flex flex-wrap align-center justify-space-between mb-2">
                  <div class="text-subtitle-1 font-weight-bold">Tablero de cronometros activos</div>
                  <div class="d-flex flex-wrap align-center" style="gap: 8px">
                    <span class="grey--text text-caption">Protector 4 cuadrantes tras {{ idleBoardMinutes }} min sin actividad (solo si hay timers).</span>
                    <v-btn small outlined color="primary" @click="openIdleBoardPreview">Ver tablero grande</v-btn>
                  </div>
                </div>
                <v-alert v-if="errorBoard" type="error" dense class="mb-3">{{ errorBoard }}</v-alert>
            <v-simple-table v-if="activeBoard.length > 0" class="compact-table">
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
      emptyOpsHint: '',
      errorBoard: '',
      users: [],
      roles: [],
      workplaces: [],
      nowTick: Date.now(),
      clockInterval: null,
      uploadFilename: 'ResultadosZIMDataRelojControlDefaultView285.xls',
      searchTimeout: null,
      newUser: {
        name: '',
        lastname: '',
        username: '',
        password: '',
        RoleId: null,
        WorkplaceId: null
      },
      showIdleBoard: false,
      idleBoardMinutes: Number(process.env.VUE_APP_IDLE_BOARD_MINUTES || 2),
      boardPollSeconds: Number(process.env.VUE_APP_IDLE_BOARD_POLL_SEC || 15),
      idleOpenTimerHandle: null,
      boardPollIntervalHandle: null,
      lastIdleMouseMoveAt: 0,
      lastSeedResponse: ''
    }
  },
  created() {
    this.refreshBoard()
    if (this.isAdmin) this.loadAdminCatalogs()
    this.clockInterval = setInterval(() => { this.nowTick = Date.now() }, 1000)
  },
  mounted() {
    if (this.idleBoardEnabled) {
      window.addEventListener('keydown', this.scheduleIdleOpen)
      window.addEventListener('touchstart', this.scheduleIdleOpen, { passive: true })
      window.addEventListener('mousemove', this.onMouseMoveForIdle, { passive: true })
      this.scheduleIdleOpen()
    }
  },
  beforeDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval)
    if (this.searchTimeout) clearTimeout(this.searchTimeout)
    window.removeEventListener('keydown', this.scheduleIdleOpen)
    window.removeEventListener('touchstart', this.scheduleIdleOpen)
    window.removeEventListener('mousemove', this.onMouseMoveForIdle)
    clearTimeout(this.idleOpenTimerHandle)
    this.stopBoardPollWhileOpen()
  },
  watch: {
    otNumber(value) {
      if (this.searchTimeout) clearTimeout(this.searchTimeout)
      const digits = String(value || '').replace(/[^0-9]/g, '')
      if (!digits) {
        this.operations = []
        this.errorOps = ''
        this.emptyOpsHint = ''
        return
      }
      this.searchTimeout = setTimeout(() => {
        this.buscarOperaciones()
      }, 300)
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user',
      isAdmin: 'auth/isAdmin'
    }),
    idleBoardEnabled() {
      return String(process.env.VUE_APP_IDLE_BOARD_ENABLED || 'true').toLowerCase() !== 'false'
    },
    idleMs() {
      return Math.max(1, this.idleBoardMinutes) * 60 * 1000
    },
    idleQuadrants() {
      const rows = this.activeBoard.filter((r) => r.status === 'ACTIVE' || r.status === 'PAUSED')
      const sorted = [...rows].sort((a, b) => String(a.resource_code || '').localeCompare(String(b.resource_code || '')))
      const q = sorted.slice(0, 4)
      while (q.length < 4) q.push(null)
      return q
    }
  },
  methods: {
    onMouseMoveForIdle() {
      if (!this.idleBoardEnabled || this.showIdleBoard) return
      const now = Date.now()
      if (now - this.lastIdleMouseMoveAt < 800) return
      this.lastIdleMouseMoveAt = now
      this.scheduleIdleOpen()
    },
    scheduleIdleOpen() {
      if (!this.idleBoardEnabled) return
      clearTimeout(this.idleOpenTimerHandle)
      if (this.showIdleBoard) return
      this.idleOpenTimerHandle = setTimeout(() => {
        const has = this.activeBoard.some((r) => r.status === 'ACTIVE' || r.status === 'PAUSED')
        if (has) {
          this.showIdleBoard = true
          this.startBoardPollWhileOpen()
        }
      }, this.idleMs)
    },
    startBoardPollWhileOpen() {
      this.stopBoardPollWhileOpen()
      const ms = Math.max(5, this.boardPollSeconds) * 1000
      this.boardPollIntervalHandle = setInterval(() => {
        this.refreshBoard()
      }, ms)
    },
    stopBoardPollWhileOpen() {
      if (this.boardPollIntervalHandle) {
        clearInterval(this.boardPollIntervalHandle)
        this.boardPollIntervalHandle = null
      }
    },
    closeIdleBoard() {
      this.showIdleBoard = false
      this.stopBoardPollWhileOpen()
      if (this.idleBoardEnabled) this.scheduleIdleOpen()
    },
    openIdleBoardPreview() {
      this.showIdleBoard = true
      this.refreshBoard()
      this.startBoardPollWhileOpen()
    },
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
    formatElapsedFromSeconds(totalSeconds) {
      const total = Math.max(0, Number(totalSeconds || 0))
      const hrs = Math.floor(total / 3600)
      const mins = Math.floor((total % 3600) / 60)
      const secs = total % 60
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    },
    async borrarOperacion(id) {
      if (!confirm('¿Borrar operación?')) return
      try {
        await axios.delete(`/chronometer/operations/${id}`)
        this.operations = this.operations.filter((item) => item.id !== id)
        this.refreshBoard()
      } catch (error) {
        alert('No fue posible borrar la operación.')
      }
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
      this.emptyOpsHint = ''
      this.operations = []
      const normalized = String(this.otNumber || '').replace(/[^0-9]/g, '')
      if (!normalized) {
        this.errorOps = 'Ingresa un numero de OT.'
        return
      }
      this.loadingOps = true
      try {
        const res = await axios.get(`/chronometer/operations/${encodeURIComponent(normalized)}`)
        this.operations = res.data.operations || []
        if (this.operations.length === 0) {
          this.emptyOpsHint =
            'No hay operaciones para esta OT en tu area o la OT no esta cargada. Con datos de prueba: Seed WIP y prueba 4444 (4 maquinas), 3289, 3491 o 2316.'
        }
      } catch (error) {
        const d = error.response && error.response.data
        let msg = 'No fue posible buscar operaciones.'
        if (typeof d === 'string') msg = d
        else if (d && typeof d.message === 'string') msg = d.message
        this.errorOps = msg
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
      this.lastSeedResponse = ''
      try {
        const res = await axios.post('/chronometer/wip/seed-sample')
        this.lastSeedResponse = JSON.stringify(res.data, null, 2)
        const ots = res.data && res.data.ot_numbers ? res.data.ot_numbers.join(', ') : ''
        const n = res.data && res.data.total != null ? res.data.total : '?'
        alert(`Seed WIP OK. Filas: ${n}. OTs: ${ots || '(sin ot_numbers en respuesta — backend viejo)'}`)
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
  }
}
</script>

<style scoped>
.compact-table table th,
.compact-table table td {
  font-size: 12px !important;
  white-space: nowrap;
  padding: 6px 8px !important;
}

.actions-cell {
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  align-items: center;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.idle-board-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #0d1117;
  color: #e6edf3;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  user-select: none;
}

.idle-board-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 8px;
  padding: 8px;
}

.idle-quadrant {
  border-radius: 12px;
  border: 3px solid #30363d;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 12px;
  overflow: hidden;
  background: #161b22;
}

.idle-quadrant--empty {
  opacity: 0.55;
  border-style: dashed;
}

.idle-quadrant--active {
  border-color: #238636;
  box-shadow: 0 0 0 2px rgba(35, 134, 54, 0.35);
}

.idle-quadrant--paused {
  border-color: #bb8009;
  box-shadow: 0 0 0 2px rgba(187, 128, 9, 0.35);
}

.status-pill {
  font-size: clamp(0.75rem, 2vw, 1.1rem);
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
  padding: 4px 14px;
  border-radius: 999px;
}

.pill-run {
  background: #238636;
  color: #fff;
}

.pill-pause {
  background: #bb8009;
  color: #0d1117;
}

.timer-big {
  font-size: clamp(2.8rem, 11vw, 7.5rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin: 8px 0;
}

.ot-big {
  font-size: clamp(1.6rem, 5.5vw, 3.8rem);
  font-weight: 700;
  color: #58a6ff;
  line-height: 1.1;
  margin-bottom: 6px;
}

.meta {
  font-size: clamp(0.95rem, 2.2vw, 1.35rem);
  color: #8b949e;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-line {
  margin-top: 4px;
  font-size: clamp(0.85rem, 2vw, 1.2rem);
}

.empty-label {
  font-size: clamp(1.2rem, 3vw, 2rem);
  color: #484f58;
  font-weight: 600;
}

.idle-board-footer {
  flex-shrink: 0;
  text-align: center;
  padding: 10px 12px;
  font-size: 0.85rem;
  color: #6e7681;
  background: #010409;
}

.seed-json {
  font-size: 11px;
  line-height: 1.35;
  max-height: 220px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>