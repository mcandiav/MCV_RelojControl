<template>
  <v-app>
    <!-- Tablero protector: siempre 2Ã—2 visibles; si hay mÃ¡s de 4 tareas, carrusel (flechas / teclado). -->
    <transition name="fade">
      <div
        v-if="showIdleBoard"
        class="idle-board-overlay"
        role="dialog"
        aria-modal="true"
      >
        <div class="idle-board-body" @click.stop>
          <div v-if="idleBoardTotalPages > 1" class="idle-board-carousel-bar">
            <v-btn icon dark large class="carousel-nav" aria-label="PÃ¡gina anterior" @click="idleBoardPrev">
              <v-icon large>mdi-chevron-left</v-icon>
            </v-btn>
            <div class="carousel-meta">
              <span class="carousel-page">{{ idleBoardSafePage + 1 }} / {{ idleBoardTotalPages }}</span>
              <span class="carousel-count">{{ idleActiveTimersSorted.length }} tareas · izquierda/derecha</span>
            </div>
            <v-btn icon dark large class="carousel-nav" aria-label="PÃ¡gina siguiente" @click="idleBoardNext">
              <v-icon large>mdi-chevron-right</v-icon>
            </v-btn>
          </div>
          <div class="idle-board-grid">
            <div
              v-for="(cell, idx) in idleQuadrants"
              :key="'q-' + idleBoardSafePage + '-' + idx"
              class="idle-quadrant"
              :class="{
                'idle-quadrant--empty': !cell,
                'idle-quadrant--active': cell && cell.status === 'ACTIVE',
                'idle-quadrant--paused': cell && cell.status === 'PAUSED'
              }"
            >
              <template v-if="cell">
                <div class="q-status">
                  <span class="status-dot" :class="statusDotClass(cell.status)" />
                  <span>{{ statusLabel(cell.status) }}</span>
                </div>
                <div class="q-time">{{ formatElapsed(cell) }}</div>
                <div class="q-ot">{{ quadrantOtNumber(cell) }}</div>
                <div class="q-op-block">
                  <span class="q-field-label">Operación</span>
                  <span class="q-op-text">{{ quadrantOperationText(cell) }}</span>
                </div>
                <div class="q-metric-block">
                  <div class="time-bar-label">
                    Run:
                    {{ formatMinutesAsHHMM((quadrantLinkedOp(cell) && quadrantLinkedOp(cell).actual_run_time) || 0) }}
                    / {{ formatMinutesAsHHMM((quadrantLinkedOp(cell) && quadrantLinkedOp(cell).planned_operation_minutes) || 0) }}
                  </div>
                  <div class="time-bar-track">
                    <div
                      class="time-bar-fill"
                      :style="timeBarStyle(
                        (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).actual_run_time) || 0,
                        (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).planned_operation_minutes) || 0
                      )"
                    />
                  </div>
                </div>
                <div class="q-metric-block">
                  <div class="time-bar-label">
                    Setup:
                    {{ formatMinutesAsHHMM((quadrantLinkedOp(cell) && quadrantLinkedOp(cell).actual_setup_time) || 0) }}
                    / {{ formatMinutesAsHHMM((quadrantLinkedOp(cell) && quadrantLinkedOp(cell).planned_setup_minutes) || 0) }}
                  </div>
                  <div class="time-bar-track">
                    <div
                      class="time-bar-fill"
                      :style="timeBarStyle(
                        (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).actual_setup_time) || 0,
                        (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).planned_setup_minutes) || 0
                      )"
                    />
                  </div>
                </div>
                <div class="q-qty">
                  Q: {{ (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).completed_quantity) != null ? quadrantLinkedOp(cell).completed_quantity : '-' }}
                  / {{ (quadrantLinkedOp(cell) && quadrantLinkedOp(cell).planned_quantity) != null ? quadrantLinkedOp(cell).planned_quantity : '-' }}
                </div>
                <div class="q-res">{{ cell.resource_code }}</div>
                <div class="q-user">{{ cell.User ? (cell.User.name + ' ' + cell.User.lastname) : '—' }}</div>
              </template>
              <template v-else>
                <div class="empty-label">Libre</div>
                <div class="meta">Panel {{ idx + 1 }}</div>
              </template>
            </div>
          </div>
        </div>
        <div class="idle-board-footer" @click="closeIdleBoard">
          Toca aquÃ­ para cerrar Â· Esc Â· Carrusel cada {{ idleBoardCarouselSeconds }}s si hay varias pÃ¡ginas Â· Datos cada {{ boardPollSeconds }}s
        </div>
      </div>
    </transition>

    <appbar />
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="text-h6 font-weight-bold mb-2">CronÃ³metro v3</div>
            <div v-if="user" class="subtitle-2">
              Usuario: {{ user.name }} {{ user.lastname }} |
              Rol: {{ user.Role && user.Role.name }} |
              Area: {{ user.Workplace && user.Workplace.name }}
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-tabs v-model="activeTab" background-color="transparent" class="mb-4">
        <v-tab>OperaciÃ³n</v-tab>
        <v-tab v-if="isAdmin">Usuarios</v-tab>
        <v-tab v-if="isAdmin">Sistema</v-tab>
        <v-tab v-if="isAdmin">Sincronizacion</v-tab>
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
                    Tras Seed WIP: <code>total</code> <strong>52</strong>, <code>ot_numbers</code> <strong>OT1</strong> â€¦ <strong>OT9</strong> (nombres con <strong>CUAD A/B/â€¦</strong> para probar cuadrantes).
                    Si el total no coincide, el <strong>backend</strong> puede estar con imagen antigua.
                  </div>
                </v-alert>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="d-flex flex-wrap align-center justify-space-between mb-2">
                  <div class="text-subtitle-1 font-weight-bold">Tablero de cronometros activos</div>
                  <div class="d-flex flex-wrap align-center" style="gap: 8px">
                    <span class="grey--text text-caption">Protector 2Ã—2 tras {{ idleBoardMinutes }} min; todas las tareas activas, carrusel si hay mÃ¡s de 4.</span>
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
                      <th>Tiempos</th>
                      <th>Cantidades</th>
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
                      <td>
                        <div class="time-bar-label">
                          Run: {{ formatMinutesAsHHMM(row.WorkOrderOperation && row.WorkOrderOperation.actual_run_time) }}
                          / {{ formatMinutesAsHHMM(row.WorkOrderOperation && row.WorkOrderOperation.planned_operation_minutes) }}
                          ({{ formatPlanVsRealPercent(row.WorkOrderOperation && row.WorkOrderOperation.actual_run_time, row.WorkOrderOperation && row.WorkOrderOperation.planned_operation_minutes) }})
                        </div>
                        <div class="time-bar-track">
                          <div class="time-bar-fill" :style="timeBarStyle(row.WorkOrderOperation && row.WorkOrderOperation.actual_run_time, row.WorkOrderOperation && row.WorkOrderOperation.planned_operation_minutes)" />
                        </div>
                        <div class="time-bar-label mt-1">
                          Setup: {{ formatMinutesAsHHMM(row.WorkOrderOperation && row.WorkOrderOperation.actual_setup_time) }}
                          / {{ formatMinutesAsHHMM(row.WorkOrderOperation && row.WorkOrderOperation.planned_setup_minutes) }}
                          ({{ formatPlanVsRealPercent(row.WorkOrderOperation && row.WorkOrderOperation.actual_setup_time, row.WorkOrderOperation && row.WorkOrderOperation.planned_setup_minutes) }})
                        </div>
                        <div class="time-bar-track">
                          <div class="time-bar-fill" :style="timeBarStyle(row.WorkOrderOperation && row.WorkOrderOperation.actual_setup_time, row.WorkOrderOperation && row.WorkOrderOperation.planned_setup_minutes)" />
                        </div>
                        <div class="time-block">En uso: <strong>{{ formatElapsed(row) }}</strong></div>
                      </td>
                      <td>
                        {{ row.WorkOrderOperation && row.WorkOrderOperation.completed_quantity != null ? row.WorkOrderOperation.completed_quantity : '-' }}
                        / {{ row.WorkOrderOperation && row.WorkOrderOperation.planned_quantity != null ? row.WorkOrderOperation.planned_quantity : '-' }}
                      </td>
                      <td>
                        <span class="status-dot" :class="statusDotClass(row.status)" />
                        {{ statusLabel(row.status) }}
                      </td>
                      <td>{{ row.User ? (row.User.name + ' ' + row.User.lastname) : '-' }}</td>
                    </tr>
                  </tbody>
                </v-simple-table>
                <div v-else class="grey--text">No hay cronometros activos.</div>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-3">
                  {{ operationsMode === 'area' ? 'Operaciones de tu area' : 'Operaciones por OT' }}
                </div>
                <v-alert v-if="errorOps" type="error" dense class="mb-3">{{ errorOps }}</v-alert>
                <v-alert v-if="!errorOps && emptyOpsHint" type="info" dense class="mb-3">{{ emptyOpsHint }}</v-alert>
            <v-simple-table v-if="operations.length > 0" class="compact-table ops-table">
                  <thead>
                    <tr>
                      <th>OT / Op</th>
                      <th>Recurso</th>
                      <th>Estado</th>
                      <th>Tiempos</th>
                      <th>Cantidades</th>
                      <th>Area</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="op in operations" :key="op.id">
                      <td>
                        <div class="ops-meta"><strong>{{ op.ot_number }}</strong> Â· Sec {{ op.operation_sequence }}</div>
                        <div class="ops-meta">{{ op.operation_name }}</div>
                      </td>
                      <td>{{ op.resource_code }}</td>
                      <td>{{ op.status || 'STOPPED' }}</td>
                      <td>
                        <div class="time-bar-label">
                          Run: {{ formatMinutesAsHHMM(op.actual_run_time) }} / {{ formatMinutesAsHHMM(op.planned_operation_minutes) }}
                          ({{ formatPlanVsRealPercent(op.actual_run_time, op.planned_operation_minutes) }})
                        </div>
                        <div class="time-bar-track">
                          <div class="time-bar-fill" :style="timeBarStyle(op.actual_run_time, op.planned_operation_minutes)" />
                        </div>
                        <div class="time-bar-label mt-1">
                          Setup: {{ formatMinutesAsHHMM(op.actual_setup_time) }} / {{ formatMinutesAsHHMM(op.planned_setup_minutes) }}
                          ({{ formatPlanVsRealPercent(op.actual_setup_time, op.planned_setup_minutes) }})
                        </div>
                        <div class="time-bar-track">
                          <div class="time-bar-fill" :style="timeBarStyle(op.actual_setup_time, op.planned_setup_minutes)" />
                        </div>
                        <div class="time-block">En uso: <strong>{{ formatElapsedFromSeconds(op.elapsed_seconds || 0) }}</strong></div>
                        <div class="time-block">Run P/R: {{ formatMinutesAsHHMM(op.planned_operation_minutes) }} / {{ formatMinutesAsHHMM(op.actual_run_time) }}</div>
                        <div class="time-block">Set P/R: {{ formatMinutesAsHHMM(op.planned_setup_minutes) }} / {{ formatMinutesAsHHMM(op.actual_setup_time) }}</div>
                      </td>
                      <td>
                        {{ op.completed_quantity != null ? op.completed_quantity : '-' }} / {{ op.planned_quantity != null ? op.planned_quantity : '-' }}
                      </td>
                  <td>{{ op.area }}</td>
                  <td class="actions-cell">
                    <div class="action-buttons">
                      <v-btn x-small color="success" @click="timerAction('start', op.id)">Play</v-btn>
                      <v-btn x-small color="warning" @click="timerAction('pause', op.id)">Pausa</v-btn>
                      <v-btn x-small color="error" @click="openStopQuantityDialog(op)">Stop</v-btn>
                    <template v-if="isAdmin">
                      <v-btn x-small color="error" @click="borrarOperacion(op.id)">Borrar</v-btn>
                    </template>
                    </div>
                      </td>
                    </tr>
                  </tbody>
                </v-simple-table>
                <div v-else class="grey--text">
                  {{ operationsMode === 'area' ? 'Sin operaciones cargadas para tu area.' : 'Sin operaciones cargadas.' }}
                </div>
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
                      <td>
                        <v-btn x-small color="primary" class="mr-1" @click="openEditUserDialog(u)">Editar</v-btn>
                        <v-btn x-small color="error" @click="eliminarUsuario(u.id)">Eliminar</v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-simple-table>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>

        <v-tab-item v-if="isAdmin">
          <v-row>
            <v-col cols="12" md="6">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">Cierres de turno automÃ¡ticos</div>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Tres horarios (zona {{ shiftMeta.timezone || 'â€”' }}). Se programan cron jobs en el servidor al guardar.
                  Los flags globales vienen de variables de entorno del API (<code>NS_SHIFT_BATCH_ENABLED</code>,
                  <code>NS_AUTO_STOP_AT_SHIFT_END</code>).
                </p>
                <v-alert v-if="shiftMeta.shift_batch_enabled === false || shiftMeta.auto_stop_at_shift_end === false" type="warning" dense outlined class="mb-3">
                  El planificador estÃ¡ deshabilitado por configuraciÃ³n del servidor; igual podÃ©s editar y guardar horarios para cuando se active.
                </v-alert>
                <v-alert v-if="shiftScheduleError" type="error" dense class="mb-3">{{ shiftScheduleError }}</v-alert>
                <div v-for="slot in shiftSlotsDraft" :key="'s-' + slot.sequence" class="d-flex flex-wrap align-center mb-3" style="gap: 12px">
                  <span class="text-caption font-weight-medium" style="min-width: 72px">Cierre {{ slot.sequence }}</span>
                  <v-text-field
                    v-model="slot.hhmm"
                    type="time"
                    dense
                    outlined
                    hide-details
                    style="max-width: 140px"
                  />
                  <v-switch v-model="slot.enabled" label="Activo" dense hide-details class="mt-0" />
                </div>
                <v-btn color="primary" :loading="loadingShiftSave" :disabled="loadingShiftSchedule" @click="saveShiftSchedule">
                  Guardar horarios
                </v-btn>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">NetSuite</div>
                <v-alert v-if="apiUrlBrokenOnHttps" type="error" dense prominent class="mb-3">
                  La app carga en <strong>HTTPS</strong> pero axios apunta a <code>{{ axiosBaseUrlDisplay }}</code>.
                  El navegador bloquea eso (mixed content) y verÃ¡s <strong>Network Error</strong> al instante.
                  Rebuild del <strong>front</strong> con <code>VUE_APP_API_URL=https://reloj-api.at-once.cl/</code> y sin build-arg vacÃ­o en EasyPanel.
                </v-alert>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  URL API actual: <code>{{ axiosBaseUrlDisplay }}</code> Â· Origen web: <code>{{ browserOrigin }}</code>
                </p>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Pull: dataset <strong>MCV_cronometro_out</strong> (desde el navegador o con script en el host:
                  <code>backend/scripts/netsuite-pull-standalone.js</code>). Push: RESTlet IN. Variables <code>NETSUITE_*</code> en el API o en la mÃ¡quina donde corrÃ¡s el script.
                </p>
                <v-btn class="mr-2 mb-2" small outlined :loading="loadingCorsPing" @click="testApiCorsPing">
                  Probar conexiÃ³n API
                </v-btn>
                <v-btn class="mr-2 mb-2" small outlined :loading="loadingNsStatus" @click="loadNsStatus">Estado integraciÃ³n</v-btn>
                <v-simple-table v-if="nsStatus" dense class="mb-3 ns-status-table">
                  <tbody>
                    <tr v-for="row in nsStatusFlat" :key="row.key">
                      <td class="text-caption font-weight-medium">{{ row.key }}</td>
                      <td class="text-caption">{{ row.val }}</td>
                    </tr>
                  </tbody>
                </v-simple-table>
                <div class="d-flex flex-wrap" style="gap: 8px">
                  <v-btn color="primary" outlined :loading="loadingNsPullReplace" :disabled="!isAdmin" @click="netsuitePullReplace">
                    Pull + Replace WIP
                  </v-btn>
                  <v-btn color="secondary" :loading="loadingNsPush" :disabled="!isAdmin" @click="netsuitePush">
                    Publicar a NetSuite (push)
                  </v-btn>
                  <v-btn color="secondary" outlined :loading="loadingNsPushDryRun" :disabled="!isAdmin" @click="netsuitePushDryRun">
                    Dry run push
                  </v-btn>
                </div>
                <v-alert v-if="nsLastResult" type="info" dense outlined class="mt-3 mb-0 text-left">
                  <pre class="ns-json">{{ nsLastResult }}</pre>
                </v-alert>
                <v-divider class="my-4" />
                <div class="d-flex flex-wrap align-center justify-space-between mb-2" style="gap:8px">
                  <div class="text-subtitle-2 font-weight-bold">WIP sincronizado en MariaDB (NetSuite OUT)</div>
                  <v-btn small outlined color="primary" :loading="loadingNsWipRows" @click="loadNsWipRows">
                    Refrescar listado
                  </v-btn>
                </div>
                <v-text-field
                  v-model.trim="nsWipFilter"
                  dense
                  outlined
                  hide-details
                  class="mb-2"
                  label="Filtrar (OT, operaciÃ³n, recurso, Ã¡rea o status)"
                />
                <div class="text-caption grey--text mb-2">
                  Mostrando {{ filteredNsWipRows.length }} de {{ nsWipRows.length }} filas.
                </div>
                <v-alert v-if="nsWipRowsError" type="error" dense outlined class="mb-2">{{ nsWipRowsError }}</v-alert>
                <div class="ns-wip-table-wrap">
                  <v-simple-table dense class="compact-table ns-wip-table">
                    <thead>
                      <tr>
                        <th>OT</th>
                        <th>Seq</th>
                        <th>Operacion</th>
                        <th>Recurso</th>
                        <th>Area</th>
                        <th>Plan setup (HH:MM)</th>
                        <th>Plan run (HH:MM)</th>
                        <th>Plan qty</th>
                        <th>Real setup (HH:MM)</th>
                        <th>Real run (HH:MM)</th>
                        <th>Comp qty</th>
                        <th>NS Op ID</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in filteredNsWipRows" :key="'nswip-' + row.id">
                        <td>{{ row.ot_number }}</td>
                        <td>{{ row.operation_sequence }}</td>
                        <td>{{ row.operation_name }}</td>
                        <td>{{ row.resource_code }}</td>
                        <td>{{ row.area }}</td>
                        <td>{{ formatMinutesAsHHMM(row.planned_setup_minutes) }}</td>
                        <td>{{ formatMinutesAsHHMM(row.planned_operation_minutes) }}</td>
                        <td>{{ row.planned_quantity != null ? row.planned_quantity : '-' }}</td>
                        <td>{{ formatMinutesAsHHMM(row.actual_setup_time) }}</td>
                        <td>{{ formatMinutesAsHHMM(row.actual_run_time) }}</td>
                        <td>{{ row.completed_quantity != null ? row.completed_quantity : '-' }}</td>
                        <td>{{ row.netsuite_operation_id || '-' }}</td>
                        <td>{{ row.source_status || '-' }}</td>
                      </tr>
                    </tbody>
                  </v-simple-table>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>
        <v-tab-item v-if="isAdmin">
          <v-row>
            <v-col cols="12" md="8">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">Sincronizacion operativa</div>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Flujo: detener todos los relojes -> push a NetSuite -> esperar -> pull + replace desde NetSuite.
                </p>
                <v-alert type="warning" dense outlined class="mb-3">
                  Esta sincronizacion puede demorar hasta 3 minutos.
                </v-alert>
                <v-text-field
                  v-model.number="nsOperationalDelaySeconds"
                  label="Espera entre push y pull (segundos)"
                  type="number"
                  min="0"
                  max="120"
                  dense
                  outlined
                  hide-details
                  style="max-width: 320px"
                  class="mb-3"
                />
                <v-btn
                  color="primary"
                  large
                  :loading="loadingNsOperationalSync"
                  :disabled="loadingNsOperationalSync"
                  @click="runOperationalSync"
                >
                  Ejecutar cierre + sincronizacion
                </v-btn>
                <v-alert v-if="nsOperationalLastResult" type="info" dense outlined class="mt-3 mb-0 text-left">
                  <pre class="ns-json">{{ nsOperationalLastResult }}</pre>
                </v-alert>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>
      </v-tabs-items>
    </v-container>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="5000" bottom>
      {{ snackbarText }}
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="snackbar = false">Cerrar</v-btn>
      </template>
    </v-snackbar>

    <!-- Stop: cantidad terminada (opcional) -->
    <v-dialog v-model="stopQtyDialog" max-width="420" persistent>
      <v-card>
        <v-card-title class="text-h6">Detener cronÃ³metro</v-card-title>
        <v-card-text>
          <p class="body-2 mb-3">
            PodÃ©s registrar la <strong>cantidad terminada</strong> de esta operaciÃ³n al cerrar. Si no cargÃ¡s nada, solo se detiene el cronÃ³metro y no se cambia el valor en base.
          </p>
          <v-text-field
            v-model="stopQtyValue"
            label="Cantidad terminada (opcional)"
            type="number"
            min="0"
            step="1"
            outlined
            dense
            hide-details="auto"
            :disabled="stopQtyLoading"
            @keyup.enter="confirmStopWithQuantity"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text :disabled="stopQtyLoading" @click="closeStopQuantityDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="stopQtyLoading" @click="confirmStopWithQuantity">Aceptar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="editUserDialog" max-width="560" persistent>
      <v-card>
        <v-card-title class="text-h6">Editar usuario</v-card-title>
        <v-card-text>
          <v-text-field v-model.trim="editUser.name" label="Nombre" dense outlined />
          <v-text-field v-model.trim="editUser.lastname" label="Apellido" dense outlined />
          <v-text-field v-model.trim="editUser.username" label="Usuario" dense outlined />
          <v-text-field v-model="editUser.password" label="Nuevo password / PIN (opcional)" dense outlined type="password" />
          <v-select v-model="editUser.RoleId" :items="roles" item-text="name" item-value="id" label="Rol" dense outlined />
          <v-select v-model="editUser.WorkplaceId" :items="workplaces" item-text="name" item-value="id" label="Area" dense outlined />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text :disabled="loadingEditUser" @click="closeEditUserDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="loadingEditUser" @click="saveEditUser">Guardar</v-btn>
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

