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
      // convertToCSV(objArray, 
      // values=['date','name','resource','ot','item','estimated_time','missing_time', 'quantity'], 
      // str='Fecha,Nombre,Recurso,Orden de trabajo,Secuencia,Tiempo estimado,Tiempo gastado,Cantidad' + '\r\n',
      // lastId=10
      // ) {
      //   var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
      //   for (var i = 0; i < 1; i++) {
      //       var line = '';
      //       for (var index of values) {
      //         if(values.indexOf(index) != -1 ){
      //           if(index === 'id'){
      //             if (line != '') line += ','
      //             line += lastId
      //             continue;
      //           }
      //           if(index === 'missing_time'){
      //             if (line != '') line += ','
      //             line += array[i]['estimated_time'] - array[i][index];
      //             continue;
      //           }
      //           if(index === 'ot'){
      //             if (line != '') line += ','
      //             line += 'Orden de trabajo #OT' + array[i][index]
      //             continue;
      //           }
      //           if(index === 'JSON'){
      //             if (line != '') line += ','
      //             for (var k = 0; k < objArray.length; k++) {
      //               delete objArray[k].id
      //               delete objArray[k].ot
      //             }
      //             line += '"' + JSON.stringify(objArray) + '"'
      //             continue;
      //           }
      //           if (line != '') line += ','
      //           line += array[i][index];
      //         }
      //       }
      //       str += line + '\r\n';
      //   }
      //   //str += '\r\n';
      //   return str;
      // },
      // descargar(){
      //   // [{"secuencia":"1","horasConfiguracion":"10","horasEjecucion":"15", "cantidadCompletada":"0"},
      //   // {"secuencia":"2","horasConfiguracion":"20","horasEjecucion":"25", "cantidadCompletada":"0"}]
      //   // Se obtiene el ultimo id registrado
      //   this.getLastId()
      //   // Se obtienen todos los registros acutales
      //   axios.get('/order').then((response) => {
      //     if(response.status == 200){

      //       // Se obtienen todas las ots.
      //       const allOTs = this.getOts(response.data.group)
      //       // Se cambian los nombres de las llaves.
      //       const dataModified = response.data.group.map(
      //           obj => {
      //             return {
      //                 "id": obj.id,
      //                 "ot": obj.ot,
      //                 "secuencia":obj.item,
      //                 "horasConfiguracion":obj.total_estimated_time,
      //                 "horasEjecucion":obj.total_time,
      //                 "cantidadCompletada":obj.total_quantity
      //               }
      //             }
      //         );
            
      //       // Se recorren y se agrupan las mismas ots.
      //       allOTs.forEach(element => {
      //         // Se obtienen los valores filtrados
      //         this.dataJson.push(dataModified.filter(key => key.ot == element))
      //       });
            
      //       // Ahora se deben filtrar aquellos datos con cantidadCompletada distintas en una misma OT.
      //       for (let idx = 0; idx < this.dataJson.length; idx++) {
      //         var lastOt = -1
      //         var lastValue = -1
      //         // Se recorre el objeto agrupado por OT.
      //         for (const json of this.dataJson[idx]) {
      //           // Si el valor anterior de ot y de cantidad completada son iguales
      //           // entonces no debemos guardalor nuevamente.
      //           if ((lastOt == json.ot) && lastValue == json.cantidadCompletada) continue;
                
      //           this.dataJsonFilter.push(dataModified.filter(x => (x.cantidadCompletada == json.cantidadCompletada) && (x.ot == json.ot)))
                
      //           lastOt = json.ot
      //           lastValue = json.cantidadCompletada
      //         }
      //       }

      //       var lastid = this.currentLastId

      //       // Se convierte en formato .csv
      //       var csv = ""
      //       for (let i = 0; i < this.dataJsonFilter.length; i++) {
      //         var jsonObject1 = this.dataJsonFilter[i]//JSON.stringify(this.dataJson[i]);

      //         // Se define el newid, para que nos valores no sean repetidos.
      //         var newid = lastid + i
      //         if(i == 0){
      //           csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "ID Externo,OT,JSON" + '\r\n', newid);
      //         }else{
      //           csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "", newid);
      //         }
      //       }
            
      //       // Se crea el objeto URL para descargar el .csv
      //       const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      //       const link = document.createElement('a')
      //       link.href = url
      //       link.setAttribute(
      //         'download',
      //         `Timer-${new Date().toLocaleDateString()}.csv`
      //       )
      //       document.body.appendChild(link)
      //       link.click()

      //       // Ahora, para finalizar debemos actualizar el lastId

      //       this.updatelastId({"lastid": newid})
      //       this.dataJson = [],
      //       this.dataJsonFilter = []

      //       // var jsonObject = JSON.stringify(response.data.orders);
      //       // var jsonObjectStats = JSON.stringify(response.data.group);
      //       // //console.log(jsonObjectStats)
      //       // var csv = this.convertToCSV(jsonObject);
      //       // csv += this.convertToCSV(jsonObjectStats, ["ot", "item", "total_quantity", "total_time", "total_estimated_time"], 'ORDEN DE TRABAJO,SECUENCIA,CANTIDAD,TIEMPO TOTAL UTILIZADO,TIEMPO PLANIFICADO' + '\r\n');


      //       // let csvOT = this.convertToCSV(jsonObject, ["ot"], 'ORDEN DE TRABAJO' + '\r\n');
      //       // const url_ot = URL.createObjectURL(new Blob([csvOT], { type: 'text/csv;charset=utf-8;' }))
      //       // link.href = url_ot
      //       // link.setAttribute(
      //       //   'download',
      //       //   `OTs-${new Date().toLocaleDateString()}.xls`
      //       // )
      //       // document.body.appendChild(link)
      //       // link.click()
      //     }
      //   })
      // },
      getOts(array){
        return new Set(array.map(element => element.ot))
      },
      // diffhours(time){
      //   return time
      //   return setTimeout( function(){ 
      //     parseInt((new Date(time).getTime() - new Date(Date.now()).getTime())/ (1000 * 60)) + " min", 1000
      //   }, 1000)
      // }
    },
  }
</script>