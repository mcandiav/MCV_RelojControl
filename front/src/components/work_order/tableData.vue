<template>
  <v-card>
    <!-- <v-btn
      color="success"
      class="mx-3"
      right
      @click="descargar"
      v-if="isAdmin"
      >
        Descargar Excel
    </v-btn> -->
    <v-card-title>
      <v-row>
        <v-col>
          <v-text-field
          v-model="search"
          append-icon="mdi-magnify"
          label="Buscar OT o Recurso especifico"
          @input="searchOts"
        ></v-text-field>
        </v-col>
        <v-col>
          <!-- Campo de selección -->
          <v-select v-model="filters.status" :items="states" label="Seleccionar estado" @change="applyFilters" v-if="isAdmin"></v-select>
        </v-col>
      </v-row>
    </v-card-title>
    <v-data-table
      :headers="isAdmin == true? headers:headers.slice(1)"
      :items="worksOrders"
      :loading="loading"
      :footer-props="{
        'items-per-page-options': [50, 100],
      }"
      no-data-text="Debes buscar un recurso u OT"
      no-results-text="No se ha encontrado el recurso/OT. Por favor, verifica lo ingresado."
      :server-items-length="1000"
      @pagination="handlePagination"
    >
      <template v-if="isAdmin" v-slot:item.user="{ item }">
        <div v-if="item.User">
          {{ item.User.name + ' ' + item.User.lastname }}
        </div>
      </template>
      <template v-slot:item.max_time="{ item }">
        <div v-if="item.max_time">
          {{ new Date(item.max_time).toLocaleString()}}
        </div>
      </template>
      <template v-slot:item.assembly_timer="{ item }">
        <div v-if="item.state === 'En montaje'">
          <div v-if="!item.stoped">
            <div v-if="getCurrentTimeAssembly(item) < 0" class="error">
              {{
                getCurrentTimeAssembly(item) + " min restantes"
              }}
            </div>
            <div v-else>
              {{
                getCurrentTimeAssembly(item) + " min restantes"
              }}
            </div>
          </div>
        </div>
        <div v-if="item.state === 'Pausado' && !item.finished_assembly">
          <div v-if="item.assembly_missing_time < 0 " class="error">
            {{ item.assembly_missing_time }} minutos
          </div>
          <div v-else>
            {{ item.assembly_missing_time }} minutos
          </div>
        </div>
        <div v-if="(item.state === 'Completado' || item.state === 'En curso' || item.state === 'Pausado') && item.finished_assembly">  <!-- Si se completó y tiene assembly_missing_time (se ejecutó con nuestra app...) -->
          <div v-if="item.assembly_missing_time < 0 ">
            {{ item.assembly_missing_time }} minutos
            <v-chip
              color="red"
              text-color="white"
            >
              <v-avatar>
                <v-icon>mdi-close</v-icon>
              </v-avatar>
            </v-chip>
          </div>
          <div v-else>
            {{ item.assembly_missing_time }} minutos
            <v-chip
              color="green"
              text-color="white"
            >
              <v-avatar>
                <v-icon>mdi-checkbox-marked-circle</v-icon>
              </v-avatar>
            </v-chip>
          </div>
        </div>
      </template>
      <template v-slot:item.timer="{ item }">
        <div v-if="item.state === 'En curso'">
          <div v-if="!item.stoped">
            <div v-if="getCurrentTime(item) < 0" class="error">
              {{
                getCurrentTime(item) + " min restantes"
              }}
            </div>
            <div v-else>
              {{
                getCurrentTime(item) + " min restantes"
              }}
            </div>
          </div>
        </div>
        <div v-if="item.state === 'Pausado' && item.finished_assembly">
          <div v-if="item.missing_time < 0 " class="error">
            {{ item.missing_time }} minutos
          </div>
          <div v-else>
            {{ item.missing_time }} minutos
          </div>
        </div>
        <div v-if="item.state === 'Completado' && item.missing_time !== null">  <!-- Si se completó y tiene missing_time (se ejecutó con nuestra app...) -->
          <div v-if="item.missing_time < 0 ">
            {{ item.missing_time }} minutos
            <v-chip
              color="red"
              text-color="white"
            >
              <v-avatar>
                <v-icon>mdi-close</v-icon>
              </v-avatar>
            </v-chip>
          </div>
          <div v-else>
            {{ item.missing_time }} minutos
            <v-chip
              color="green"
              text-color="white"
            >
              <v-avatar>
                <v-icon>mdi-checkbox-marked-circle</v-icon>
              </v-avatar>
            </v-chip>
          </div>
        </div>
      </template>
      <template v-slot:item.quantity="{ item }">
        <div v-if="item.quantity >= 0">
          {{ item.quantity }}
        </div>
      </template>
      <template v-slot:item.actions="{ item }">
        <v-row>
          <v-col>
            <playButton :items=item />
          </v-col>
          <v-col>
            <pauseButton :items=item />
          </v-col>
          <v-col>
            <stopButton :items=item />
          </v-col>
          <v-col>
            <editButton :items=item  :create="false" v-if="isAdmin"/>
          </v-col>
          <v-col>
            <deleteButton :items=item v-if="isAdmin"/>
          </v-col>
        </v-row>
      </template>
    </v-data-table>
  </v-card>
