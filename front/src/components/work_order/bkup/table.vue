<template>
  <div>
    <v-btn
    color="success"
    class="mx-3"
    right
    @click="descargar"
    v-if="isAdmin"
    >
      Descargar Excel
    </v-btn>
    
      <v-data-table
    :headers="headers"
    :items="worksOrders"
    :loading="loading"
    class="elevation-1"
    :items-per-page="500"
    hide-default-footer
  >
  <template v-slot:item.estimated_time="{ item }">
    {{ item.estimated_time + " " + "min"}}
  </template>
  <template v-slot:item.date="{ item }">
    {{ new Date(item.date).toLocaleString()}}
  </template>
  <template v-slot:item.max_time="{ item }">
    {{ new Date(item.max_time).toLocaleString()}}
  </template>
  <template v-slot:item.timer="{ item }">
    <div v-if="!item.stoped">
      <div v-if="parseInt((new Date(item.max_time).getTime() - new Date(Date.now()).getTime())/ (1000 * 60)) < 0" class="error">
        {{
          parseInt((new Date(item.max_time).getTime() - new Date(Date.now()).getTime())/ (1000 * 60)) + " min restantes"
        }}
      </div>
      <div v-else>
        {{
          parseInt((new Date(item.max_time).getTime() - new Date(Date.now()).getTime())/ (1000 * 60)) + " min restantes"
        }}
      </div>
    </div>
    <div v-else>
      <div v-if="item.estimated_time >= (item.estimated_time - item.missing_time)">
        {{item.estimated_time - item.missing_time + " min"}}
        <v-chip
          color="green"
          text-color="white"
        >
          <v-avatar>
            <v-icon>mdi-checkbox-marked-circle</v-icon>
          </v-avatar>
        </v-chip>
      </div>
      <div v-else>
        {{item.estimated_time - item.missing_time + " min"}}
        <v-chip
          color="red"
          text-color="white"
        >
          <v-avatar>
            <v-icon>mdi-close</v-icon>
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
      <v-col cols="4">
        <stopButton :items=item />
      </v-col>
      <v-col cols="2"></v-col>
      <v-col cols="4">
        <deleteButton :items=item v-if="isAdmin"/>
        <!-- <v-btn
        class="mx-0"
        small
        color="error"
        @click="eliminar(item)"
        >
          <v-icon dark>
            mdi-delete
          </v-icon>
        </v-btn> -->
      </v-col>
    </v-row>
    <!-- <v-btn
    :disabled="item.paused"
    small
    class="mx-1"
    color="success"
    @click="pause(item)"
    >
      <v-icon dark>
        mdi-pause
      </v-icon>
    </v-btn> -->
  </template>
  <!-- Faltaria definir el tiempo maximo en la base de datos. En el caso de pausar se cambia el tiempo maximo, sino se deja el mismo claramante. -->
    <!-- <template v-slot:top>
      <v-toolbar
        flat
      >
        <v-toolbar-title>Lista de trabajos</v-toolbar-title>
        <v-divider
          class="mx-4"
          inset
          vertical
        ></v-divider>
        <v-dialog v-model="dialogDelete" max-width="500px">
          <v-card>
            <v-card-title class="text-h5">Are you sure you want to delete this item?</v-card-title>
            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn color="blue darken-1" text >Cancel</v-btn>
              <v-btn color="blue darken-1" text >OK</v-btn>
              <v-spacer></v-spacer>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-toolbar>
    </template> -->
    <!-- <template v-slot:item.actions="{ item }">
      <v-icon
        small
        class="mr-2"
        @click="editItem(item)"
      >
        mdi-pencil
      </v-icon>
      <v-icon
        small
        @click="deleteItem(item)"
      >
        mdi-delete
      </v-icon>
    </template> -->
  </v-data-table>
  </div>
</template>

