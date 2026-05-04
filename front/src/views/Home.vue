<template>
  <v-app>
    <!-- Tablero protector: siempre 2x2 visibles; si hay mas de 4 tareas, carrusel (flechas / teclado). -->
    <transition name="fade">
      <div
        v-if="showIdleBoard"
        class="idle-board-overlay"
        role="dialog"
        aria-modal="true"
      >
        <div class="idle-board-body" @click.stop>
          <div v-if="idleBoardTotalPages > 1" class="idle-board-carousel-bar">
            <v-btn icon dark large class="carousel-nav" aria-label="Pagina anterior" @click="idleBoardPrev">
              <v-icon large>mdi-chevron-left</v-icon>
            </v-btn>
            <div class="carousel-meta">
              <span class="carousel-page">{{ idleBoardSafePage + 1 }} / {{ idleBoardTotalPages }}</span>
              <span class="carousel-count">{{ idleActiveTimersSorted.length }} tareas · izquierda/derecha</span>
            </div>
            <v-btn icon dark large class="carousel-nav" aria-label="Pagina siguiente" @click="idleBoardNext">
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
                'idle-quadrant--paused': cell && cell.status === 'PAUSED',
                'idle-quadrant--phase-setup': cell && extractTimerMode(cell) === 'SETUP',
                'idle-quadrant--phase-run': cell && extractTimerMode(cell) !== 'SETUP'
              }"
            >
              <template v-if="cell">
                <div class="q-user">{{ quadrantOperatorName(cell) }}</div>
                <div class="q-op-line">{{ quadrantOperationLine(cell) }}</div>
                <div class="q-mode">{{ quadrantModeLabel(cell) }}</div>
                <div class="q-time" :style="quadrantTimeStyle(cell)">{{ formatElapsed(cell) }}</div>
                <div class="q-qty">{{ quadrantQtyText(cell) }}</div>
                <div class="q-progress-row">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                <div class="q-progress-track">
                  <div class="q-progress-fill" :style="quadrantProgressStyle(cell)" />
                </div>
                <div class="q-legend">
                  <span><span class="legend-dot legend-dot--green"></span>Verde 0% --- 90%</span>
                  <span><span class="legend-dot legend-dot--yellow"></span>Amarillo 90% --- 99%</span>
                  <span><span class="legend-dot legend-dot--red"></span>Rojo 100% --- +</span>
                </div>
              </template>
              <template v-else>
                <div class="empty-label">Libre</div>
                <div class="meta">Panel {{ idx + 1 }}</div>
              </template>
            </div>
          </div>
        </div>
        <div class="idle-board-footer" @click="closeIdleBoard">
          Toca aquí para cerrar · Esc · Carrusel cada {{ idleBoardCarouselSeconds }}s si hay varias paginas · Datos cada {{ boardPollSeconds }}s
        </div>
      </div>
    </transition>

    <appbar />
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <v-card outlined class="pa-4">
            <div class="chrono-header">
              <div class="chrono-brand">
                <img :src="logoSrc" alt="Logo Cronometro" class="chrono-logo" />
                <div class="chrono-brand-text">
                  <div class="chrono-title primary--text">CRONÓMETRO</div>
                  <div class="chrono-subtitle">Operación en planta</div>
                </div>
              </div>
              <div class="chrono-meta-grid">
                <div class="meta-item">
                  <span class="meta-label">Turno Activo</span>
                  <span class="meta-value">{{ activeShiftLabel }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Hora</span>
                  <span class="meta-value">{{ currentTimeHHMM }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Fin</span>
                  <span class="meta-value">{{ activeShiftEnd }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Operador</span>
                  <span class="meta-value">{{ operatorLabel }}</span>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <v-tabs v-model="activeTab" background-color="transparent" class="mb-4">
        <v-tab>Operación</v-tab>
        <v-tab v-if="isAdmin">Usuarios</v-tab>
        <v-tab v-if="isAdmin">Sistema</v-tab>
        <v-tab v-if="isAdmin">Reporte</v-tab>
        <v-tab v-if="isAdmin">Sincronización</v-tab>
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
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="d-flex flex-wrap align-center justify-space-between mb-2">
                  <div class="text-subtitle-1 font-weight-bold">Operaciones Activas</div>
                  <div class="d-flex flex-wrap align-center" style="gap: 8px">
                    <span class="grey--text text-caption">Protector 2x2 tras {{ idleBoardMinutes }} min; todas las tareas activas, carrusel si hay mas de 4.</span>
                    <v-btn small outlined color="primary" @click="openIdleBoardPreview">Ver tablero grande</v-btn>
                  </div>
                </div>
                <v-alert v-if="errorBoard" type="error" dense class="mb-3">{{ errorBoard }}</v-alert>
                <div v-if="activeBoard.length > 0" class="table-scroll-wrap active-wrap">
                  <v-simple-table class="compact-table dual-board-table">
                    <thead>
                      <tr>
                        <th>Orden de Trabajo</th>
                        <th>Secuencia</th>
                        <th>Operación</th>
                        <th>Recurso</th>
                        <th>Cantidad completada / entrada</th>
                        <th>MONTAJE</th>
                        <th>EJECUCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in activeBoard" :key="row.id">
                        <td>{{ extractOperation(row).ot_number || '-' }}</td>
                        <td>{{ extractOperation(row).operation_sequence || '-' }}</td>
                        <td>
                          <div>{{ extractOperation(row).operation_name || '-' }}</div>
                          <div class="lane-now" :class="rowStatusClass(row)">
                            {{ activeLaneText(row) }}
                          </div>
                        </td>
                        <td>{{ row.resource_code || '-' }}</td>
                        <td>{{ quantityProgressText(extractOperation(row)) }}</td>
                        <td>
                          <div class="lane-cell" :class="laneCellClass(row, 'setup')">
                            <div class="lane-actions">
                              <v-btn icon color="success" class="timer-btn-round" @click="laneTimerAction('setup', 'play', row)">
                                <v-icon small>mdi-play</v-icon>
                              </v-btn>
                              <v-btn icon color="warning" class="timer-btn-round" @click="laneTimerAction('setup', 'pause', row)">
                                <v-icon small>mdi-pause</v-icon>
                              </v-btn>
                              <v-btn icon color="error" class="timer-btn-round" @click="laneTimerAction('setup', 'stop', row)">
                                <v-icon small>mdi-stop</v-icon>
                              </v-btn>
                            </div>
                            <div class="lane-time">
                              {{ formatMinutesAsHHMMSS(extractOperation(row).actual_setup_time) }}
                              / {{ formatMinutesAsHHMMSS(extractOperation(row).planned_setup_minutes) }}
                            </div>
                            <div class="lane-live" v-if="isLaneCurrent(row, 'setup')">
                              En curso: {{ formatElapsed(row) }}
                            </div>
                            <div class="time-bar-track">
                              <div class="time-bar-fill" :style="timeBarStyle(extractOperation(row).actual_setup_time, extractOperation(row).planned_setup_minutes)" />
                            </div>
                            <div class="lane-percent">{{ formatPlanVsRealPercent(extractOperation(row).actual_setup_time, extractOperation(row).planned_setup_minutes) }}</div>
                          </div>
                        </td>
                        <td>
                          <div class="lane-cell" :class="laneCellClass(row, 'run')">
                            <div class="lane-actions">
                              <v-btn icon color="success" class="timer-btn-round" @click="laneTimerAction('run', 'play', row)">
                                <v-icon small>mdi-play</v-icon>
                              </v-btn>
                              <v-btn icon color="warning" class="timer-btn-round" @click="laneTimerAction('run', 'pause', row)">
                                <v-icon small>mdi-pause</v-icon>
                              </v-btn>
                              <v-btn icon color="error" class="timer-btn-round" @click="laneTimerAction('run', 'stop', row)">
                                <v-icon small>mdi-stop</v-icon>
                              </v-btn>
                            </div>
                            <div class="lane-time">
                              {{ formatMinutesAsHHMMSS(extractOperation(row).actual_run_time) }}
                              / {{ formatMinutesAsHHMMSS(extractOperation(row).planned_operation_minutes) }}
                            </div>
                            <div class="lane-live" v-if="isLaneCurrent(row, 'run')">
                              En curso: {{ formatElapsed(row) }}
                            </div>
                            <div class="time-bar-track">
                              <div class="time-bar-fill" :style="timeBarStyle(extractOperation(row).actual_run_time, extractOperation(row).planned_operation_minutes)" />
                            </div>
                            <div class="lane-percent">{{ formatPlanVsRealPercent(extractOperation(row).actual_run_time, extractOperation(row).planned_operation_minutes) }}</div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </v-simple-table>
                </div>
                <div v-else class="grey--text">No hay cronómetros activos.</div>
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-3">Operaciones de Tu Área</div>
                <v-alert v-if="errorOps" type="error" dense class="mb-3">{{ errorOps }}</v-alert>
                <v-alert v-if="!errorOps && emptyOpsHint" type="info" dense class="mb-3">{{ emptyOpsHint }}</v-alert>
                <div v-if="operations.length > 0" class="table-scroll-wrap area-wrap">
                  <v-simple-table class="compact-table dual-board-table">
                    <thead>
                      <tr>
                        <th>Orden de Trabajo</th>
                        <th>Secuencia</th>
                        <th>Operación</th>
                        <th>Recurso</th>
                        <th>Cantidad completada / entrada</th>
                        <th>MONTAJE</th>
                        <th>EJECUCIÓN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="op in operations" :key="op.id">
                        <td>{{ op.ot_number || '-' }}</td>
                        <td>{{ op.operation_sequence || '-' }}</td>
                        <td>{{ op.operation_name || '-' }}</td>
                        <td>{{ op.resource_code || '-' }}</td>
                        <td>{{ quantityProgressText(op) }}</td>
                        <td>
                          <div class="lane-cell">
                            <div class="lane-actions">
                              <v-btn icon color="success" class="timer-btn-round" @click="laneTimerAction('setup', 'play', op)">
                                <v-icon small>mdi-play</v-icon>
                              </v-btn>
                              <v-btn icon color="warning" class="timer-btn-round" @click="laneTimerAction('setup', 'pause', op)">
                                <v-icon small>mdi-pause</v-icon>
                              </v-btn>
                              <v-btn icon color="error" class="timer-btn-round" @click="laneTimerAction('setup', 'stop', op)">
                                <v-icon small>mdi-stop</v-icon>
                              </v-btn>
                            </div>
                            <div class="lane-time">
                              {{ formatMinutesAsHHMMSS(op.actual_setup_time) }} / {{ formatMinutesAsHHMMSS(op.planned_setup_minutes) }}
                            </div>
                            <div class="time-bar-track">
                              <div class="time-bar-fill" :style="timeBarStyle(op.actual_setup_time, op.planned_setup_minutes)" />
                            </div>
                            <div class="lane-percent">{{ formatPlanVsRealPercent(op.actual_setup_time, op.planned_setup_minutes) }}</div>
                          </div>
                        </td>
                        <td>
                          <div class="lane-cell">
                            <div class="lane-actions">
                              <v-btn icon color="success" class="timer-btn-round" @click="laneTimerAction('run', 'play', op)">
                                <v-icon small>mdi-play</v-icon>
                              </v-btn>
                              <v-btn icon color="warning" class="timer-btn-round" @click="laneTimerAction('run', 'pause', op)">
                                <v-icon small>mdi-pause</v-icon>
                              </v-btn>
                              <v-btn icon color="error" class="timer-btn-round" @click="laneTimerAction('run', 'stop', op)">
                                <v-icon small>mdi-stop</v-icon>
                              </v-btn>
                            </div>
                            <div class="lane-time">
                              {{ formatMinutesAsHHMMSS(op.actual_run_time) }} / {{ formatMinutesAsHHMMSS(op.planned_operation_minutes) }}
                            </div>
                            <div class="time-bar-track">
                              <div class="time-bar-fill" :style="timeBarStyle(op.actual_run_time, op.planned_operation_minutes)" />
                            </div>
                            <div class="lane-percent">{{ formatPlanVsRealPercent(op.actual_run_time, op.planned_operation_minutes) }}</div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </v-simple-table>
                </div>
                <div v-else class="grey--text">
                  {{ operationsMode === 'area' ? 'Sin operaciones cargadas para tu área.' : 'Sin operaciones cargadas.' }}
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
                <v-text-field v-model.trim="newUser.name" :counter="USER_RULES.nameMax" :maxlength="USER_RULES.nameMax" label="Nombre" dense outlined />
                <v-text-field v-model.trim="newUser.lastname" :counter="USER_RULES.lastnameMax" :maxlength="USER_RULES.lastnameMax" label="Apellido" dense outlined />
                <v-text-field v-model.trim="newUser.username" :counter="USER_RULES.usernameMax" :maxlength="USER_RULES.usernameMax" label="Usuario" dense outlined />
                <v-text-field v-model="newUser.password" :counter="USER_RULES.passwordLen" :maxlength="USER_RULES.passwordLen" label="Contraseña / PIN (4 dígitos)" dense outlined type="password" />
                <v-select v-model="newUser.RoleId" :items="roles" item-text="name" item-value="id" label="Rol" dense outlined />
                <v-select v-model="newUser.WorkplaceId" :items="workplacesUi" item-text="nameUi" item-value="id" label="Área" dense outlined />
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
                      <th>Área</th>
                      <th>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="u in users" :key="u.id">
                      <td>{{ u.name }} {{ u.lastname }}</td>
                      <td>{{ u.username }}</td>
                      <td>{{ u.Role && u.Role.name }}</td>
                      <td>{{ formatAreaName(u.Workplace && u.Workplace.name) }}</td>
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
                <div class="text-subtitle-1 font-weight-bold mb-2">Control de relojes</div>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Detiene relojes activos y pausados del alcance seleccionado.
                </p>
                <div class="d-flex flex-wrap mb-4" style="gap: 8px">
                  <v-btn color="error" :loading="loadingStopBatch === 'ALL'" @click="stopTimersBatch('ALL')">
                    Detener todos
                  </v-btn>
                  <v-btn color="warning" :loading="loadingStopBatch === 'ME'" @click="stopTimersBatch('ME')">
                    Detener Mecanizado
                  </v-btn>
                  <v-btn color="secondary" :loading="loadingStopBatch === 'ES'" @click="stopTimersBatch('ES')">
                    Detener Estructura
                  </v-btn>
                </div>

                <div class="text-subtitle-1 font-weight-bold mb-2">Cierres de turno automáticos</div>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Tres horarios (zona {{ shiftMeta.timezone || '-' }}). Se programan cron jobs en el servidor al guardar.
                  Los flags globales vienen de variables de entorno del API (<code>NS_SHIFT_BATCH_ENABLED</code>,
                  <code>NS_AUTO_STOP_AT_SHIFT_END</code>).
                </p>
                <v-sheet outlined class="pa-3 mb-3" style="border-radius: 10px; background: #fafafa;">
                  <div class="text-caption text-uppercase font-weight-medium grey--text text--darken-1 mb-2">
                    Estado del turno
                  </div>
                  <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="meta-item">
                      <span class="meta-label">Turno</span>
                      <span class="meta-value">{{ activeShiftLabel }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="meta-label">Hora actual</span>
                      <span class="meta-value">{{ currentTimeHHMM }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="meta-label">Fin</span>
                      <span class="meta-value">{{ activeShiftEnd }}</span>
                    </div>
                    <div class="meta-item">
                      <span class="meta-label">Operador</span>
                      <span class="meta-value">{{ operatorLabel }}</span>
                    </div>
                  </div>
                </v-sheet>
                <v-alert v-if="shiftMeta.shift_batch_enabled === false || shiftMeta.auto_stop_at_shift_end === false" type="warning" dense outlined class="mb-3">
                  El planificador está deshabilitado por configuración del servidor; igual puedes editar y guardar horarios para cuando se active.
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
                <div class="d-flex flex-wrap mb-3" style="gap: 8px">
                  <v-btn small color="error" :loading="loadingStopBatch === 'ALL'" @click="stopTimersBatch('ALL')">
                    Detener todos
                  </v-btn>
                  <v-btn small color="warning" :loading="loadingStopBatch === 'ME'" @click="stopTimersBatch('ME')">
                    Detener Mecanizado
                  </v-btn>
                  <v-btn small color="secondary" :loading="loadingStopBatch === 'ES'" @click="stopTimersBatch('ES')">
                    Detener Estructura
                  </v-btn>
                </div>
                <v-alert v-if="apiUrlBrokenOnHttps" type="error" dense prominent class="mb-3">
                  La app carga en <strong>HTTPS</strong> pero axios apunta a <code>{{ axiosBaseUrlDisplay }}</code>.
                  El navegador bloquea eso (mixed content) y verás <strong>Network Error</strong> al instante.
                  Rebuild del <strong>front</strong> con <code>VUE_APP_API_URL</code> apuntando al API HTTPS del ambiente y sin build-arg vacio en EasyPanel.
                </v-alert>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  URL API actual: <code>{{ axiosBaseUrlDisplay }}</code> · Origen web: <code>{{ browserOrigin }}</code>
                </p>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Pull: dataset <strong>MCV_cronometro_out</strong> (desde el navegador o con script en el host:
                  <code>backend/scripts/netsuite-pull-standalone.js</code>). Push: RESTlet IN. Variables <code>NETSUITE_*</code> en el API o en la máquina donde corras el script.
                </p>
                <v-btn class="mr-2 mb-2" small outlined :loading="loadingCorsPing" @click="testApiCorsPing">
                  Probar conexión API
                </v-btn>
                <v-btn class="mr-2 mb-2" small outlined :loading="loadingNsStatus" @click="loadNsStatus">Estado integración</v-btn>
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
                  label="Filtrar (OT, operación, recurso, área o estádo)"
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
                        <th>Área</th>
                        <th>Tiempo de montaje (HH:MM)</th>
                        <th>Tiempo de ejecución (HH:MM)</th>
                        <th>Cantidad de entrada</th>
                        <th>Tiempo de montaje real (HH:MM)</th>
                        <th>Tiempo de ejecución real (HH:MM)</th>
                        <th>Cantidad completada</th>
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
            <v-col cols="12">
              <v-card outlined class="pa-4">
                <div class="d-flex flex-wrap align-center justify-space-between mb-3" style="gap:12px">
                  <div>
                    <div class="text-subtitle-1 font-weight-bold">Reporte</div>
                    <p class="text-body-2 grey--text text--darken-1 mb-0">
                      Mismo listado WIP que MariaDB (NetSuite OUT), con estado de cronómetro y sync pendiente.
                      Ordena por columnas y exporta a Excel.
                    </p>
                  </div>
                  <div class="d-flex flex-wrap" style="gap:8px">
                    <v-btn color="primary" outlined :loading="reportView === 0 ? loadingReport : (reportView === 1 ? loadingSyncRuns : loadingNsPushLog)" @click="refreshReportCurrent">
                      <v-icon left>mdi-refresh</v-icon>
                      Actualizar
                    </v-btn>
                    <v-btn
                      v-if="reportView === 0"
                      color="secondary"
                      :disabled="!reportRows.length || loadingReport"
                      @click="exportReportExcel"
                    >
                      <v-icon left>mdi-microsoft-excel</v-icon>
                      Descargar Excel
                    </v-btn>
                  </div>
                </div>
                <v-tabs v-model="reportView" grow color="primary" slider-color="primary" class="mb-3">
                  <v-tab>Operaciones</v-tab>
                  <v-tab>Sincronizaciones</v-tab>
                  <v-tab>Log NetSuite</v-tab>
                </v-tabs>

                <div v-if="reportView === 0">
                  <v-alert v-if="reportError" type="error" dense outlined class="mb-3">{{ reportError }}</v-alert>
                  <v-data-table
                    :headers="reportHeaders"
                    :items="reportRows"
                    item-key="row_key"
                    :loading="loadingReport"
                    :options.sync="reportTableOptions"
                    :footer-props="{ itemsPerPageOptions: [25, 50, 100, 200, -1] }"
                    class="compact-table report-data-table elevation-0"
                    dense
                  >
                    <template v-slot:item.report_status_sort="{ item }">
                      {{ item.report_status_label }}
                    </template>
                    <template v-slot:item.timer_mode_sort="{ item }">
                      {{ formatReportTimerMode(item.timer_mode) }}
                    </template>
                    <template v-slot:item.planned_setup_minutes="{ item }">
                      {{ formatMinutesAsHHMM(item.planned_setup_minutes) }}
                    </template>
                    <template v-slot:item.planned_operation_minutes="{ item }">
                      {{ formatMinutesAsHHMM(item.planned_operation_minutes) }}
                    </template>
                    <template v-slot:item.actual_setup_time="{ item }">
                      {{ formatMinutesAsHHMM(item.actual_setup_time) }}
                    </template>
                    <template v-slot:item.actual_run_time="{ item }">
                      {{ formatMinutesAsHHMM(item.actual_run_time) }}
                    </template>
                    <template v-slot:item.netsuite_operation_id="{ item }">
                      {{ item.netsuite_operation_id != null && item.netsuite_operation_id !== '' ? item.netsuite_operation_id : '—' }}
                    </template>
                    <template v-slot:item.sync_pending_sort="{ item }">
                      {{ item.sync_pending ? 'Sí' : 'No' }}
                    </template>
                    <template v-slot:item.operator="{ item }">
                      {{ item.operator || '—' }}
                    </template>
                    <template v-slot:item.station_id="{ item }">
                      {{ item.station_id || '—' }}
                    </template>
                    <template v-slot:item.last_event_at="{ item }">
                      {{ formatReportDate(item.last_event_at) }}
                    </template>
                    <template v-slot:item.total_elapsed_seconds="{ item }">
                      {{ item.total_elapsed_seconds != null ? formatElapsedFromSeconds(item.total_elapsed_seconds) : '—' }}
                    </template>
                    <template v-slot:no-data>
                      <div class="py-6 text-center grey--text">
                        No hay operaciones WIP cargadas o aún no se cargó el reporte.</div>
                    </template>
                  </v-data-table>
                </div>

                <div v-else-if="reportView === 1">
                  <v-alert v-if="syncRunsError" type="error" dense outlined class="mb-3">{{ syncRunsError }}</v-alert>
                  <v-data-table
                    :headers="syncRunHeaders"
                    :items="syncRuns"
                    item-key="id"
                    dense
                    class="compact-table elevation-0"
                    :loading="loadingSyncRuns"
                    :footer-props="{ itemsPerPageOptions: [10, 25, 50, 100] }"
                  >
                    <template v-slot:item.status="{ item }">
                      <v-chip small :color="syncRunChipColor(item)" dark>{{ item.status }}</v-chip>
                    </template>
                    <template v-slot:item.warning="{ item }">
                      <span v-if="item.warning" class="warning--text font-weight-bold">Sí</span>
                      <span v-else>—</span>
                    </template>
                    <template v-slot:item.started_at="{ item }">
                      {{ formatReportDate(item.started_at) }}
                    </template>
                    <template v-slot:item.duration_ms="{ item }">
                      {{ item.duration_ms != null ? `${Math.round(item.duration_ms / 1000)}s` : '—' }}
                    </template>
                    <template v-slot:item.actions="{ item }">
                      <v-btn x-small color="primary" outlined @click="openSyncRunDetail(item)">Ver detalle</v-btn>
                    </template>
                    <template v-slot:no-data>
                      <div class="py-6 text-center grey--text">No hay sincronizaciones registradas.</div>
                    </template>
                  </v-data-table>
                </div>
                <div v-else>
                  <v-alert v-if="nsPushLogError" type="error" dense outlined class="mb-3">{{ nsPushLogError }}</v-alert>
                  <v-data-table
                    :headers="nsPushLogHeaders"
                    :items="nsPushLogRows"
                    item-key="row_key"
                    dense
                    class="compact-table elevation-0"
                    :loading="loadingNsPushLog"
                    :footer-props="{ itemsPerPageOptions: [25, 50, 100, 200] }"
                  >
                    <template v-slot:item.push_at="{ item }">
                      {{ formatReportDate(item.push_at) }}
                    </template>
                    <template v-slot:item.operation_name="{ item }">
                      {{ item.operation_name || '—' }}
                    </template>
                    <template v-slot:item.sync_status="{ item }">
                      <v-chip x-small :color="item.sync_status === 'SUCCESS' ? 'success' : (item.sync_status === 'ERROR' ? 'error' : 'grey')" dark>
                        {{ item.sync_status || 'UNKNOWN' }}
                      </v-chip>
                    </template>
                    <template v-slot:item.sync_message="{ item }">
                      {{ item.sync_message || '—' }}
                    </template>
                    <template v-slot:no-data>
                      <div class="py-6 text-center grey--text">No hay filas de push registradas.</div>
                    </template>
                  </v-data-table>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-tab-item>
        <v-tab-item v-if="isAdmin">
          <v-row>
            <v-col cols="12" md="8">
              <v-card outlined class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-2">Sincronización operativa</div>
                <p class="text-body-2 grey--text text--darken-1 mb-3">
                  Flujo: detener todos los relojes -> push a NetSuite -> esperar -> pull + replace desde NetSuite.
                </p>
                <v-alert type="warning" dense outlined class="mb-3">
                  Esta sincronización puede demorar hasta 3 minutos.
                </v-alert>
                <v-text-field
                  v-model.number="nsOperationalDelaySeconds"
                  label="Espera entre push y pull (segundos)"
                  hint="Recomendación: 10–20s normal. Usa 60s si hay muchos relojes o el push tarda más."
                  persistent-hint
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
                  Ejecutar cierre + sincronización
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
        <v-card-title class="text-h6">Detener cronómetro</v-card-title>
        <v-card-text>
          <p class="body-2 mb-3">
            Puedes registrar la <strong>cantidad terminada</strong> de esta operación al cerrar. Si no cargas nada, solo se detiene el cronómetro y no se cambia el valor en base.
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
          <v-alert
            v-if="stopQtyWarningText"
            type="warning"
            dense
            outlined
            class="mt-3 mb-0"
          >
            {{ stopQtyWarningText }}
          </v-alert>
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
          <v-text-field v-model.trim="editUser.name" :counter="USER_RULES.nameMax" :maxlength="USER_RULES.nameMax" label="Nombre" dense outlined />
          <v-text-field v-model.trim="editUser.lastname" :counter="USER_RULES.lastnameMax" :maxlength="USER_RULES.lastnameMax" label="Apellido" dense outlined />
          <v-text-field v-model.trim="editUser.username" :counter="USER_RULES.usernameMax" :maxlength="USER_RULES.usernameMax" label="Usuario" dense outlined />
          <v-text-field v-model="editUser.password" :counter="USER_RULES.passwordLen" :maxlength="USER_RULES.passwordLen" label="Nueva contraseña / PIN (opcional, 4 dígitos)" dense outlined type="password" />
          <v-select v-model="editUser.RoleId" :items="roles" item-text="name" item-value="id" label="Rol" dense outlined />
          <v-select v-model="editUser.WorkplaceId" :items="workplacesUi" item-text="nameUi" item-value="id" label="Área" dense outlined />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text :disabled="loadingEditUser" @click="closeEditUserDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="loadingEditUser" @click="saveEditUser">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="syncRunDetailDialog" max-width="900">
      <v-card>
        <v-card-title class="text-h6">Detalle de sincronización</v-card-title>
        <v-card-text>
          <div class="text-caption grey--text mb-2" v-if="syncRunDetail">
            ID {{ syncRunDetail.id }} · {{ formatReportDate(syncRunDetail.started_at) }} · {{ syncRunDetail.flow_type }} · {{ syncRunDetail.status }}
          </div>
          <div v-if="syncRunDetail && syncRunDetail.summary_json" class="mb-3">
            <div class="text-subtitle-2 font-weight-bold mb-1">Resumen</div>
            <pre class="sync-json">{{ prettyJson(syncRunDetail.summary_json) }}</pre>
          </div>
          <v-simple-table dense v-if="syncRunDetailSteps.length">
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Duración</th>
                <th>Resultado</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in syncRunDetailSteps"
                :key="'step-' + s.id"
                style="cursor:pointer"
                @click="selectedSyncRunStep = s"
              >
                <td class="font-weight-medium">{{ s.step_name }}</td>
                <td>{{ s.status }}</td>
                <td>{{ formatReportDate(s.started_at) }}</td>
                <td>{{ s.duration_ms != null ? `${Math.round(s.duration_ms / 1000)}s` : '—' }}</td>
                <td class="text-caption" style="max-width:260px; white-space:normal;">
                  {{ s.result_json ? 'Ver' : '—' }}
                </td>
                <td class="text-caption" style="max-width:420px; white-space:normal;">
                  {{ s.error_message || '—' }}
                </td>
              </tr>
            </tbody>
          </v-simple-table>
          <div v-else class="grey--text">Sin detalle.</div>

          <div v-if="selectedSyncRunStep && selectedSyncRunStep.result_json" class="mt-3">
            <div class="text-subtitle-2 font-weight-bold mb-1">
              Resultado etapa {{ selectedSyncRunStep.step_name }}
            </div>
            <pre class="sync-json">{{ prettyJson(selectedSyncRunStep.result_json) }}</pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="syncRunDetailDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-app>
</template>

<script>
import axios from 'axios'
import orderBy from 'lodash/orderBy'
import ExcelJS from 'exceljs'
import '@mdi/font/css/materialdesignicons.css'
import appbar from '@/components/navegation/appbar.vue'
import logoCronometro from '@/assets/at-once-logo.png'
import { mapGetters } from 'vuex'

/** Pull/push NetSuite suele tardar >20s; el timeout global de axios en main.js es corto. */
const NETSUITE_AXIOS_TIMEOUT_MS = 180000
const USER_RULES = Object.freeze({
  nameMax: 40,
  lastnameMax: 40,
  usernameMax: 24,
  passwordLen: 4
})

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
      loadingStopBatch: '',
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
      stopQtyPlanned: null,
      stopQtyLoading: false,
      shiftSlotsDraft: [
        { sequence: 1, hhmm: '08:00', enabled: true },
        { sequence: 2, hhmm: '17:00', enabled: true },
        { sequence: 3, hhmm: '03:00', enabled: false }
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
      nsOperationalDelaySeconds: 60,
      opsColWidths: {
        ot: 22,
        resource: 15,
        status: 10,
        times: 31,
        quantity: 10,
        area: 6,
        action: 6
      },
      opsColOrder: ['ot', 'resource', 'status', 'times', 'quantity', 'area', 'action'],
      opsResizeState: null,
      nsWipRows: [],
      nsWipRowsError: '',
      nsWipFilter: '',
      reportRows: [],
      loadingReport: false,
      reportError: '',
      reportView: 0,
      syncRuns: [],
      loadingSyncRuns: false,
      syncRunsError: '',
      nsPushLogRows: [],
      loadingNsPushLog: false,
      nsPushLogError: '',
      syncRunHeaders: [
        { text: 'Inicio', value: 'started_at', sortable: true },
        { text: 'Tipo', value: 'flow_type', sortable: true },
        { text: 'Trigger', value: 'trigger', sortable: true },
        { text: 'Estado', value: 'status', sortable: true },
        { text: 'Warning', value: 'warning', sortable: true },
        { text: 'Duración', value: 'duration_ms', sortable: true, align: 'end' },
        { text: 'Acción', value: 'actions', sortable: false }
      ],
      nsPushLogHeaders: [
        { text: 'Fecha push', value: 'push_at', sortable: true },
        { text: 'SyncRunId', value: 'sync_run_id', sortable: true, align: 'end' },
        { text: 'OT', value: 'ot_number', sortable: true },
        { text: 'Seq', value: 'operation_sequence', sortable: true, align: 'end' },
        { text: 'Operacion', value: 'operation_name', sortable: true },
        { text: 'Recurso', value: 'resource_code', sortable: true },
        { text: 'Area', value: 'area', sortable: true },
        { text: 'T_mon_base', value: 't_mon_base', sortable: true, align: 'end' },
        { text: 'T_mon_enviado', value: 't_mon_enviado', sortable: true, align: 'end' },
        { text: 'T_mon_netsuite', value: 't_mon_netsuite', sortable: true, align: 'end' },
        { text: 'T_eje_base', value: 't_eje_base', sortable: true, align: 'end' },
        { text: 'T_eje_enviado', value: 't_eje_enviado', sortable: true, align: 'end' },
        { text: 'T_eje_netsuite', value: 't_eje_netsuite', sortable: true, align: 'end' },
        { text: 'Qty_base', value: 'qty_base', sortable: true, align: 'end' },
        { text: 'Qty_enviado', value: 'qty_enviado', sortable: true, align: 'end' },
        { text: 'Qty_netsuite', value: 'qty_netsuite', sortable: true, align: 'end' },
        { text: 'Estado', value: 'sync_status', sortable: true },
        { text: 'Detalle', value: 'sync_message', sortable: true }
      ],
      syncRunDetailDialog: false,
      syncRunDetail: null,
      syncRunDetailSteps: [],
      selectedSyncRunStep: null,
      reportTableOptions: {
        page: 1,
        itemsPerPage: 50,
        sortBy: ['ot_number'],
        sortDesc: [false]
      },
      reportHeaders: [
        { text: 'Estado cronómetro', value: 'report_status_sort', sortable: true },
        { text: 'Modo', value: 'timer_mode_sort', sortable: true },
        { text: 'OT', value: 'ot_number', sortable: true },
        { text: 'Seq', value: 'operation_sequence', sortable: true, align: 'end' },
        { text: 'Operación', value: 'operation_name', sortable: true },
        { text: 'Recurso', value: 'resource_code', sortable: true },
        { text: 'Área', value: 'area', sortable: true },
        { text: 'Tiempo de montaje', value: 'planned_setup_minutes', sortable: true, align: 'end' },
        { text: 'Tiempo de ejecución', value: 'planned_operation_minutes', sortable: true, align: 'end' },
        { text: 'Cantidad de entrada', value: 'planned_quantity', sortable: true, align: 'end' },
        { text: 'Tiempo de montaje real', value: 'actual_setup_time', sortable: true, align: 'end' },
        { text: 'Tiempo de ejecución real', value: 'actual_run_time', sortable: true, align: 'end' },
        { text: 'Cantidad completada', value: 'completed_quantity', sortable: true, align: 'end' },
        { text: 'NS Op ID', value: 'netsuite_operation_id', sortable: true },
        { text: 'Estado NS', value: 'source_status', sortable: true },
        { text: 'Sync pend.', value: 'sync_pending_sort', sortable: true, align: 'center' },
        { text: 'Operario', value: 'operator', sortable: true },
        { text: 'Terminal', value: 'station_id', sortable: true },
        { text: 'Último evento', value: 'last_event_at', sortable: true },
        { text: 'Tiempo acum.', value: 'total_elapsed_seconds', sortable: true, align: 'end' }
      ],
      snackbar: false,
      snackbarText: '',
      snackbarColor: 'success',
      logoSrc: logoCronometro,
      USER_RULES
    }
  },
  created() {
    this.applyRouteTab()
    this.refreshBoard()
    this.loadAreaOperations()
    this.clockInterval = setInterval(() => { this.nowTick = Date.now() }, 1000)
    this.$nextTick(() => {
      if (this.isAdmin && this.tabKeyByIndex(this.activeTab) === 'reporte') this.refreshReportCurrent()
    })
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
    this.stopOpsColumnResize()
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
    },
    '$route.query.tab'() {
      this.applyRouteTab()
    },
    reportView(val) {
      // 0 = Operaciones, 1 = Sincronizaciones, 2 = Log NetSuite
      if (!this.isAdmin) return
      if (val === 0) this.loadReportBoard()
      else if (val === 1) this.loadSyncRuns()
      else if (val === 2) this.loadNsPushLog()
    },
    activeTab() {
      this.syncRouteTab()
      if (this.isAdmin && this.tabKeyByIndex(this.activeTab) === 'reporte') this.refreshReportCurrent()
    }
  },
  computed: {
    ...mapGetters({
      user: 'auth/user',
      isAdmin: 'auth/isAdmin'
    }),
    workplacesUi() {
      const rows = Array.isArray(this.workplaces) ? this.workplaces : []
      return rows
        .filter((w) => {
          const raw = w && w.name != null ? String(w.name).trim().toUpperCase() : ''
          return raw !== 'IN'
        })
        .map((w) => {
          const raw = w && w.name != null ? String(w.name).trim().toUpperCase() : ''
          const isTodos = raw === 'ALL' || raw === 'BOTH'
          return { ...w, nameUi: isTodos ? 'Todos' : (w && w.name ? String(w.name) : '') }
        })
    },
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
    operatorLabel() {
      if (!this.user) return '-'
      const name = [this.user.name, this.user.lastname].filter(Boolean).join(' ').trim()
      return name || '-'
    },
    activeShiftData() {
      // Modo operativo simplificado: 2 turnos fijos.
      // Turno 1 termina 17:00, Turno 2 termina 03:00.
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()
      const endTurn1 = 17 * 60 // 17:00
      const endTurn2 = 3 * 60 // 03:00

      const isTurn1 = nowMinutes >= endTurn2 && nowMinutes < endTurn1
      if (isTurn1) {
        return { label: 'Turno 1', end: '17:00' }
      }
      return { label: 'Turno 2', end: '03:00' }
    },
    activeShiftLabel() {
      return this.activeShiftData.label
    },
    activeShiftEnd() {
      return this.activeShiftData.end
    },
    currentTimeHHMM() {
      try {
        return new Intl.DateTimeFormat('es-CL', {
          timeZone: 'America/Santiago',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date(this.nowTick || Date.now()))
      } catch (e) {
        const d = new Date(this.nowTick || Date.now())
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      }
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
    },
    stopQtyWarningText() {
      const raw = String(this.stopQtyValue || '').trim()
      if (!raw || !/^\d+$/.test(raw)) return ''
      const planned = Number(this.stopQtyPlanned)
      if (!Number.isFinite(planned) || planned < 0) return ''
      if (Number(raw) > planned) return 'Esta cantidad supera lo requerido'
      return ''
    },
    opsTableCols() {
      const col = this.opsColWidths || {}
      return {
        ot: `${Number(col.ot || 22).toFixed(2)}%`,
        resource: `${Number(col.resource || 15).toFixed(2)}%`,
        status: `${Number(col.status || 10).toFixed(2)}%`,
        times: `${Number(col.times || 31).toFixed(2)}%`,
        quantity: `${Number(col.quantity || 10).toFixed(2)}%`,
        area: `${Number(col.area || 6).toFixed(2)}%`,
        action: `${Number(col.action || 6).toFixed(2)}%`
      }
    },
    boardCols() {
      return {
        ot: '9%',
        operation: '12%',
        resource: '14%',
        area: '6%',
        times: '34%',
        quantity: '9%',
        status: '8%',
        user: '8%'
      }
    }
  },
  methods: {
    formatAreaName(name) {
      const raw = name != null ? String(name).trim().toUpperCase() : ''
      if (raw === 'IN') return 'Todos'
      if (raw === 'ALL' || raw === 'BOTH') return 'Todos'
      return name != null ? String(name) : '—'
    },
    validateUserDraft(user, { requirePassword }) {
      const name = String((user && user.name) || '').trim()
      const lastname = String((user && user.lastname) || '').trim()
      const username = String((user && user.username) || '').trim()
      const password = String((user && user.password) || '').trim()
      const roleId = user && user.RoleId
      const workplaceId = user && user.WorkplaceId

      if (!name) return 'Nombre es obligatorio.'
      if (name.length > USER_RULES.nameMax) return `Nombre excede ${USER_RULES.nameMax} caracteres.`

      if (!lastname) return 'Apellido es obligatorio.'
      if (lastname.length > USER_RULES.lastnameMax) return `Apellido excede ${USER_RULES.lastnameMax} caracteres.`

      if (!username) return 'Usuario es obligatorio.'
      if (username.length > USER_RULES.usernameMax) return `Usuario excede ${USER_RULES.usernameMax} caracteres.`
      if (!/^[A-Za-z0-9._-]+$/.test(username)) {
        return 'Usuario solo permite letras, números, punto, guion y guion bajo.'
      }

      if (!(Number.isInteger(Number(roleId)) && Number(roleId) > 0)) return 'Rol inválido.'
      if (!(Number.isInteger(Number(workplaceId)) && Number(workplaceId) > 0)) return 'Área inválida.'

      if (requirePassword || password) {
        if (!/^\d{4}$/.test(password)) {
          return 'Contraseña / PIN debe tener exactamente 4 dígitos.'
        }
      }

      return ''
    },
    tabIndexByKey(keyRaw) {
      const key = String(keyRaw || '').toLowerCase()
      if (key === 'operacion') return 0
      if (key === 'usuarios') return this.isAdmin ? 1 : 0
      if (key === 'sistema') return this.isAdmin ? 2 : 0
      if (key === 'reporte') return this.isAdmin ? 3 : 0
      if (key === 'sincronizacion') return this.isAdmin ? 4 : 0
      return 0
    },
    tabKeyByIndex(indexRaw) {
      const index = Number(indexRaw || 0)
      if (index === 0) return 'operacion'
      if (index === 1 && this.isAdmin) return 'usuarios'
      if (index === 2 && this.isAdmin) return 'sistema'
      if (index === 3 && this.isAdmin) return 'reporte'
      if (index === 4 && this.isAdmin) return 'sincronizacion'
      return 'operacion'
    },
    applyRouteTab() {
      const routeTab = this.$route && this.$route.query ? this.$route.query.tab : null
      const next = this.tabIndexByKey(routeTab)
      if (this.activeTab !== next) this.activeTab = next
    },
    syncRouteTab() {
      if (!this.$route || this.$route.name !== 'Home') return
      const nextTab = this.tabKeyByIndex(this.activeTab)
      const current = String((this.$route.query && this.$route.query.tab) || '')
      if (current === nextTab) return
      this.$router.replace({
        name: 'Home',
        query: { ...this.$route.query, tab: nextTab }
      })
    },
    resetOpsLayout() {
      this.opsColWidths = {
        ot: 22,
        resource: 15,
        status: 10,
        times: 31,
        quantity: 10,
        area: 6,
        action: 6
      }
    },
    opsColMinPct(key) {
      const min = {
        ot: 12,
        resource: 9,
        status: 7,
        times: 18,
        quantity: 8,
        area: 6,
        action: 6
      }
      return min[key] || 6
    },
    startOpsColumnResize(key, event) {
      const order = this.opsColOrder || []
      const i = order.indexOf(key)
      if (i < 0 || i >= order.length - 1) return
      const nextKey = order[i + 1]
      const tableEl = this.$refs.opsTable && this.$refs.opsTable.$el ? this.$refs.opsTable.$el : null
      const widthPx = tableEl ? tableEl.getBoundingClientRect().width : 0
      if (!widthPx) return
      this.opsResizeState = {
        key,
        nextKey,
        startX: Number(event.clientX || 0),
        widthPx,
        startCurrent: Number(this.opsColWidths[key] || 0),
        startNext: Number(this.opsColWidths[nextKey] || 0)
      }
      window.addEventListener('mousemove', this.onOpsColumnResize)
      window.addEventListener('mouseup', this.stopOpsColumnResize)
      document.body.classList.add('ops-resizing')
    },
    onOpsColumnResize(event) {
      if (!this.opsResizeState) return
      const state = this.opsResizeState
      const deltaPx = Number(event.clientX || 0) - state.startX
      const deltaPct = (deltaPx / state.widthPx) * 100
      const minCurrent = this.opsColMinPct(state.key)
      const minNext = this.opsColMinPct(state.nextKey)
      const maxGrow = state.startNext - minNext
      const maxShrink = minCurrent - state.startCurrent
      const clampedDelta = Math.max(maxShrink, Math.min(maxGrow, deltaPct))
      const current = Number((state.startCurrent + clampedDelta).toFixed(2))
      const next = Number((state.startNext - clampedDelta).toFixed(2))
      this.opsColWidths = {
        ...this.opsColWidths,
        [state.key]: current,
        [state.nextKey]: next
      }
    },
    stopOpsColumnResize() {
      this.opsResizeState = null
      window.removeEventListener('mousemove', this.onOpsColumnResize)
      window.removeEventListener('mouseup', this.stopOpsColumnResize)
      document.body.classList.remove('ops-resizing')
    },
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
    quadrantOperatorName(cell) {
      if (!cell) return '-'
      const op = this.quadrantLinkedOp(cell) || {}
      const direct =
        String(cell.operator || '').trim() ||
        String(op.operator || '').trim() ||
        String(op.operator_name || '').trim()
      if (direct) return direct
      if (cell.User) {
        const full = `${cell.User.name || ''} ${cell.User.lastname || ''}`.trim()
        if (full) return full
      }
      return '-'
    },
    quadrantModeLabel(cell) {
      return this.extractTimerMode(cell) === 'SETUP' ? 'MONTAJE' : 'EJECUCIÓN'
    },
    quadrantOperationLine(cell) {
      const op = this.quadrantLinkedOp(cell) || {}
      const ot = String(op.ot_number || '-').trim() || '-'
      const seq = String(op.operation_sequence != null ? op.operation_sequence : '-').trim() || '-'
      const name = String(op.operation_name || '-').trim() || '-'
      const resource = String((cell && cell.resource_code) || op.resource_code || '-').trim() || '-'
      return `${ot}-${seq}-${name}-${resource}`
    },
    quadrantQtyText(cell) {
      const op = this.quadrantLinkedOp(cell) || {}
      const completed = op.completed_quantity != null ? op.completed_quantity : '-'
      const planned = op.planned_quantity != null ? op.planned_quantity : '-'
      return `${completed}/${planned}`
    },
    quadrantProgressStyle(cell) {
      const op = this.quadrantLinkedOp(cell)
      const mode = this.extractTimerMode(cell)
      const real = Number(mode === 'SETUP' ? (op && op.actual_setup_time) : (op && op.actual_run_time)) || 0
      const plan = Number(mode === 'SETUP' ? (op && op.planned_setup_minutes) : (op && op.planned_operation_minutes)) || 0
      if (!Number.isFinite(plan) || plan <= 0) return { width: '0%', backgroundColor: '#9e9e9e' }
      const ratio = Math.max(0, real) / plan
      const pct = Math.min(200, Math.round(ratio * 100))
      let color = '#4caf50'
      if (ratio >= 1) color = '#ef5350'
      else if (ratio >= 0.9) color = '#ffca28'
      return { width: `${pct}%`, backgroundColor: color }
    },
    statusLabel(status) {
      const s = String(status || '').toUpperCase()
      if (s === 'ACTIVE') return 'Activo'
      if (s === 'PAUSED') return 'Pausa'
      if (s === 'STOPPED') return 'Detenido'
      return s || '-'
    },
    statusIcon(status) {
      const s = String(status || '').toUpperCase()
      if (s === 'ACTIVE') return 'mdi-play-circle'
      if (s === 'PAUSED') return 'mdi-pause-circle'
      if (s === 'STOPPED') return 'mdi-stop-circle'
      return 'mdi-help-circle'
    },
    statusColor(status) {
      const s = String(status || '').toUpperCase()
      if (s === 'ACTIVE') return 'success'
      if (s === 'PAUSED') return 'warning'
      if (s === 'STOPPED') return 'error'
      return 'grey'
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
    formatMinutesAsHHMMSS(totalMinutes) {
      if (totalMinutes == null || totalMinutes === '') return '-'
      const n = Number(totalMinutes)
      if (!Number.isFinite(n)) return '-'
      const totalSeconds = Math.max(0, Math.floor(n * 60))
      const hrs = Math.floor(totalSeconds / 3600)
      const mins = Math.floor((totalSeconds % 3600) / 60)
      const secs = totalSeconds % 60
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
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
      if (ratio >= 1) color = '#ef5350'
      else if (ratio >= 0.9) color = '#ff9800'
      return { width: `${pct}%`, backgroundColor: color }
    },
    quadrantTimeStyle(timer) {
      const op = this.quadrantLinkedOp(timer)
      const mode = this.extractTimerMode(timer)
      const real = Number(mode === 'SETUP' ? (op && op.actual_setup_time) : (op && op.actual_run_time)) || 0
      const plan = Number(mode === 'SETUP' ? (op && op.planned_setup_minutes) : (op && op.planned_operation_minutes)) || 0
      if (!Number.isFinite(plan) || plan <= 0) return { color: '#e6edf3' }
      const ratio = Math.max(0, real) / plan
      if (ratio >= 1) return { color: '#ef5350' }
      if (ratio >= 0.9) return { color: '#ffca28' }
      return { color: '#4caf50' }
    },
    extractOperation(item) {
      if (item && item.WorkOrderOperation) return item.WorkOrderOperation
      return item || {}
    },
    extractStatus(item) {
      return String((item && item.status) || 'STOPPED').toUpperCase()
    },
    extractTimerMode(item) {
      return String((item && item.timer_mode) || 'RUN').toUpperCase()
    },
    isLaneCurrent(item, lane) {
      const status = this.extractStatus(item)
      const mode = this.extractTimerMode(item)
      const wanted = lane === 'setup' ? 'SETUP' : 'RUN'
      return (status === 'ACTIVE' || status === 'PAUSED') && mode === wanted
    },
    laneCellClass(item, lane) {
      const status = this.extractStatus(item)
      if (!this.isLaneCurrent(item, lane)) return 'lane-idle'
      if (status === 'ACTIVE') return 'lane-current lane-current--active'
      if (status === 'PAUSED') return 'lane-current lane-current--paused'
      return 'lane-idle'
    },
    activeLaneText(item) {
      const status = this.extractStatus(item)
      const mode = this.extractTimerMode(item)
      if (status === 'ACTIVE') return mode === 'SETUP' ? 'Cronometrando ahora: MONTAJE' : 'Cronometrando ahora: EJECUCIÓN'
      if (status === 'PAUSED') return mode === 'SETUP' ? 'Pausado en: MONTAJE' : 'Pausado en: EJECUCIÓN'
      return 'Detenido'
    },
    rowStatusClass(item) {
      const status = this.extractStatus(item)
      if (status === 'ACTIVE') return 'lane-now--active'
      if (status === 'PAUSED') return 'lane-now--paused'
      return 'lane-now--stopped'
    },
    quantityProgressText(op) {
      const completed = Number(op && op.completed_quantity)
      const planned = Number(op && op.planned_quantity)
      const left = Number.isFinite(completed) ? Math.max(0, Math.floor(completed)) : '-'
      const right = Number.isFinite(planned) ? Math.max(0, Math.floor(planned)) : '-'
      if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(completed)) return `${left} / ${right}`
      const pct = Math.max(0, Math.round((Math.max(0, completed) / planned) * 100))
      return `${left} / ${right} / ${pct}%`
    },
    async laneTimerAction(lane, action, item) {
      const op = this.extractOperation(item)
      if (!op || !op.id) return
      if (action === 'stop') {
        if (lane === 'run') {
          this.openStopQuantityDialog(op)
          return
        }
        try {
          await axios.post('/chronometer/timers/stop', { work_order_operation_id: op.id })
          await this.refreshBoard()
          const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
          if (digits) await this.buscarOperaciones()
          else await this.loadAreaOperations()
        } catch (error) {
          const msg = (error.response && error.response.data && (error.response.data.message || error.response.data.text)) || 'No fue posible detener el cronómetro.'
          alert(msg)
        }
        return
      }

      const mode = lane === 'setup' ? 'SETUP' : 'RUN'
      const status = this.extractStatus(item)
      try {
        if (action === 'play') {
          if (status === 'ACTIVE') {
            await axios.post('/chronometer/timers/mode', {
              work_order_operation_id: op.id,
              timer_mode: mode
            })
          } else if (status === 'PAUSED') {
            await axios.post('/chronometer/timers/mode', {
              work_order_operation_id: op.id,
              timer_mode: mode
            })
            await axios.post('/chronometer/timers/resume', {
              work_order_operation_id: op.id,
              timer_mode: mode
            })
          } else {
            await axios.post('/chronometer/timers/start', {
              work_order_operation_id: op.id,
              timer_mode: mode
            })
          }
        } else if (action === 'pause') {
          await axios.post('/chronometer/timers/pause', { work_order_operation_id: op.id })
        }
        await this.refreshBoard()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
        else await this.loadAreaOperations()
      } catch (error) {
        const msg = (error.response && error.response.data && (error.response.data.message || error.response.data.text)) || `No fue posible ejecutar ${action}.`
        alert(msg)
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
      const validationError = this.validateUserDraft(this.newUser, { requirePassword: true })
      if (validationError) {
        alert(validationError)
        return
      }
      this.loadingCreateUser = true
      try {
        await axios.post('/auth/signup', this.newUser)
        this.newUser = { name: '', lastname: '', username: '', password: '', RoleId: this.newUser.RoleId, WorkplaceId: this.newUser.WorkplaceId }
        await this.loadAdminCatalogs()
        alert('Usuario creado.')
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || 'No fue posible crear el usuario.'
        alert(msg)
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
        alert('Completa nombre, apellido, usuario, rol y área.')
        return
      }
      const validationError = this.validateUserDraft(this.editUser, { requirePassword: false })
      if (validationError) {
        alert(validationError)
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
            'No hay operaciones para esta OT en tu área o la OT no está cargada. Con datos de prueba: Seed WIP o POST upsert (ver backend/scripts) y busca OT1 … OT9.'
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
          this.emptyOpsHint = 'No hay operaciones disponibles en tu área.'
        }
      } catch (error) {
        const d = error.response && error.response.data
        let msg = 'No fue posible cargar operaciones del área.'
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
    async loadReportBoard() {
      if (!this.isAdmin) return
      this.loadingReport = true
      this.reportError = ''
      try {
        const res = await axios.get('/chronometer/board/report', { params: { limit: 500 } })
        const raw = res.data && res.data.rows
        this.reportRows = Array.isArray(raw) ? raw : []
      } catch (e) {
        this.reportRows = []
        this.reportError =
          (e.response && e.response.data && (e.response.data.message || e.response.data.text)) ||
          'No fue posible cargar el reporte.'
      } finally {
        this.loadingReport = false
      }
    },
    formatReportTimerMode(mode) {
      if (mode == null || mode === '') return '—'
      const u = String(mode).toUpperCase()
      if (u === 'SETUP') return 'Configuración'
      if (u === 'RUN') return 'Producción'
      return String(mode)
    },
    formatReportDate(iso) {
      if (!iso) return '—'
      const d = new Date(iso)
      if (!Number.isFinite(d.getTime())) return '—'
      try {
        return new Intl.DateTimeFormat('es-CL', {
          timeZone: 'America/Santiago',
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(d)
      } catch (e) {
        return d.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
      }
    },
    syncRunChipColor(item) {
      const st = String((item && item.status) || '').toUpperCase()
      if (st === 'SUCCESS') return 'success'
      if (st === 'ERROR') return 'error'
      if (st === 'RUNNING') return 'warning'
      return 'grey'
    },
    refreshReportCurrent() {
      if (!this.isAdmin) return
      if (this.reportView === 0) this.loadReportBoard()
      else if (this.reportView === 1) this.loadSyncRuns()
      else this.loadNsPushLog()
    },
    async loadSyncRuns() {
      if (!this.isAdmin) return
      this.loadingSyncRuns = true
      this.syncRunsError = ''
      try {
        const res = await axios.get('/chronometer/netsuite/sync-runs', { params: { limit: 50 } })
        const runs = res.data && res.data.runs
        this.syncRuns = Array.isArray(runs) ? runs : []
      } catch (e) {
        this.syncRuns = []
        this.syncRunsError =
          (e.response && e.response.data && (e.response.data.message || e.response.data.text)) ||
          'No fue posible cargar el log de sincronizaciones.'
      } finally {
        this.loadingSyncRuns = false
      }
    },
    async loadNsPushLog() {
      if (!this.isAdmin) return
      this.loadingNsPushLog = true
      this.nsPushLogError = ''
      try {
        const res = await axios.get('/chronometer/netsuite/push-log', { params: { limit: 1000, stepLimit: 200 } })
        const rows = res.data && res.data.rows
        this.nsPushLogRows = Array.isArray(rows)
          ? rows.map((r, idx) => ({ ...r, row_key: `${r.sync_run_id || 'x'}-${r.operation_id || 'op'}-${idx}` }))
          : []
      } catch (e) {
        this.nsPushLogRows = []
        this.nsPushLogError =
          (e.response && e.response.data && (e.response.data.message || e.response.data.text)) ||
          'No fue posible cargar el log de push NetSuite.'
      } finally {
        this.loadingNsPushLog = false
      }
    },
    async openSyncRunDetail(item) {
      if (!item || !item.id) return
      this.syncRunDetailDialog = true
      this.syncRunDetail = item
      this.syncRunDetailSteps = []
      this.selectedSyncRunStep = null
      try {
        const res = await axios.get(`/chronometer/netsuite/sync-runs/${encodeURIComponent(item.id)}`)
        this.syncRunDetail = res.data && res.data.run ? res.data.run : item
        this.syncRunDetailSteps = (res.data && Array.isArray(res.data.steps)) ? res.data.steps : []
      } catch (e) {
        this.syncRunDetailSteps = []
        this.showSnack(
          (e.response && e.response.data && (e.response.data.message || e.response.data.text)) ||
            'No fue posible cargar el detalle de la sincronización.',
          'error'
        )
      }
    },
    prettyJson(value) {
      if (value == null || value === '') return '—'
      if (typeof value === 'object') return JSON.stringify(value, null, 2)
      const s = String(value)
      try {
        return JSON.stringify(JSON.parse(s), null, 2)
      } catch (e) {
        return s
      }
    },
    async exportReportExcel() {
      const opts = this.reportTableOptions || {}
      const sortBy = (opts.sortBy && opts.sortBy[0]) || 'ot_number'
      const sortDesc = !!(opts.sortDesc && opts.sortDesc[0])
      let rows = [...this.reportRows]
      if (sortBy && rows.length) {
        rows = orderBy(rows, [sortBy], [sortDesc ? 'desc' : 'asc'])
      }
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Reporte')
      ws.addRow([
        'Estado cronómetro',
        'Modo',
        'OT',
        'Seq',
        'Operación',
        'Recurso',
        'Área',
        'Tiempo de montaje (HH:MM)',
        'Tiempo de ejecución (HH:MM)',
        'Cantidad de entrada',
        'Tiempo de montaje real (HH:MM)',
        'Tiempo de ejecución real (HH:MM)',
        'Cantidad completada',
        'NS Op ID',
        'Estado NS',
        'Sync pendiente',
        'Operario',
        'Terminal',
        'Último evento',
        'Tiempo acum. (HH:MM:SS)'
      ])
      for (const r of rows) {
        ws.addRow([
          r.report_status_label || '',
          this.formatReportTimerMode(r.timer_mode),
          r.ot_number,
          r.operation_sequence,
          r.operation_name,
          r.resource_code,
          r.area,
          this.formatMinutesAsHHMM(r.planned_setup_minutes),
          this.formatMinutesAsHHMM(r.planned_operation_minutes),
          r.planned_quantity != null ? r.planned_quantity : '',
          this.formatMinutesAsHHMM(r.actual_setup_time),
          this.formatMinutesAsHHMM(r.actual_run_time),
          r.completed_quantity != null ? r.completed_quantity : '',
          r.netsuite_operation_id != null && r.netsuite_operation_id !== '' ? r.netsuite_operation_id : '',
          r.source_status || '',
          r.sync_pending ? 'Sí' : 'No',
          r.operator || '',
          r.station_id || '',
          this.formatReportDate(r.last_event_at),
          r.total_elapsed_seconds != null ? this.formatElapsedFromSeconds(r.total_elapsed_seconds) : ''
        ])
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const pad = (n) => String(n).padStart(2, '0')
      const now = new Date()
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
      a.download = `reporte-cronómetro-${stamp}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
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
      this.stopQtyPlanned = op && op.planned_quantity != null ? Number(op.planned_quantity) : null
      // Delta por cierre: iniciar vacÃ­o para no reenviar el acumulado por error.
      this.stopQtyValue = ''
      this.stopQtyDialog = true
    },
    closeStopQuantityDialog(force = false) {
      if (this.stopQtyLoading && !force) return
      this.stopQtyDialog = false
      this.stopQtyOpId = null
      this.stopQtyValue = ''
      this.stopQtyPlanned = null
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
        alert(`Seed WIP OK. Filas: ${n}. OTs: ${ots || '(sin ot_numbers en respuestá â€” backend viejo)'}`)
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
    async stopTimersBatch(area) {
      const scope = String(area || 'ALL').toUpperCase()
      this.loadingStopBatch = scope
      try {
        const res = await axios.post('/chronometer/timers/stop-batch', { area: scope })
        const stopped = (res.data && res.data.stoppedTimers) || 0
        this.showSnack(`Relojes detenidos (${scope}): ${stopped}`)
        await this.refreshBoard()
        const digits = String(this.otNumber || '').replace(/[^0-9]/g, '')
        if (digits) await this.buscarOperaciones()
        else await this.loadAreaOperations()
      } catch (error) {
        const msg = (error.response && error.response.data && error.response.data.message) || `No fue posible detener relojes (${scope}).`
        this.showSnack(msg, 'error')
      } finally {
        this.loadingStopBatch = ''
      }
    },
    showSnack(text, color = 'success') {
      this.snackbarText = text
      this.snackbarColor = color
      this.snackbar = true
    },
    /** Mensaje legible cuando axios no recibe respuestá (timeout, CORS, URL mal, SSL). */
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
          `AbrÃ­ en una pestáÃ±a nueva: ${base}/health â€” si el navegador marca certificado invÃ¡lido, el problema es TLS (no CORS).`,
          `Desde acÃ¡ usÃ¡ el botÃ³n Â«Probar conexiÃ³n APIÂ» (GET ${base}/cors-ping, sin JWT).`,
          'Si /health abre bien pero axios falla: otra red/VPN, antivirus, bloqueo DNS o proxy frente a reloj-api.'
        ]
        if (!httpsOk) {
          pasos.unshift('La base del API deberÃ­a ser https:// en producciÃ³n.')
        }
        return {
          message:
            'Network Error: no hubo respuestá HTTP usable. Tu baseURL ya es HTTPS hacia reloj-api â†’ suele ser certificado TLS, red/firewall o DNS, no la variable VUE_APP_API_URL.',
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
          { ok: true, url, respuestá: res.data },
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
        const msg = fromApi || (net && net.message) || 'Error al leer estádo NetSuite.'
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
        : 60
      this.nsOperationalDelaySeconds = delay
      try {
        const res = await axios.post(
          '/chronometer/netsuite/sync-operational',
          { pull_delay_seconds: delay },
          { timeout: NETSUITE_AXIOS_TIMEOUT_MS }
        )
        this.nsOperationalLastResult = JSON.stringify(res.data, null, 2)
        this.showSnack('Sincronización operativa completada.')
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
.sync-json {
  background: #0b1020;
  color: #e8edff;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.35;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.chrono-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.chrono-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chrono-logo {
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.chrono-brand-text {
  display: flex;
  flex-direction: column;
}

.chrono-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.chrono-subtitle {
  font-size: 0.8rem;
  color: #616161;
}

.chrono-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, auto));
  gap: 8px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 6px 8px;
  background: #fafafa;
}

.meta-label {
  font-size: 0.68rem;
  color: #757575;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.meta-value {
  font-size: 0.88rem;
  font-weight: 700;
}

.compact-table table th,
.compact-table table td {
  font-size: 12px !important;
  white-space: normal;
  padding: 6px 8px !important;
}

.compact-table table {
  table-layout: fixed;
  width: 100%;
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

.ops-table table th.resizable-col {
  position: relative;
  padding-right: 14px !important;
}

.col-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  user-select: none;
}

.col-resizer::after {
  content: '';
  position: absolute;
  top: 25%;
  bottom: 25%;
  left: 3px;
  width: 2px;
  border-radius: 999px;
  background: #c7c7c7;
  opacity: 0.8;
}

:global(body.ops-resizing) {
  cursor: col-resize !important;
  user-select: none !important;
}

.ops-meta,
.time-block {
  line-height: 1.2;
  word-break: break-word;
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

.table-scroll-wrap {
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
}

.active-wrap {
  max-height: 40vh;
}

.area-wrap {
  max-height: 52vh;
}

.dual-board-table table {
  min-width: 1180px;
}

.dual-board-table table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f7f7f7;
  border-bottom: 1px solid #d8d8d8;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.lane-cell {
  min-width: 230px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 6px;
  background: #fff;
}

.lane-idle {
  opacity: 0.88;
}

.lane-current {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.04);
}

.lane-current--active {
  border-color: #2e7d32;
  background: #f1f8e9;
}

.lane-current--paused {
  border-color: #f9a825;
  background: #fff8e1;
}

.lane-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.timer-btn-round {
  border-radius: 999px !important;
  width: 44px !important;
  height: 44px !important;
  min-width: 44px !important;
}

.timer-btn-round .v-icon {
  font-size: 22px !important;
}

.lane-time {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lane-live {
  font-size: 11px;
  font-weight: 800;
  color: #1b5e20;
  margin-top: 2px;
}

.lane-percent {
  font-size: 11px;
  margin-top: 2px;
  color: #424242;
  font-weight: 700;
}

.lane-now {
  margin-top: 3px;
  font-size: 11px;
  font-weight: 700;
}

.lane-now--active {
  color: #1b5e20;
}

.lane-now--paused {
  color: #ef6c00;
}

.lane-now--stopped {
  color: #757575;
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

/* Fondo distinto según fase del cronómetro (tablero 2×2): setup = frío, run = tono producción. */
.idle-quadrant--phase-setup {
  background: linear-gradient(155deg, #1e3a5f 0%, #152d4d 42%, #0f243d 100%);
}

.idle-quadrant--phase-run {
  background: linear-gradient(155deg, #1a2218 0%, #141b14 48%, #0f140f 100%);
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

.q-user {
  font-size: clamp(1.05rem, 2.4vw, 1.55rem);
  font-weight: 700;
  color: #dbe7f5;
  margin-bottom: 1px;
}

.q-op-line {
  font-size: clamp(0.72rem, 1.8vw, 0.96rem);
  font-weight: 600;
  color: #a8c9ef;
  max-width: 95%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-mode {
  margin-top: 4px;
  font-size: clamp(1rem, 2.2vw, 1.35rem);
  font-weight: 800;
  color: #d0d7de;
  letter-spacing: 0.03em;
}

.q-time {
  font-size: clamp(3.3rem, 8.8vw, 6.2rem);
  line-height: 0.95;
  margin-top: 2px;
  margin-bottom: 4px;
}

.q-qty {
  font-size: clamp(1.25rem, 2.8vw, 2rem);
  font-weight: 800;
  color: #e6edf3;
  margin-top: 2px;
  margin-bottom: 2px;
}

.q-progress-row {
  width: 78%;
  display: flex;
  justify-content: space-between;
  color: #d0d7de;
  font-size: clamp(0.85rem, 1.7vw, 1.1rem);
  margin-top: 2px;
}

.q-progress-track {
  width: 78%;
  height: clamp(14px, 1.8vw, 20px);
  border-radius: 9999px;
  background: #9ec0e3;
  overflow: visible;
  margin-top: 4px;
}

.q-progress-fill {
  height: 100%;
  border-radius: 9999px;
}

.q-legend {
  width: 78%;
  margin-top: 8px;
  font-size: clamp(0.58rem, 1.1vw, 0.76rem);
  color: #d0d7de;
  text-align: center;
  line-height: 1.25;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  white-space: nowrap;
  overflow: hidden;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.legend-dot--green { background: #00c853; }
.legend-dot--yellow { background: #ffca28; }
.legend-dot--red { background: #ff5252; }

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

@media (max-width: 960px) {
  .chrono-meta-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
    width: 100%;
  }

  .chrono-logo {
    width: 42px;
    height: 42px;
  }
}
</style>