</template>

<script>
import axios from 'axios'
import { mapActions, mapGetters } from 'vuex'
import stopButton from './stopButton.vue'
import deleteButton from './deleteButton.vue'
import playButton from './playButton.vue'
import pauseButton from './pauseButton.vue'
import editButton from './editButton.vue'
import moment from 'moment-timezone'
import _ from 'lodash'

  export default {
    components:{
      stopButton,
      deleteButton,
      playButton,
      pauseButton,
      editButton,
    },
    data: () => ({
      dialog: false,
      dialogDelete: false,
      search: '',
      worksOrders: [],
      loading: false,
      download: true,
      options: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      headers: [
        // Agregar el campo user, solo si es admin
        { text: 'Usurario', value: 'user' },
        { text: 'Operación', value: 'operation_name' },
        { text: 'Recurso', value: 'resource' },
        { text: 'OT', value: 'ot'},
        { text: 'Secuencia', value: 'item', align: 'center'},
        { text: 'Estado', value: 'state'},
        { text: 'Tiempo planificado de Montaje (min)', value: 'assembly_time', align: 'center' },
        { text: 'Tiempo en uso', value: 'assembly_timer'},
        { text: 'Tiempo planificado de ejecución (min)', value: 'estimated_time', align: 'center' },
        //{ text: 'Fecha actual', value: 'date' },
        //{ text: 'Fecha limite', value: 'max_time'},
        { text: 'Tiempo en uso', value: 'timer' },
        { text: 'Cantidad Planificada', value: 'n_times_paused', align: 'center'},
        { text: 'Cantidad', value: 'quantity'},
        { text: 'Acciones', value: 'actions', sortable: false, align: 'center'},
      ],
      dataJson: [],
      dataJsonFilter: [],
      filters: {
        resource: '',
        status: ''
      },
      states: ['No iniciado', 'En curso', 'Completado', 'Pausado', 'En montaje', 'Todos'],
      serverTime: null,
      configPag: {
        itemsPerPage: 50,
        page: 1,
      },
    }),

    computed: {
      ...mapGetters({
        allWorksOrders: 'order/allWorksOrders',
        currentLastId: 'order/currentLastId',
        currentTimeServer: 'order/currentTimeServer',
        isAdmin: 'auth/isAdmin'
      }),
      filteredData() {
        return this.data.filter(item => {
          return item.state.includes(this.filters.status);
        });
      },
    },

    async created () {
      console.log('created')
      this.getTimeServer()
      // Se actualiza automaticamente la lista de ordenes.
      // Se obtiene el utlimo id registrado.
      setInterval(() => {
        // aquí va tu consulta a la base de datos
        // if(this.isAdmin){
        //   this.getListsRecords(this.search)
        // }else{
        this.getTimeServer()
        this.getListOrder({
          "search": this.search,
          "pagination": this.configPag.page,
          "itemsPerPage": this.configPag.itemsPerPage,
          "status": this.filters.status
        })
      }, 60000); // 1800000 milisegundos = 30 minutos
      this.getLastId()
    },
    
    beforeDestroy () {
      //clearInterval(this.interval)
    },

    watch: {
      allWorksOrders() {
        this.worksOrders  = this.allWorksOrders
        this.serverTime = moment(this.currentTimeServer).valueOf();
        // console.log(this.worksOrders)
        // this.applyFilters()
        this.loading = false
      },
    },
    methods: {
      ...mapActions({
        getListOrder: 'order/getListOrder',
        getListsRecords: 'order/getListsRecords',
        getLastId: 'order/getLastId',
        updatelastId: 'order/updatelastId',
        getTimeServer: 'order/getTimeServer',
      }),
      handlePagination({ page, itemsPerPage }) {
        this.configPag.page = page
        this.configPag.itemsPerPage = itemsPerPage

        console.log('this.filters.status', this.filters.status)

        this.getListOrder({
          "search": this.search,
          "pagination": this.configPag.page,
          "itemsPerPage": this.configPag.itemsPerPage,
          "status": this.filters.status
        })
      },
      searchOts: _.debounce(function() {
        this.getListOrder({
          "search": this.search,
          "pagination": this.configPag.page,
          "itemsPerPage": this.configPag.itemsPerPage,
          "status": this.filters.status
        })
      }, 1000),
      getCurrentTime(item){
        const currentTime = moment().valueOf() + (this.serverTime - new Date().getTime());
        const maxTime = moment.tz(item.max_time, 'America/Santiago').valueOf();
        return Math.floor((maxTime - currentTime) / 60000); // Calcula el tiempo restante en minutos
      },
      getCurrentTimeAssembly(item){
        const currentTime = moment().valueOf() + (this.serverTime - new Date().getTime());
        const maxTime = moment.tz(item.assembly_max_time, 'America/Santiago').valueOf();
        return Math.floor((maxTime - currentTime) / 60000); // Calcula el tiempo restante en minutos
      },
      applyFilters() {
        if(this.filters.status === 'Todos'){
          this.getListOrder({
            "search": this.search,
            "pagination": this.configPag.page,
            "itemsPerPage": this.configPag.itemsPerPage,
            "status": this.filters.status
           })
        }
        else{
          this.getListOrder({
            "search": this.search,
            "pagination": this.configPag.page,
            "itemsPerPage": this.configPag.itemsPerPage,
            "status": this.filters.status
           })
        }
      },
      pause(item){
        //console.log('Pausar', item._id)
        if (confirm('Esta seguro que desea Pausar la orden de trabajo seleccionada?')) {
          axios.post('/order/pause', item).then(response => {
              if(response.status == 200){
                  console.log('Pausado exitosamente.')
                  this.getListOrder(this.search)
                  //this.setTextSnack("La direccion ha sido eliminada exitosamente.")
              }
          })
        }
      },
      eliminar(item){
        //console.log('Eliminar', item._id)
        if (confirm('Esta seguro que desea eliminar la orden de trabajo seleccionada?')) {
          axios.post('/order/delete', item).then(response => {
              if(response.status == 200){
                  console.log('Eliminado exitosamente.')
                  this.getListOrder(this.search)
                  //this.setTextSnack("La direccion ha sido eliminada exitosamente.")
              }
          })
        }
      },
      getOts(array){
        return new Set(array.map(element => element.ot))
      },
    },
  }
</script>