<script>
import axios from 'axios'
import { mapActions, mapGetters } from 'vuex'
import stopButton from './stopButton.vue'
import deleteButton from './deleteButton.vue'

  export default {
    components:{
      stopButton,
      deleteButton
    },
    data: () => ({
      dialog: false,
      dialogDelete: false,
      worksOrders: [],
      loading: false,
      download: true,
      options: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
      headers: [
        {
          text: 'Nombre',
          align: 'start',
          value: 'name',
        },
        { text: 'Recurso', value: 'resource' },
        { text: 'OT', value: 'ot'},
        { text: 'Secuencia de operaciones', value: 'item', align: 'center'  },
        { text: 'Tiempo estimado', value: 'estimated_time', align: 'center' },
        { text: 'Fecha actual', value: 'date' },
        { text: 'Fecha limite', value: 'max_time'},
        { text: 'Tiempo', value: 'timer' },
        { text: 'Cantidad', value: 'quantity'},
        { text: 'Acciones', value: 'actions', sortable: false },
      ],
      dataJson: [],
      dataJsonFilter: []
    }),

    computed: {
      ...mapGetters({
        allWorksOrders: 'order/allWorksOrders',
        currentLastId: 'order/currentLastId',
        isAdmin: 'auth/isAdmin'
      }),
    },

    created () {
      // Se actualiza automaticamente la lista de ordenes.
      // Se obtiene el utlimo id registrado.
      this.interval = setInterval(this.getListOrder, 60000)
      this.getListOrder()
      this.getLastId()
      if(this.worksOrders.length == 0){
        this.loading = true
      }
    },
    
    beforeDestroy () {
      //clearInterval(this.interval)
    },

    watch: {
      allWorksOrders() {
        this.worksOrders  = this.allWorksOrders
        this.loading = false
      },
    },
    methods: {
      ...mapActions({
        getListOrder: 'order/getListOrder',
        getLastId: 'order/getLastId',
        updatelastId: 'order/updatelastId'
      }),
      pause(item){
        //console.log('Pausar', item._id)
        if (confirm('Esta seguro que desea Pausar la orden de trabajo seleccionada?')) {
          axios.post('/order/pause', item).then(response => {
              if(response.status == 200){
                  console.log('Pausado exitosamente.')
                  this.getListOrder()
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
                  this.getListOrder()
                  //this.setTextSnack("La direccion ha sido eliminada exitosamente.")
              }
          })
        }
      },
      convertToCSV(objArray, 
      values=['date','name','resource','ot','item','estimated_time','missing_time', 'quantity'], 
      str='Fecha,Nombre,Recurso,Orden de trabajo,Secuencia,Tiempo estimado,Tiempo gastado,Cantidad' + '\r\n',
      lastId=10
      ) {
        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        for (var i = 0; i < 1; i++) {
            var line = '';
            for (var index of values) {
              if(values.indexOf(index) != -1 ){
                if(index === 'id'){
                  if (line != '') line += ','
                  line += lastId
                  continue;
                }
                if(index === 'missing_time'){
                  if (line != '') line += ','
                  line += array[i]['estimated_time'] - array[i][index];
                  continue;
                }
                if(index === 'ot'){
                  if (line != '') line += ','
                  line += 'Orden de trabajo #OT' + array[i][index]
                  continue;
                }
                if(index === 'JSON'){
                  if (line != '') line += ','
                  for (var k = 0; k < objArray.length; k++) {
                    delete objArray[k].id
                    delete objArray[k].ot
                  }
                  line += '"' + JSON.stringify(objArray) + '"'
                  continue;
                }
                if (line != '') line += ','
                line += array[i][index];
              }
            }
            str += line + '\r\n';
        }
        //str += '\r\n';
        return str;
      },
      descargar(){
        // [{"secuencia":"1","horasConfiguracion":"10","horasEjecucion":"15", "cantidadCompletada":"0"},
        // {"secuencia":"2","horasConfiguracion":"20","horasEjecucion":"25", "cantidadCompletada":"0"}]
        // Se obtiene el ultimo id registrado
        this.getLastId()
        // Se obtienen todos los registros acutales
        axios.get('/order').then((response) => {
          if(response.status == 200){

            // Se obtienen todas las ots.
            const allOTs = this.getOts(response.data.group)
            // Se cambian los nombres de las llaves.
            const dataModified = response.data.group.map(
                obj => {
                  return {
                      "id": obj.id,
                      "ot": obj.ot,
                      "secuencia":obj.item,
                      "horasConfiguracion":obj.total_estimated_time,
                      "horasEjecucion":obj.total_time,
                      "cantidadCompletada":obj.total_quantity
                    }
                  }
              );
            
            // Se recorren y se agrupan las mismas ots.
            allOTs.forEach(element => {
              // Se obtienen los valores filtrados
              this.dataJson.push(dataModified.filter(key => key.ot == element))
            });
            
            // Ahora se deben filtrar aquellos datos con cantidadCompletada distintas en una misma OT.
            for (let idx = 0; idx < this.dataJson.length; idx++) {
              var lastOt = -1
              var lastValue = -1
              // Se recorre el objeto agrupado por OT.
              for (const json of this.dataJson[idx]) {
                // Si el valor anterior de ot y de cantidad completada son iguales
                // entonces no debemos guardalor nuevamente.
                if ((lastOt == json.ot) && lastValue == json.cantidadCompletada) continue;
                
                this.dataJsonFilter.push(dataModified.filter(x => (x.cantidadCompletada == json.cantidadCompletada) && (x.ot == json.ot)))
                
                lastOt = json.ot
                lastValue = json.cantidadCompletada
              }
            }

            var lastid = this.currentLastId

            // Se convierte en formato .csv
            var csv = ""
            for (let i = 0; i < this.dataJsonFilter.length; i++) {
              var jsonObject1 = this.dataJsonFilter[i]//JSON.stringify(this.dataJson[i]);

              // Se define el newid, para que nos valores no sean repetidos.
              var newid = lastid + i
              if(i == 0){
                csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "ID Externo,OT,JSON" + '\r\n', newid);
              }else{
                csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "", newid);
              }
            }
            
            // Se crea el objeto URL para descargar el .csv
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute(
              'download',
              `Timer-${new Date().toLocaleDateString()}.csv`
            )
            document.body.appendChild(link)
            link.click()

            // Ahora, para finalizar debemos actualizar el lastId

            this.updatelastId({"lastid": newid})
            this.dataJson = [],
            this.dataJsonFilter = []

            // var jsonObject = JSON.stringify(response.data.orders);
            // var jsonObjectStats = JSON.stringify(response.data.group);
            // //console.log(jsonObjectStats)
            // var csv = this.convertToCSV(jsonObject);
            // csv += this.convertToCSV(jsonObjectStats, ["ot", "item", "total_quantity", "total_time", "total_estimated_time"], 'ORDEN DE TRABAJO,SECUENCIA,CANTIDAD,TIEMPO TOTAL UTILIZADO,TIEMPO PLANIFICADO' + '\r\n');


            // let csvOT = this.convertToCSV(jsonObject, ["ot"], 'ORDEN DE TRABAJO' + '\r\n');
            // const url_ot = URL.createObjectURL(new Blob([csvOT], { type: 'text/csv;charset=utf-8;' }))
            // link.href = url_ot
            // link.setAttribute(
            //   'download',
            //   `OTs-${new Date().toLocaleDateString()}.xls`
            // )
            // document.body.appendChild(link)
            // link.click()
          }
        })
      },
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