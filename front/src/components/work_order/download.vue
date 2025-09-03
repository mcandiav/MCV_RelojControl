<template>
  <v-container fluid class="pt-0">
      <v-dialog
      v-model="dialog"
      max-width="600"
      >
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            color="success"
            dark
            v-bind="attrs"
            v-on="on"
            class="my-0 py-0"
          >
            Descargar Excel
          </v-btn>
        </template>
        <v-card>
          <v-card-title class="text-center">
              Descargando información
          </v-card-title>
          <v-divider></v-divider>
          <v-card-text class="my-4">
            <v-row align="center" justify="center">
              <v-col
              cols="6"
              >
              <v-date-picker
              v-model="dates"
              range
              :max="new Date().toISOString()"
              locale="es-CL"
              ></v-date-picker>
              </v-col>
              <v-col
              cols="6"
              align="center"
              >
                <v-btn
                color="success"
                :disabled="disabled"
                @click="descargar"
                >
                  Descargar
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions></v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </template>
<script>
import axios from 'axios'
import ExcelJS from 'exceljs';
import { mapActions, mapGetters } from 'vuex'

  export default {
    data: () => ({
      dates: [],
      dialog: false,
      disabled: true,
      linkurl: '',
      dataJson: [],
      dataJsonFilter: [],
      delimiter: ';'
    }),
    watch: {
      dates(){
        if(this.dates.length > 0){
          this.disabled = false
        }
      }
    },
    computed: {
      ...mapGetters({
        allWorksOrders: 'order/allWorksOrders',
        currentLastId: 'order/currentLastId',
        isAdmin: 'auth/isAdmin'
      }),
    },
    methods:{
      ...mapActions({
        getListOrder: 'order/getListOrder',
        getLastId: 'order/getLastId',
        updatelastId: 'order/updatelastId'
      }),
      convertToCSV(objArray, 
      values=['date','name','resource','ot','item','estimated_time','missing_time', 'quantity'], 
      str='Fecha,Nombre,Recurso,Orden de trabajo,Secuencia,Tiempo estimado,Tiempo gastado,Cantidad' + '\r\n',
      lastId=10
      ) {
        var delimiter = ';'
        var lastOt = null;
        console.log(values, lastId, delimiter)
        var array = typeof objArray != 'object' ? JSON.parse(objArray) : objArray;
        for (let i = 0; i < array.length; i++) { // Recorro cada unos de los objetos
          console.log(array[i])
          lastOt = array[i][0].ot
          for(let j = 0; j < array[i].length; j++){ // Si un objeto tiene mas de un elemento, se recorre.
            console.log(array[i][j])
            var line = '';
            for (var index of values) { 
              console.log('array: ', array[i][j], array[i][j][index], index)
              if(values.indexOf(index) != -1 ){
                if(index === 'id'){
                  if (line != '') line += this.delimiter
                  line += lastId
                  continue;
                }
                if(index === 'missing_time'){
                  if (line != '') line += this.delimiter
                  line += array[i][j]['estimated_time'] - array[i][j][index];
                  continue;
                }
                if(index === 'ot'){
                  if (line != '') line += this.delimiter
                  line += 'Orden de trabajo #OT' + lastOt //array[i][j][index]
                  continue;
                }
                if(index === 'JSON'){
                  if (line != '') line += this.delimiter;
                  for (let k = 0; k < objArray[i].length; k++) {
                    delete objArray[i][k].id
                    lastOt = objArray[i][k].ot
                    delete objArray[i][k].ot
                  }
                  line += '"' + JSON.stringify(objArray[i]) + '"'
                  continue;
                }
                if (line != '') line += delimiter
                line += array[i][index];
              }
            }
          }
        }
            str += line + '\r\n';
        str += '\r\n';
        return str;
      },
      exportarExcel() {
      // Crea un nuevo libro de trabajo
      const workbook = new ExcelJS.Workbook();

      // Crea una nueva hoja de trabajo
      const worksheet = workbook.addWorksheet('Datos');

      // Crea la cabecera de la hoja de trabajo
      worksheet.columns = [
        { header: 'ID Externo', key: 'id', width: 20 },
        { header: 'OT', key: 'ot', width: 10 },
        { header: 'JSON', key: 'json', width: 30 },
      ];

      // Agrega los datos a la hoja de trabajo
      this.datos.forEach((row) => {
        worksheet.addRow({
          nombre: row.nombre,
          edad: row.edad,
          email: row.email,
          nuevoDato: 'Valor nuevo',
        });
      });

      // Crea un objeto Blob a partir del archivo de Excel
      workbook.xlsx.writeBuffer()
        .then((buffer) => {
          const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          // Crea un objeto URL a partir del Blob
          const url = URL.createObjectURL(blob);

          // Crea un enlace para descargar el archivo de Excel
          const link = document.createElement('a');
          link.href = url;
          link.download = 'datos.xlsx';
          document.body.appendChild(link);
          link.click();

          // Elimina el objeto URL y el enlace
          URL.revokeObjectURL(url);
          document.body.removeChild(link);
        })
        .catch((error) => {
          console.log('Se produjo un error al crear el archivo de Excel', error);
        });
    },
      descargar(){
        // [{"secuencia":"1","horasConfiguracion":"10","horasEjecucion":"15", "cantidadCompletada":"0"},
        // {"secuencia":"2","horasConfiguracion":"20","horasEjecucion":"25", "cantidadCompletada":"0"}]
        // Se ordenan las fechas
        if(this.dates.length === 2){
          this.dates.sort((a, b) => {
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            return dateA - dateB;
          });
          this.linkurl = this.dates[0] + "&end=" + this.dates[1]
        }else{
          this.linkurl = this.dates[0]
        }

        console.log(this.dates)

        // Se obtiene el ultimo id registrado
        this.getLastId()
        // Se obtienen todos los registros acutales
        axios.get('/order/download?start=' + this.linkurl).then((response) => {
          if(response.status == 200){
            console.log('descargando...')
            console.log(response.data)
            // Se obtienen todas las ots.
            const allOTs = this.getOts(response.data.group)
            // Se cambian los nombres de las llaves.
            const dataModified = response.data.group.map(
                obj => {
                  return {
                      "ot": obj.ot,
                      "secuencia":obj.item,
                      "horasConfiguracion": obj.total_time_assembly, //obj.assembly_time + obj.estimated_time,
                      "horasEjecucion": obj.total_time_ejecution, //obj.total_time_assembly + obj.total_time_ejecution,
                      "cantidadCompletada":obj.quantity
                    }
                  }
              );
          
            // Se recorren y se agrupan las mismas ots.
            allOTs.forEach(element => {
              // Se obtienen los valores filtrados
              this.dataJson.push(dataModified.filter(key => key.ot == element))
            });

            const agrupados = {};
           
            this.dataJson.flatMap((arr) => arr).forEach((obj) => {
              const { ot, cantidadCompletada } = obj;
              if (!agrupados[ot]) {
                agrupados[ot] = {};
              }
              if (!agrupados[ot][cantidadCompletada]) {
                agrupados[ot][cantidadCompletada] = [];
              }
              agrupados[ot][cantidadCompletada].push(obj);
            });
            
            console.log('agrupados: ', agrupados)
            
            // Crea un nuevo libro de trabajo
            const workbook = new ExcelJS.Workbook();
            
            // Crea una nueva hoja de trabajo
            const worksheet = workbook.addWorksheet('Datos');
            
            // Crea la cabecera de la hoja de trabajo
            worksheet.columns = [
              { header: 'ID Externo', key: 'id', width: 10 },
              { header: 'OT', key: 'ot', width: 30 },
              { header: 'JSON', key: 'json', width: 50 },
            ];
            
           var lastid = this.currentLastId

            allOTs.forEach(ots => {
              for(const key in agrupados[ots]){
                // delete "id" and "ot" for each object in the array
                agrupados[ots][key].forEach((obj) => {
                  delete obj.id;
                  delete obj.ot;
                });
                worksheet.addRow({
                  id: lastid,
                  ot: 'Orden de trabajo #OT' + ots,
                  json: JSON.stringify(agrupados[ots][key]),
                });
                lastid += 1
              }
            });

            // Crea un objeto Blob a partir del archivo de Excel

            workbook.csv.writeBuffer({ formatterOptions: { delimiter: ";" } })
            .then((csv) => {

              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

              // Crea un objeto URL a partir del Blob
              const url = URL.createObjectURL(blob);

              // Crea un enlace para descargar el archivo de Excel
              const link = document.createElement('a');
              link.href = url;
              link.download = `Timer-${new Date().toLocaleDateString()}.csv`;
              document.body.appendChild(link);
              link.click();

              // Elimina el objeto URL y el enlace
              URL.revokeObjectURL(url);
              document.body.removeChild(link);
            })
            .catch((error) => {
              console.log('Se produjo un error al crear el archivo de Excel', error);
            });

            // var valoresAgrupados = []

            // allOTs.forEach((ot) => {
            //   var buffer = []
            //   for (const key in agrupados[ot]) {
            //     buffer.push(agrupados[ot][key])
            //   }
            //   valoresAgrupados.push(buffer);
            // });


            // // Ahora se deben filtrar aquellos datos con cantidadCompletada distintas en una misma OT.
            // for (let idx = 0; idx < this.dataJson.length; idx++) {
            //   var lastOt = -1
            //   var lastValue = -1
            //   // Se recorre el objeto agrupado por OT.
            //   for (const json of this.dataJson[idx]) {
            //     console.log('Ots que estan en dataJson: ', json.ot)
            //     // Si el valor anterior de ot y de cantidad completada son iguales
            //     // entonces no debemos guardalor nuevamente.
            //     if ((lastOt == json.ot) && lastValue == json.cantidadCompletada) continue;
                
            //     //console.log('ot: ', json.ot, 'cantidadCompletada: ', json.cantidadCompletada)

            //     this.dataJsonFilter.push(dataModified.filter(x => (x.cantidadCompletada == json.cantidadCompletada) && (x.ot == json.ot)))

            //     lastOt = json.ot
            //     lastValue = json.cantidadCompletada
            //   }
            // }

            // var lastid = this.currentLastId

            // Agrega los datos a la hoja de trabajo
            // for (let i = 0; i < valoresAgrupados.length; i++) {
            //   var information = valoresAgrupados[i][0]
            //   console.log('information: ',information)
            // }
            // valoresAgrupados.forEach((row) => {
            //   worksheet.addRow({
            //     id: lastid,
            //     ot: 'Orden de trabajo #OT' + row.ot,
            //     nuevoDato: 'Valor nuevo',
            //   });
            //   lastid += 1
            // });

            // // Se convierte en formato .csv
            // var csv = ""
            // var newid = 0
            // for (let i = 0; i < valoresAgrupados.length; i++) {
            //   var jsonObject1 = valoresAgrupados[i]//JSON.stringify(this.dataJson[i]);
            //   console.log('jsonObject1: ',jsonObject1)
            //   // Se define el newid, para que nos valores no sean repetidos.
            //   newid = lastid + i
            //   if(i == 0){
            //     csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "ID Externo"+this.delimiter+"OT"+this.delimiter+"JSON" + '\r\n', newid);
            //   }else{
            //     csv += this.convertToCSV(jsonObject1, ["id", "ot", "JSON"], "", newid);
            //   }
            // }
            
            // // Se crea el objeto URL para descargar el .csv
            // const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
            // const link = document.createElement('a')
            // link.href = url
            // link.setAttribute(
            //   'download',
            //   `Timer-${new Date().toLocaleDateString()}.csv`
            // )
            // document.body.appendChild(link)
            // link.click()
            
            // // Ahora, para finalizar debemos actualizar el lastId
            // if(newid > lastid) this.updatelastId({"lastid": newid})

            // this.dataJson = []
            // this.dataJsonFilter = []

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