/** Pull/push NetSuite suele tardar >20s; el timeout global de axios en main.js es corto. */
const NETSUITE_AXIOS_TIMEOUT_MS = 180000

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
      loadingEditUser: false,
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
      editUserDialog: false,
      editUser: {
        id: null,
        name: '',
        lastname: '',
        username: '',
        password: '',
        RoleId: null,
        WorkplaceId: null
      },
      operationsMode: 'area',
      showIdleBoard: false,
      idleBoardMinutes: Number(process.env.VUE_APP_IDLE_BOARD_MINUTES || 2),
      boardPollSeconds: Number(process.env.VUE_APP_IDLE_BOARD_POLL_SEC || 15),
      idleBoardCarouselIntervalId: null,
      idleBoardOpenTimeout: null,
      boardPollIntervalId: null,
      lastPointerMoveTs: 0,
      lastSeedResponse: '',
      /** PÃ¡gina del carrusel del tablero grande (4 tareas por pÃ¡gina, rejilla 2Ã—2). */
      idleBoardPage: 0,
      stopQtyDialog: false,
      stopQtyOpId: null,
      stopQtyValue: '',
      stopQtyLoading: false,
      shiftSlotsDraft: [
        { sequence: 1, hhmm: '07:00', enabled: true },
        { sequence: 2, hhmm: '15:00', enabled: true },
        { sequence: 3, hhmm: '23:00', enabled: true }
      ],
      shiftMeta: {
        timezone: '',
        shift_batch_enabled: null,
        auto_stop_at_shift_end: null
      },
      loadingShiftSchedule: false,
      loadingShiftSave: false,
      shiftScheduleError: '',
      loadingCorsPing: false,
      loadingNsStatus: false,
      loadingNsPull: false,
      loadingNsPullReplace: false,
      loadingNsPullReplace500: false,
      loadingNsPush: false,
      loadingNsPushDryRun: false,
      loadingNsWipRows: false,
      loadingNsOperationalSync: false,
      nsStatus: null,
      nsLastResult: '',
      nsOperationalLastResult: '',
      nsOperationalDelaySeconds: 10,
      nsWipRows: [],
      nsWipRowsError: '',
      nsWipFilter: '',
      snackbar: false,
      snackbarText: '',
      snackbarColor: 'success'
    }
  },
  created() {
    this.refreshBoard()
    this.loadAreaOperations()
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
    clearTimeout(this.idleBoardOpenTimeout)
    this.stopBoardPollWhileOpen()
    this.stopIdleBoardCarousel()
    document.removeEventListener('keydown', this.onIdleBoardKeydown)
  },
  watch: {
    isAdmin: {
      immediate: true,
      handler(val) {
        if (val) {
          this.loadAdminCatalogs()
          this.loadShiftSchedule()
          this.loadNsWipRows()
        }
      }
    },
    otNumber(value) {
      if (this.searchTimeout) clearTimeout(this.searchTimeout)
      const digits = String(value || '').replace(/[^0-9]/g, '')
      if (!digits) {
        this.errorOps = ''
        this.emptyOpsHint = ''
        this.loadAreaOperations()
        return
      }
      this.searchTimeout = setTimeout(() => {
        this.buscarOperaciones()
      }, 300)
    },
    showIdleBoard(val) {
      if (val) {
        this.idleBoardPage = 0
        document.addEventListener('keydown', this.onIdleBoardKeydown)
        this.$nextTick(() => this.syncIdleBoardCarousel())
      } else {
        document.removeEventListener('keydown', this.onIdleBoardKeydown)
        this.stopIdleBoardCarousel()
      }
    },
    idleBoardTotalPages(n) {
      if (this.idleBoardPage >= n) this.idleBoardPage = Math.max(0, n - 1)
      if (this.showIdleBoard) this.syncIdleBoardCarousel()
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
    /** Segundos entre pÃ¡ginas del carrusel (solo si hay mÃ¡s de 4 tareas). */
    idleBoardCarouselSeconds() {
      const s = Number(process.env.VUE_APP_IDLE_BOARD_CAROUSEL_SEC || 2)
      return Math.max(1, Math.min(120, s))
    },
    idleMs() {
      return Math.max(1, this.idleBoardMinutes) * 60 * 1000
    },
    /** TamaÃ±o fijo 2Ã—2 = 4 por pantalla (legible en monitor planta). */
    idleBoardSlotsPerPage() {
      const n = Number(process.env.VUE_APP_IDLE_BOARD_SLOTS || 4)
      return Math.max(1, Math.min(4, n))
    },
    idleActiveTimersSorted() {
      const rows = this.activeBoard.filter((r) => r.status === 'ACTIVE' || r.status === 'PAUSED')
      return [...rows].sort((a, b) => String(a.resource_code || '').localeCompare(String(b.resource_code || '')))
    },
    idleBoardTotalPages() {
      const len = this.idleActiveTimersSorted.length
      const per = this.idleBoardSlotsPerPage
      if (len === 0) return 1
      return Math.ceil(len / per)
    },
    idleBoardSafePage() {
      const max = Math.max(0, this.idleBoardTotalPages - 1)
      return Math.min(Math.max(0, this.idleBoardPage), max)
    },
    idleQuadrants() {
      const per = this.idleBoardSlotsPerPage
      const list = this.idleActiveTimersSorted
      const page = this.idleBoardSafePage
      const start = page * per
      const slice = list.slice(start, start + per)
      const q = [...slice]
      while (q.length < per) q.push(null)
      return q
    },
    nsStatusFlat() {
      if (!this.nsStatus || typeof this.nsStatus !== 'object') return []
      return Object.keys(this.nsStatus).map((k) => ({
        key: k,
        val: typeof this.nsStatus[k] === 'object' ? JSON.stringify(this.nsStatus[k]) : String(this.nsStatus[k])
      }))
    },
    axiosBaseUrlDisplay() {
      return String((axios.defaults && axios.defaults.baseURL) || '(sin baseURL)')
    },
    browserOrigin() {
      if (typeof window === 'undefined') return 'â€”'
      return window.location.origin || 'â€”'
    },
    /** HTTPS en planta + API en http://localhost o http://cualquiera â†’ bloqueo inmediato del navegador. */
    apiUrlBrokenOnHttps() {
      if (typeof window === 'undefined') return false
      if (window.location.protocol !== 'https:') return false
      const b = String(axios.defaults.baseURL || '').toLowerCase()
      if (/localhost|127\.0\.0\.1/.test(b)) return true
      if (b.startsWith('http://')) return true
      return false
    },
    filteredNsWipRows() {
      const rows = Array.isArray(this.nsWipRows) ? this.nsWipRows : []
      const q = String(this.nsWipFilter || '').trim().toLowerCase()
      if (!q) return rows
      return rows.filter((r) => {
        const bag = [
          r.ot_number,
          r.operation_name,
          r.resource_code,
          r.area,
          r.source_status,
          r.netsuite_operation_id,
          r.operation_sequence
        ]
          .map((v) => String(v == null ? '' : v).toLowerCase())
          .join(' | ')
        return bag.includes(q)
      })
    }
  },
  methods: {
    onMouseMoveForIdle() {
      if (!this.idleBoardEnabled || this.showIdleBoard) return
      const now = Date.now()
      if (now - this.lastPointerMoveTs < 800) return
      this.lastPointerMoveTs = now
      this.scheduleIdleOpen()
    },
    scheduleIdleOpen() {
      if (!this.idleBoardEnabled) return
      clearTimeout(this.idleBoardOpenTimeout)
      if (this.showIdleBoard) return
      this.idleBoardOpenTimeout = setTimeout(() => {
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
      this.boardPollIntervalId = setInterval(() => {
        this.refreshBoard()
      }, ms)
    },
    stopBoardPollWhileOpen() {
      if (this.boardPollIntervalId) {
        clearInterval(this.boardPollIntervalId)
        this.boardPollIntervalId = null
      }
    },
    stopIdleBoardCarousel() {
      if (this.idleBoardCarouselIntervalId) {
        clearInterval(this.idleBoardCarouselIntervalId)
        this.idleBoardCarouselIntervalId = null
      }
    },
    syncIdleBoardCarousel() {
      if (!this.showIdleBoard) {
        this.stopIdleBoardCarousel()
        return
      }
      if (this.idleBoardTotalPages <= 1) {
        this.stopIdleBoardCarousel()
        return
      }
      if (this.idleBoardCarouselIntervalId) return
      const ms = this.idleBoardCarouselSeconds * 1000
      this.idleBoardCarouselIntervalId = setInterval(() => {
        if (!this.showIdleBoard || this.idleBoardTotalPages <= 1) {
          this.stopIdleBoardCarousel()
          return
        }
        this.idleBoardNext()
      }, ms)
    },
    onIdleBoardKeydown(e) {
      if (!this.showIdleBoard) return
      if (e.key === 'Escape') {
        this.closeIdleBoard()
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        this.idleBoardPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        this.idleBoardNext()
      }
    },
    idleBoardPrev() {
      const n = this.idleBoardTotalPages
      if (n <= 1) return
      const cur = this.idleBoardSafePage
      this.idleBoardPage = (cur - 1 + n) % n
    },
    idleBoardNext() {
      const n = this.idleBoardTotalPages
      if (n <= 1) return
      const cur = this.idleBoardSafePage
      this.idleBoardPage = (cur + 1) % n
    },
    closeIdleBoard() {
      this.showIdleBoard = false
      this.stopBoardPollWhileOpen()
      this.stopIdleBoardCarousel()
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
    /** Incluye asociaciÃ³n anidada (WorkOrderOperation o serializaciÃ³n alternativa). */
    quadrantLinkedOp(cell) {
      if (!cell) return null
      return cell.WorkOrderOperation || cell.workOrderOperation || null
    },
    quadrantOtNumber(cell) {
      const op = this.quadrantLinkedOp(cell)
      if (op != null && op.ot_number != null && String(op.ot_number).trim() !== '') return op.ot_number
      return 'â€”'
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
      return rc || 'â€”'
    },
    statusLabel(status) {
      const s = String(status || '').toUpperCase()
      if (s === 'ACTIVE') return 'Activo'
      if (s === 'PAUSED') return 'Pausa'
      if (s === 'STOPPED') return 'Detenido'
      return s || '-'
    },
    statusDotClass(status) {
      const s = String(status || '').toUpperCase()
      if (s === 'ACTIVE') return 'status-dot--active'
      if (s === 'PAUSED') return 'status-dot--paused'
      if (s === 'STOPPED') return 'status-dot--stopped'
      return 'status-dot--unknown'
    },
    formatElapsedFromSeconds(totalSeconds) {
      const total = Math.max(0, Number(totalSeconds || 0))
      const hrs = Math.floor(total / 3600)
      const mins = Math.floor((total % 3600) / 60)
      const secs = total % 60
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    },
    formatMinutesAsHHMM(totalMinutes) {
      if (totalMinutes == null || totalMinutes === '') return '-'
      const n = Number(totalMinutes)
      if (!Number.isFinite(n)) return '-'
      const m = Math.max(0, Math.floor(n))
      const hrs = Math.floor(m / 60)
      const mins = m % 60
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
    },
    formatPlanVsRealPercent(realMinutes, planMinutes) {
      const real = Number(realMinutes || 0)
      const plan = Number(planMinutes || 0)
      if (!Number.isFinite(plan) || plan <= 0) return 'sin plan'
      const pct = Math.max(0, Math.round((Math.max(0, real) / plan) * 100))
      return `${pct}%`
    },
    timeBarStyle(realMinutes, planMinutes) {
      const real = Number(realMinutes || 0)
      const plan = Number(planMinutes || 0)
      if (!Number.isFinite(plan) || plan <= 0) {
        return { width: '0%', backgroundColor: '#9e9e9e' }
      }
      const ratio = Math.max(0, real) / plan
      const pct = Math.min(150, Math.round(ratio * 100))
      let color = '#4caf50'
      if (ratio > 1) color = '#ef5350'
      else if (ratio >= 0.85) color = '#ff9800'
      return { width: `${pct}%`, backgroundColor: color }
    },
    async borrarOperacion(id) {
      if (!confirm('Â¿Borrar operaciÃ³n?')) return
      try {
        await axios.delete(`/chronometer/operations/${id}`)
        this.operations = this.operations.filter((item) => item.id !== id)
        this.refreshBoard()
      } catch (error) {
        alert('No fue posible borrar la operaciÃ³n.')
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
      if (!confirm('Â¿Eliminar usuario?')) return
      try {
        await axios.delete(`/auth/users/${id}`)
        await this.loadAdminCatalogs()
      } catch (error) {
        alert('No fue posible eliminar el usuario.')
      }
    },
    openEditUserDialog(user) {
      if (!user) return
      this.editUser = {
        id: user.id,
        name: user.name || '',
        lastname: user.lastname || '',
        username: user.username || '',
        password: '',
        RoleId: user.RoleId || (user.Role && user.Role.id) || null,
        WorkplaceId: user.WorkplaceId || (user.Workplace && user.Workplace.id) || null
      }
      this.editUserDialog = true
    },
    closeEditUserDialog() {
      this.editUserDialog = false
      this.editUser = {
        id: null,
        name: '',
        lastname: '',
        username: '',
        password: '',
        RoleId: null,
        WorkplaceId: null
      }
    },
    async saveEditUser() {
      if (!this.editUser.id) return
      if (!this.editUser.name || !this.editUser.lastname || !this.editUser.username || !this.editUser.RoleId || !this.editUser.WorkplaceId) {
        alert('Completa nombre, apellido, usuario, rol y area.')
        return
      }
      this.loadingEditUser = true
      try {
        const payload = {
          name: this.editUser.name,
          lastname: this.editUser.lastname,
          username: this.editUser.username,
          RoleId: this.editUser.RoleId,
          WorkplaceId: this.editUser.WorkplaceId
        }
        if (this.editUser.password) payload.password = this.editUser.password
        await axios.put(`/auth/users/${this.editUser.id}`, payload)
        this.showSnack('Usuario actualizado.')
        this.closeEditUserDialog()
        await this.loadAdminCatalogs()
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || 'No fue posible actualizar el usuario.'
        alert(msg)
      } finally {
        this.loadingEditUser = false
      }
    },
    async buscarOperaciones() {
      this.errorOps = ''
      this.emptyOpsHint = ''
      this.operations = []
      this.operationsMode = 'ot'
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
            'No hay operaciones para esta OT en tu area o la OT no esta cargada. Con datos de prueba: Seed WIP o POST upsert (ver backend/scripts) y busca OT1 â€¦ OT9.'
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
    async loadAreaOperations() {
      // Requisito operativo: al iniciar sesiÃ³n, operario ve tablero con todas las operaciones de su Ã¡rea.
      this.loadingOps = true
      this.errorOps = ''
      this.emptyOpsHint = ''
      this.operationsMode = 'area'
      try {
        const res = await axios.get('/chronometer/operations?status=ALL&limit=500')
        this.operations = (res.data && Array.isArray(res.data.operations)) ? res.data.operations : []
        if (this.operations.length === 0) {
          this.emptyOpsHint = 'No hay operaciones disponibles en tu area.'
        }
      } catch (error) {
        const d = error.response && error.response.data
        let msg = 'No fue posible cargar operaciones del area.'
        if (typeof d === 'string') msg = d
        else if (d && typeof d.message === 'string') msg = d.message
        this.errorOps = msg
        this.operations = []
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
    async timerAction(action, operationId) {
      try {
        await axios.post(`/chronometer/timers/${action}`, { work_order_operation_id: operationId })
        await this.refreshBoard()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
        else await this.loadAreaOperations()
      } catch (error) {
        const msg = (error.response && error.response.data && (error.response.data.message || error.response.data.text)) || `No fue posible ejecutar ${action}.`
        alert(msg)
      }
    },
    openStopQuantityDialog(op) {
      this.stopQtyOpId = op.id
      // Delta por cierre: iniciar vacÃ­o para no reenviar el acumulado por error.
      this.stopQtyValue = ''
      this.stopQtyDialog = true
    },
    closeStopQuantityDialog(force = false) {
      if (this.stopQtyLoading && !force) return
      this.stopQtyDialog = false
      this.stopQtyOpId = null
      this.stopQtyValue = ''
    },
    async confirmStopWithQuantity() {
      if (!this.stopQtyOpId) return
      const trimmed = String(this.stopQtyValue || '').trim()
      const body = { work_order_operation_id: this.stopQtyOpId }
      if (trimmed !== '') {
        if (!/^\d+$/.test(trimmed)) {
          alert('IngresÃ¡ solo nÃºmeros enteros â‰¥ 0, o dejÃ¡ vacÃ­o para no cambiar la cantidad terminada.')
          return
        }
        body.completed_quantity = parseInt(trimmed, 10)
      }
      this.stopQtyLoading = true
      try {
        await axios.post('/chronometer/timers/stop', body)
        await this.refreshBoard()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
        else await this.loadAreaOperations()
        this.closeStopQuantityDialog(true)
      } catch (error) {
        const msg =
          (error.response && error.response.data && (error.response.data.message || error.response.data.text)) ||
          'No fue posible detener el cronÃ³metro.'
        alert(msg)
      } finally {
        this.stopQtyLoading = false
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
        alert(`Seed WIP OK. Filas: ${n}. OTs: ${ots || '(sin ot_numbers en respuesta â€” backend viejo)'}`)
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
    },
    showSnack(text, color = 'success') {
      this.snackbarText = text
      this.snackbarColor = color
      this.snackbar = true
    },
    /** Mensaje legible cuando axios no recibe respuesta (timeout, CORS, URL mal, SSL). */
    netsuiteAxiosErrorPayload(error) {
      if (error && error.code === 'ECONNABORTED') {
        return {
          message: 'Tiempo de espera agotado. El pull puede tardar varios minutos; reintentÃ¡ o revisÃ¡ la API.',
          code: 'ECONNABORTED'
        }
      }
      if (error && error.message === 'Network Error') {
        const base = String(axios.defaults.baseURL || '').replace(/\/$/, '')
        const httpsOk = /^https:/i.test(base)
        const pasos = [
          `AbrÃ­ en una pestaÃ±a nueva: ${base}/health â€” si el navegador marca certificado invÃ¡lido, el problema es TLS (no CORS).`,
          `Desde acÃ¡ usÃ¡ el botÃ³n Â«Probar conexiÃ³n APIÂ» (GET ${base}/cors-ping, sin JWT).`,
          'Si /health abre bien pero axios falla: otra red/VPN, antivirus, bloqueo DNS o proxy frente a reloj-api.'
        ]
        if (!httpsOk) {
          pasos.unshift('La base del API deberÃ­a ser https:// en producciÃ³n.')
        }
        return {
          message:
            'Network Error: no hubo respuesta HTTP usable. Tu baseURL ya es HTTPS hacia reloj-api â†’ suele ser certificado TLS, red/firewall o DNS, no la variable VUE_APP_API_URL.',
          code: 'NETWORK_ERROR',
          axios_baseURL: axios.defaults.baseURL || null,
          pasos
        }
      }
      return { message: (error && error.message) || 'Error de red', code: error && error.code }
    },
    async loadShiftSchedule() {
      if (!this.isAdmin) return
      this.shiftScheduleError = ''
      this.loadingShiftSchedule = true
      try {
        const res = await axios.get('/chronometer/admin/shift-schedule')
        const d = res.data || {}
        this.shiftMeta = {
          timezone: d.timezone || '',
          shift_batch_enabled: d.shift_batch_enabled,
          auto_stop_at_shift_end: d.auto_stop_at_shift_end
        }
        const slots = Array.isArray(d.slots) ? d.slots : []
        if (slots.length >= 3) {
          this.shiftSlotsDraft = slots
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((s) => ({
              sequence: s.sequence,
              hhmm: String(s.hhmm || '00:00').slice(0, 5),
              enabled: s.enabled !== false
            }))
        }
      } catch (error) {
        this.shiftScheduleError =
          (error.response && error.response.data && error.response.data.message) ||
          'No se pudo cargar el horario de cierres.'
      } finally {
        this.loadingShiftSchedule = false
      }
    },
    async saveShiftSchedule() {
      this.shiftScheduleError = ''
      this.loadingShiftSave = true
      try {
        const slots = this.shiftSlotsDraft.map((s) => ({
          sequence: s.sequence,
          hhmm: String(s.hhmm || '').trim(),
          enabled: s.enabled !== false
        }))
        const res = await axios.put('/chronometer/admin/shift-schedule', { slots })
        if (res.data && Array.isArray(res.data.slots)) {
          this.shiftSlotsDraft = res.data.slots
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((s) => ({
              sequence: s.sequence,
              hhmm: String(s.hhmm || '').slice(0, 5),
              enabled: s.enabled !== false
            }))
        }
        this.showSnack('Horarios de cierre guardados y crons actualizados.')
      } catch (error) {
        const msg =
          (error.response && error.response.data && error.response.data.message) ||
          'No se pudo guardar el horario.'
        this.shiftScheduleError = msg
        this.showSnack(msg, 'error')
      } finally {
        this.loadingShiftSave = false
      }
    },
    async testApiCorsPing() {
      this.loadingCorsPing = true
      this.nsLastResult = ''
      const base = String(axios.defaults.baseURL || '').replace(/\/$/, '')
      const url = `${base}/cors-ping`
      try {
        const res = await axios.get(url, { timeout: 25000 })
        this.nsLastResult = JSON.stringify(
          { ok: true, url, respuesta: res.data },
          null,
          2
        )
        this.showSnack('API alcanzable (cors-ping).')
      } catch (error) {
        const d = error.response && error.response.data
        const payload = d || this.netsuiteAxiosErrorPayload(error)
        this.nsLastResult = JSON.stringify({ ...payload, intento_url: url }, null, 2)
        this.showSnack('No se pudo contactar al API.', 'error')
      } finally {
        this.loadingCorsPing = false
      }
    },
    async loadNsStatus() {
      this.loadingNsStatus = true
      try {
        const res = await axios.get('/chronometer/netsuite/status', { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsStatus = res.data || null
        this.showSnack('Estado NetSuite actualizado.')
      } catch (error) {
        this.nsStatus = null
        const fromApi = error.response && error.response.data && error.response.data.message
        const net = !error.response ? this.netsuiteAxiosErrorPayload(error) : null
        const msg = fromApi || (net && net.message) || 'Error al leer estado NetSuite.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsStatus = false
      }
    },
    async loadNsWipRows() {
      if (!this.isAdmin) return
      this.loadingNsWipRows = true
      this.nsWipRowsError = ''
      try {
        const res = await axios.get('/chronometer/operations?status=ALL&limit=500', { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        const ops = (res.data && Array.isArray(res.data.operations)) ? res.data.operations : []
        this.nsWipRows = ops
      } catch (error) {
        this.nsWipRows = []
        this.nsWipRowsError =
          (error.response && error.response.data && error.response.data.message) ||
          'No se pudo cargar el listado WIP desde MariaDB.'
      } finally {
        this.loadingNsWipRows = false
      }
    },
    async netsuitePull() {
      this.loadingNsPull = true
      this.nsLastResult = ''
      try {
        const res = await axios.post('/chronometer/netsuite/pull-dataset', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Pull NetSuite completado.')
        await this.loadNsWipRows()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en pull NetSuite.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsPull = false
      }
    },
    async netsuitePullReplace() {
      if (!confirm('Esto REEMPLAZA toda la tabla WIP (work_order_operations) con lo que venga desde NetSuite. Debe no haber cronÃ³metros activos/pausados. Â¿Continuar?')) {
        return
      }
      this.loadingNsPullReplace = true
      this.nsLastResult = ''
      try {
        const res = await axios.post('/chronometer/netsuite/pull-dataset?replace=1', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Pull + Replace completado.')
        await this.loadNsWipRows()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en pull+replace NetSuite.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsPullReplace = false
      }
    },
    async netsuitePullReplace500() {
      if (!confirm('Esto REEMPLAZA toda la tabla WIP con un tope de 500 filas del pull (prueba controlada). Debe no haber cronÃ³metros activos/pausados. Â¿Continuar?')) {
        return
      }
      this.loadingNsPullReplace500 = true
      this.nsLastResult = ''
      try {
        const res = await axios.post('/chronometer/netsuite/pull-dataset?replace=1&maxRows=500', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Pull + Replace 500 completado.')
        await this.loadNsWipRows()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en pull+replace 500 NetSuite.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsPullReplace500 = false
      }
    },
    async netsuitePush() {
      this.loadingNsPush = true
      this.nsLastResult = ''
      try {
        const res = await axios.post('/chronometer/netsuite/push-actuals', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Push a NetSuite enviado.')
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en push NetSuite.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsPush = false
      }
    },
    async netsuitePushDryRun() {
      this.loadingNsPushDryRun = true
      this.nsLastResult = ''
      try {
        const res = await axios.post('/chronometer/netsuite/push-actuals?dryRun=1', {}, { timeout: NETSUITE_AXIOS_TIMEOUT_MS })
        this.nsLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Dry run generado (sin enviar a NetSuite).')
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en dry run.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsPushDryRun = false
      }
    },
    async runOperationalSync() {
      this.loadingNsOperationalSync = true
      this.nsOperationalLastResult = ''
      const delay = Number.isFinite(Number(this.nsOperationalDelaySeconds))
        ? Math.max(0, Math.min(120, Math.floor(Number(this.nsOperationalDelaySeconds))))
        : 10
      this.nsOperationalDelaySeconds = delay
      try {
        const res = await axios.post(
          '/chronometer/netsuite/sync-operational',
          { pull_delay_seconds: delay },
          { timeout: NETSUITE_AXIOS_TIMEOUT_MS }
        )
        this.nsOperationalLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Sincronizacion operativa completada.')
        await this.refreshBoard()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
        else await this.loadAreaOperations()
        await this.loadNsWipRows()
      } catch (error) {
        const d = error.response && error.response.data
        const fallback = !error.response ? this.netsuiteAxiosErrorPayload(error) : { message: error.message }
        this.nsOperationalLastResult = JSON.stringify(d || fallback, null, 2)
        const msg = (d && d.message) || (fallback && fallback.message) || 'Error en sincronizacion operativa.'
        this.showSnack(msg, 'error')
      } finally {
        this.loadingNsOperationalSync = false
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
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ops-table table th,
.ops-table table td {
  white-space: normal !important;
  vertical-align: middle;
}

.ops-meta,
.time-block {
  line-height: 1.2;
}

.time-bar-label {
  font-size: 11px;
  line-height: 1.2;
}

.time-bar-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #e0e0e0;
  overflow: hidden;
  margin-top: 2px;
  margin-bottom: 4px;
}

.time-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot--active {
  background: #2e7d32;
}

.status-dot--paused {
  background: #f9a825;
}

.status-dot--stopped {
  background: #c62828;
}

.status-dot--unknown {
  background: #9e9e9e;
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
  user-select: none;
}

.idle-board-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.idle-board-carousel-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 16px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.carousel-nav {
  opacity: 0.92;
}

.carousel-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 100px;
}

.carousel-page {
  font-size: 1.35rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.carousel-count {
  font-size: 0.72rem;
  color: #8b949e;
  letter-spacing: 0.02em;
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

/* Cuadrantes: tiempo muy grande â†’ OT â†’ operaciÃ³n â†’ recurso â†’ operario (mÃ¡s chico) */
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

.q-status {
  font-size: clamp(0.68rem, 1.8vw, 0.9rem);
  color: #c9d1d9;
  margin-bottom: 2px;
}

.q-metric-block {
  width: 90%;
  max-width: 520px;
  margin: 2px 0;
}

.q-qty {
  font-size: clamp(0.72rem, 2.1vw, 0.98rem);
  color: #c9d1d9;
  margin-bottom: 2px;
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
  cursor: pointer;
}

.idle-board-footer:hover {
  color: #8b949e;
  background: #0d1117;
}

.ns-json {
  max-height: 220px;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
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

.ns-wip-table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.ns-wip-table table th,
.ns-wip-table table td {
  font-size: 11px !important;
  white-space: nowrap;
}
</style>




