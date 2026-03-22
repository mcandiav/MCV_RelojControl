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
            <div class="q-time">{{ formatElapsed(cell) }}</div>
            <div class="q-ot">{{ quadrantOtNumber(cell) }}</div>
            <div class="q-op-block">
              <span class="q-field-label">Operación</span>
              <span class="q-op-text">{{ quadrantOperationText(cell) }}</span>
            </div>
            <div class="q-res">{{ cell.resource_code }}</div>
            <div class="q-user">{{ cell.User ? (cell.User.name + ' ' + cell.User.lastname) : '—' }}</div>
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
              Area: {{ user.Workplace && user.Workplace.name }} |
              Estacion: <strong>{{ stationDisplayLabel }}</strong>
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
            <div class="grey--text text-caption mt-1">Play / Pausa / Stop piden PIN (pantalla compartida).</div>
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
                    Tras Seed WIP: <code>total</code> debe ser <strong>52</strong> y <code>ot_numbers</code> debe listar <strong>OT1111</strong> … <strong>OT9999</strong> (9 OTs).
                    Si el total es distinto, el contenedor del <strong>backend</strong> sigue con imagen antigua (rebuild/redeploy API).
                  </div>
                </v-alert>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">Filtrar por estado del cronometro</div>
                <p class="grey--text text-caption mb-2">
                  Aplica a la busqueda por OT y al listado de procesos del area.
                </p>
                <v-btn-toggle
                  v-model="statusFilter"
                  mandatory
                  dense
                  class="mb-3 flex-wrap status-toggle"
                >
                  <v-btn small value="ALL">Todos</v-btn>
                  <v-btn small value="ACTIVE">Ejecucion</v-btn>
                  <v-btn small value="PAUSED">Pausa</v-btn>
                  <v-btn small value="STOPPED">No iniciado / detenido</v-btn>
                </v-btn-toggle>

                <div class="text-subtitle-1 font-weight-bold mb-3">Operaciones por OT</div>
                <v-alert v-if="errorOps" type="error" dense class="mb-3">{{ errorOps }}</v-alert>
                <v-alert v-if="!errorOps && emptyOpsHint" type="info" dense class="mb-3">{{ emptyOpsHint }}</v-alert>
            <v-simple-table v-if="filteredOperations.length > 0" class="compact-table">
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
                    <tr v-for="op in filteredOperations" :key="op.id">
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
                <div v-else-if="operations.length > 0" class="grey--text">Ninguna operacion coincide con el filtro de estado.</div>
                <div v-else class="grey--text">Sin operaciones cargadas.</div>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="d-flex flex-wrap align-center justify-space-between mb-2">
                  <div class="text-subtitle-1 font-weight-bold">Listado de procesos (tu area)</div>
                  <v-btn small color="secondary" :loading="loadingProcessList" @click="loadProcessList">Actualizar listado</v-btn>
                </div>
                <v-alert v-if="errorProcessList" type="error" dense class="mb-2">{{ errorProcessList }}</v-alert>
                <v-simple-table v-if="processList.length > 0" class="compact-table">
                  <thead>
                    <tr>
                      <th>OT</th>
                      <th>Operacion</th>
                      <th>Recurso</th>
                      <th>Area</th>
                      <th>Estado</th>
                      <th>Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="op in processList" :key="'pl-' + op.id">
                      <td>{{ op.ot_number }}</td>
                      <td>{{ op.operation_name }}</td>
                      <td>{{ op.resource_code }}</td>
                      <td>{{ op.area }}</td>
                      <td>{{ statusLabel(op.status) }}</td>
                      <td>{{ formatElapsedFromSeconds(op.elapsed_seconds || 0) }}</td>
                    </tr>
                  </tbody>
                </v-simple-table>
                <div v-else class="grey--text">No hay procesos para mostrar con este filtro.</div>
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
                <v-text-field
                  v-model="newUser.password"
                  label="PIN (4 digitos)"
                  dense
                  outlined
                  type="password"
                  maxlength="4"
                  hint="Exactamente 4 digitos numericos."
                  persistent-hint
                  @input="newUser.password = sanitizePinInput(newUser.password)"
                />
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
                      <td>
                        <v-btn x-small class="mr-1" color="primary" @click="abrirEditarUsuario(u)">Editar</v-btn>
                        <v-btn x-small color="error" @click="eliminarUsuario(u.id)">Eliminar</v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-simple-table>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>
      </v-tabs-items>
    </v-container>

    <v-dialog v-model="editDialog" max-width="520" persistent>
      <v-card>
        <v-card-title class="text-h6">Editar usuario</v-card-title>
        <v-card-text>
          <v-text-field v-model.trim="editUser.name" label="Nombre" dense outlined />
          <v-text-field v-model.trim="editUser.lastname" label="Apellido" dense outlined />
          <v-text-field v-model.trim="editUser.username" label="Usuario" dense outlined />
          <v-text-field
            v-model="editUser.password"
            label="Nuevo PIN (opcional)"
            dense
            outlined
            type="password"
            maxlength="4"
            hint="Solo si quieres cambiarlo: exactamente 4 digitos."
            persistent-hint
            @input="editUser.password = sanitizePinInput(editUser.password)"
          />
          <v-select v-model="editUser.RoleId" :items="roles" item-text="name" item-value="id" label="Rol" dense outlined />
          <v-select v-model="editUser.WorkplaceId" :items="workplaces" item-text="name" item-value="id" label="Area" dense outlined />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeEditDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="loadingEditUser" @click="guardarUsuarioEditado">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showTimerPinDialog" max-width="400" persistent>
      <v-card>
        <v-card-title class="text-h6">Confirmar con PIN</v-card-title>
        <v-card-text>
          <p class="body-2 mb-2">
            Ingresa tu PIN para <strong v-if="pendingTimerAction">{{ timerActionLabel(pendingTimerAction.action) }}</strong>
            (estacion {{ stationDisplayLabel }}).
          </p>
          <v-text-field
            v-model="pinForTimer"
            label="PIN (4 digitos)"
            type="password"
            maxlength="4"
            outlined
            dense
            hide-details
            @input="pinForTimer = sanitizePinInput(pinForTimer)"
            @keyup.enter="confirmTimerPinAction"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="closeTimerPinDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="loadingTimerPin" @click="confirmTimerPinAction">Confirmar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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
      showTimerPinDialog: false,
      pinForTimer: '',
      pendingTimerAction: null,
      loadingTimerPin: false,
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
      lastSeedResponse: '',
      statusFilter: 'ALL',
      processList: [],
      loadingProcessList: false,
      errorProcessList: '',
      editDialog: false,
      editUser: {},
      loadingEditUser: false
    }
  },
  created() {
    this.refreshBoard()
    this.loadProcessList()
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
    },
    statusFilter() {
      this.loadProcessList()
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
    },
    filteredOperations() {
      const list = this.operations || []
      if (this.statusFilter === 'ALL') return list
      return list.filter((o) => (o.status || 'STOPPED') === this.statusFilter)
    },
    stationDisplayLabel() {
      return String(process.env.VUE_APP_STATION_ID || 'default-station').trim()
    }
  },
  methods: {
    timerActionLabel(action) {
      const m = { start: 'Play / iniciar', pause: 'Pausa', resume: 'Reanudar', stop: 'Stop / detener' }
      return m[action] || action
    },
    sanitizePinInput(val) {
      return String(val || '').replace(/\D/g, '').slice(0, 4)
    },
    isValidPin(p) {
      return /^\d{4}$/.test(String(p || '').trim())
    },
    statusLabel(s) {
      const m = {
        ACTIVE: 'Ejecucion',
        PAUSED: 'Pausa',
        STOPPED: 'No iniciado / detenido'
      }
      return m[s] || s || '-'
    },
    abrirEditarUsuario(u) {
      this.editUser = {
        id: u.id,
        name: u.name,
        lastname: u.lastname,
        username: u.username,
        password: '',
        RoleId: u.RoleId,
        WorkplaceId: u.WorkplaceId
      }
      this.editDialog = true
    },
    closeEditDialog() {
      this.editDialog = false
      this.editUser = {}
    },
    async guardarUsuarioEditado() {
      if (!this.editUser.id) return
      if (this.editUser.password && !this.isValidPin(this.editUser.password)) {
        alert('El PIN debe ser exactamente 4 digitos numericos.')
        return
      }
      this.loadingEditUser = true
      try {
        const body = {
          name: this.editUser.name,
          lastname: this.editUser.lastname,
          username: this.editUser.username,
          RoleId: this.editUser.RoleId,
          WorkplaceId: this.editUser.WorkplaceId
        }
        if (this.editUser.password) body.password = this.editUser.password
        await axios.put(`/auth/users/${this.editUser.id}`, body)
        await this.loadAdminCatalogs()
        this.closeEditDialog()
        alert('Usuario actualizado.')
      } catch (error) {
        const d = error.response && error.response.data
        const msg = (d && d.message) || 'No fue posible actualizar el usuario.'
        alert(msg)
      } finally {
        this.loadingEditUser = false
      }
    },
    async loadProcessList() {
      this.loadingProcessList = true
      this.errorProcessList = ''
      try {
        const res = await axios.get('/chronometer/operations', {
          params: { status: this.statusFilter }
        })
        this.processList = res.data.operations || []
      } catch (error) {
        const d = error.response && error.response.data
        this.errorProcessList = (d && d.message) || 'No fue posible cargar el listado de procesos.'
        this.processList = []
      } finally {
        this.loadingProcessList = false
      }
    },
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
    /** Incluye asociación anidada (WorkOrderOperation o serialización alternativa). */
    quadrantLinkedOp(cell) {
      if (!cell) return null
      return cell.WorkOrderOperation || cell.workOrderOperation || null
    },
    quadrantOtNumber(cell) {
      const op = this.quadrantLinkedOp(cell)
      if (op != null && op.ot_number != null && String(op.ot_number).trim() !== '') return op.ot_number
      return '—'
    },
    quadrantOperationText(cell) {
      const op = this.quadrantLinkedOp(cell)
      if (op) {
        const name = String(op.operation_name || '').trim()
        if (name) return name
        if (op.operation_sequence != null && String(op.operation_sequence).trim() !== '') {
          return `Sec. ${op.operation_sequence}`
        }
      }
      const rc = cell && String(cell.resource_code || '').trim()
      return rc || '—'
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
        await this.refreshBoard()
        await this.loadProcessList()
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
      if (!this.isValidPin(this.newUser.password)) {
        alert('El PIN debe ser exactamente 4 digitos numericos.')
        return
      }
      this.loadingCreateUser = true
      try {
        await axios.post('/auth/signup', this.newUser)
        this.newUser = { name: '', lastname: '', username: '', password: '', RoleId: this.newUser.RoleId, WorkplaceId: this.newUser.WorkplaceId }
        await this.loadAdminCatalogs()
        alert('Usuario creado.')
      } catch (error) {
        const d = error.response && error.response.data
        alert((d && d.message) || 'No fue posible crear el usuario.')
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
        await this.loadProcessList()
        if (this.operations.length === 0) {
          this.emptyOpsHint =
            'No hay operaciones para esta OT en tu area o la OT no esta cargada. Con datos de prueba: Seed WIP y busca OT 1111, 2222 … 9999 (4–8 ops ME/ES por OT).'
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
        const data = res.data
        if (Array.isArray(data)) this.activeBoard = data
        else if (data && Array.isArray(data.timers)) this.activeBoard = data.timers
        else this.activeBoard = []
      } catch (error) {
        this.errorBoard = (error.response && error.response.data && error.response.data.message) || 'No fue posible cargar el tablero.'
      }
    },
    timerAction(action, operationId) {
      if (this.isAdmin) {
        void this.runTimerRequest(action, operationId, null)
        return
      }
      this.pendingTimerAction = { action, operationId }
      this.pinForTimer = ''
      this.showTimerPinDialog = true
    },
    closeTimerPinDialog() {
      this.showTimerPinDialog = false
      this.pendingTimerAction = null
      this.pinForTimer = ''
    },
    async confirmTimerPinAction() {
      if (!this.pendingTimerAction) return
      if (!/^\d{4}$/.test(String(this.pinForTimer || '').trim())) {
        alert('Ingresa tu PIN de 4 digitos.')
        return
      }
      const { action, operationId } = this.pendingTimerAction
      const pin = String(this.pinForTimer).trim()
      this.loadingTimerPin = true
      try {
        await this.runTimerRequest(action, operationId, pin)
        this.closeTimerPinDialog()
      } finally {
        this.loadingTimerPin = false
      }
    },
    async runTimerRequest(action, operationId, pin) {
      const body = { work_order_operation_id: operationId }
      if (pin != null && String(pin).trim() !== '') body.pin = String(pin).trim()
      try {
        await axios.post(`/chronometer/timers/${action}`, body)
        await this.refreshBoard()
        await this.loadProcessList()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
      } catch (error) {
        const msg =
          (error.response && error.response.data && (error.response.data.message || error.response.data.text)) ||
          `No fue posible ejecutar ${action}.`
        alert(msg)
        throw error
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
        this.loadProcessList()
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
        await this.loadProcessList()
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
        await this.loadProcessList()
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

/* Cuadrantes: tiempo muy grande → OT → operación → recurso → operario (más chico) */
.q-time {
  font-size: clamp(3.2rem, 14vw, 8.5rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  margin: 6px 0 4px;
  color: #e6edf3;
}

.q-ot {
  font-size: clamp(1rem, 3.8vw, 1.75rem);
  font-weight: 700;
  color: #58a6ff;
  line-height: 1.15;
  margin-bottom: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-op-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 4px 0 2px;
  max-width: 100%;
}

.q-field-label {
  font-size: clamp(0.62rem, 1.6vw, 0.78rem);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6e7681;
}

.q-op-text {
  font-size: clamp(0.85rem, 2.8vw, 1.25rem);
  font-weight: 600;
  color: #c9d1d9;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.q-res {
  font-size: clamp(0.72rem, 2.2vw, 1rem);
  font-weight: 500;
  color: #8b949e;
  line-height: 1.2;
  margin-bottom: 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-user {
  font-size: clamp(0.65rem, 1.8vw, 0.88rem);
  font-weight: 500;
  color: #6e7681;
  margin-top: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.status-toggle .v-btn {
  margin-bottom: 6px;
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