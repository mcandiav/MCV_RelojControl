<template>
    <div>
        <v-dialog v-model="dialog" height="500px">
            <template v-slot:activator="{ on, attrs }">
                <v-btn class="my-3 py-0 mx-3" dark color="black" v-bind="attrs" v-on="on">
                    Reporte Reloj control
                </v-btn>
            </template>
            <v-card>
                <v-card-title class="text-center">
                    Reporte Reloj Control
                </v-card-title>
                <v-card-text>
                    <v-row>
                        <v-col cols="3">
                            <v-select
                            v-model="pickerType"
                            :items="pickerTypes"
                            label="Tipo de selección"
                            ></v-select>
                            <v-row justify="center" class="my-2">
                                <v-date-picker
                                v-model="picker"
                                :type="pickerType"
                                locale="es"
                                :max="new Date().toISOString()"
                                :allowed-dates="val => {
                                        const [year, month] = val.split('-').map(num => parseInt(num, 10));
                                        const currentYear = new Date().getFullYear();
                                        const currentMonth = new Date().getMonth() + 1;

                                        // Permitir años anteriores al actual o meses válidos en el año actual
                                        return year < currentYear || (year === currentYear && month <= currentMonth);
                                    }"
                                multiple
                                ></v-date-picker>
                            </v-row>
                        </v-col>
                        <v-divider vertical thickness="5"></v-divider>
                        <v-col cols="9">
                            <v-simple-table dense height="500px" :show-expand="true" :expanded.sync="expanded">
                                <template v-slot:default>
                                    <thead>
                                        <tr>
                                            <!-- <th class="text-left">
                                                Hora entrada
                                            </th>
                                            <th class="text-left">
                                                Hora salida
                                            </th> -->
                                            <th class="text-left">
                                                Nombre
                                            </th>
                                            <th class="text-left">
                                                OT
                                            </th>
                                            <th class="text-left">
                                                Operación
                                            </th>
                                            <th class="text-left">
                                                Secuencia
                                            </th>
                                            <th class="text-left">
                                                Cantidad planificada
                                            </th>
                                            <th class="text-left">
                                                Cantidad
                                            </th>
                                            <th class="text-left">
                                                Tiempo montaje planificado (min)
                                            </th>
                                            <th class="text-left">
                                                Tiempo ejecución planificado (min)
                                            </th>
                                            <th class="text-left">
                                                Tiempo montaje (min)
                                            </th>
                                            <th class="text-left">
                                                Tiempo ejecución (min)
                                            </th>
                                            <th class="text-left">
                                                Timepo pausa (min)
                                            </th>
                                            <th class="text-left">
                                                Reloj inicio
                                            </th>
                                            <th class="text-left">
                                                Reloj fin
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="item in reportInfo" :key="item.start_time">
                                            <!-- <td>{{ item.User.sign_in | formatDate }}</td>
                                            <td>{{ item.User.sign_out === null ? null:item.User.sign_out | formatDate }}</td> -->
                                            <td>{{ item.name}}</td>
                                            <td>{{ item.ot }}</td>
                                            <td>{{ item.resource }}</td>
                                            <td>{{ item.item }}</td>
                                            <td>{{ item.quantity_expected }}</td>
                                            <td>{{ item.quantity }}</td>
                                            <td>{{ item.assembly_time }}</td>
                                            <td>{{ item.ejecution_time }}</td>
                                            <td>{{ item.total_time_assembly}}</td>
                                            <td>{{ item.total_time_ejecution }}</td>
                                            <td>{{ item.time_out }}</td>
                                            <td> {{ item.start_time | formatDate}}</td>
                                            <td>{{ item.end_time === null ? null:item.end_time | formatDate }}</td>
                                        </tr>
                                    </tbody>
                                </template>
                                <template v-slot:expanded-item="{ item }">
                                    <!-- Contenido adicional o detalles de la fila expandida -->
                                    <td :colspan="headers.length">
                                        {{ item.Details }}
                                    </td>
                                </template>
                            </v-simple-table>
                        </v-col>
                        <v-col>
                            <v-card-actions>
                            <v-btn @click="buscar(picker)" dark color="light-green" :disabled="picker === null" :loading="buttonGenerateReport" >
                                Generar reporte
                            </v-btn>
                            <v-btn @click="descargar()" dark class="mx-5" color="#EF5350" :disabled="this.reportInfo === null" >
                                Descargar
                            </v-btn>
                        </v-card-actions>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>
  
<script>
import axios from 'axios'
import ExcelJS from 'exceljs';

export default {
    data() {
        return {
            dialog: false,
            dates: [],
            disabled: true,
            workers: [],
            workers_copy: [],
            expanded: [],
            details: false,
            // Variables para el selector de fechas
            reportInfo: null,
            picker: null,
            pickerType: 'month',
            pickerTypes: [
                //{ text: 'Día', value: 'date' },
                { text: 'Mes', value: 'month' }
            ],
            buttonGenerateReport: false
        }
    },
    filters: {
        formatDate: function (value) {
            const date = new Date(value);
            // Si la fecha es igual a "12/31/1969, 9:00:00 PM", es porque el valor es null
            if (date.getFullYear() === 1969) {
                return 'Sin registro';
            }
            return date.toLocaleString(); // Se puede utilizar cualquier otro formato de fecha
        }
    },
    methods: {
        async buscar(yearMonthdays){
            // Hacemos que el boton quede en estado de carga
            this.buttonGenerateReport = true
            console.log('yearMonthdays: ', yearMonthdays)

            if(this.pickerType === 'month'){

                // Consumimos los recursos de la API report
                await axios.post('/order/timerReport', { yearMonthdays })
                    .then(response => {
                        if(response.status === 200){
                            this.reportInfo = response.data;
                        }
                    })
                    .catch(error => {
                        // Manejar el error
                        console.log(error)
                    })

                console.log('this.reportInfo: ', this.reportInfo)
            }
            if(this.pickerType === 'date'){

                // Consumimos los recursos de la API report
                await axios.post('/order/timerReportbyDay', { yearMonthdays })
                    .then(response => {
                        if(response.status === 200){
                            this.reportInfo = response.data;
                        }
                    })
                    .catch(error => {
                        // Manejar el error
                        console.log(error)
                    })

                console.log('this.reportInfo: ', this.reportInfo)
            }
            this.buttonGenerateReport = false
        },
        formatDateDownload: function (value) {
            const date = new Date(value);
            // Si la fecha es igual a "12/31/1969, 9:00:00 PM", es porque el valor es null
            if (date.getFullYear() === 1969) {
                return 'Sin registro';
            }
            return date.toLocaleString(); // Se puede utilizar cualquier otro formato de fecha
        },
        formatFinalized(item){
            if(item.Finalized === null && item.Record === null){
                return null
            }
            else if(item.Finalized === null && item.Record !== null){
                return item.Record
            }
            else if(item.Finalized !== null && item.Record === null){
                return item.Finalized
            }
            else{
                return item.Finalized
            }
        },
        async descargar(){
            // Primero debemos cargar los datos a la variable "this.workers"
            // await this.buscar();
            if(this.reportInfo.length === 0){
                return;
            }

            console.log("Descargando...")
                
            // Crea un nuevo libro de trabajo
            const workbook = new ExcelJS.Workbook();
            
            // Crea una nueva hoja de trabajo
            const worksheet = workbook.addWorksheet('Datos');

            // Crea la cabecera de la hoja de trabajo
            worksheet.columns = [
                // { header: 'Hora entrada', key: 'sign_in', width: 30 },
                // { header: 'Hora salida', key: 'sign_out', width: 30 },
                { header: 'Nombre', key: 'name', width: 30 },
                { header: 'Orden de trabajo', key: 'ot', width: 30 },
                { header: 'Operación', key: 'resource', width: 50 },
                { header: 'Secuencia', key: 'item', width: 10 },
                { header: 'Cantidad planificada', key: 'quantity_expected', width: 10 },
                { header: 'Cantidad', key: 'quantity', width: 10 },
                { header: 'Tiempo montaje planificado (min)', key: 'assembly_time', width: 30 },
                { header: 'Tiempo ejecución planificado (min)', key: 'ejecution_time', width: 30 },
                { header: 'Tiempo montaje (min)', key: 'total_time_assembly', width: 30 },
                { header: 'Tiempo ejecución (min)', key: 'total_time_ejecution', width: 30},
                { header: 'Tiempo pausa (min)', key: 'time_out', width: 30 },
                { header: 'Reloj inicio', key: 'start_time', width: 30 },
                { header: 'Reloj fin', key: 'end_time', width: 30 },
            ];

            // Transformamos el objeto "this.workers" a un array de objetos
            const workersArray = Object.values(this.reportInfo);
            
            // Recorre los datos y agrega las filas a la hoja de trabajo
            workersArray.forEach(worker => {
                console.log(worker)
                const row = {
                    // sign_in: new Date(worker.User.sign_in).getFullYear() === 1969 ? "Sin registro":this.formatDateDownload(worker.User.sign_in),
                    // sign_out: new Date(worker.User.sign_out).getFullYear() === 1969 ? "Sin registro":worker.User.sign_out,
                    name: worker.name,
                    ot: worker.ot,
                    resource: worker.resource,
                    item: worker.item,
                    quantity_expected: worker.quantity_expected,
                    quantity: worker.quantity,
                    assembly_time: worker.assembly_time,
                    ejecution_time: worker.ejecution_time,
                    total_time_assembly: worker.total_time_assembly ,
                    total_time_ejecution: worker.total_time_ejecution,
                    time_out: worker.time_out,
                    start_time: new Date(worker.start_time).getFullYear() === 1969 ? "Sin registro":this.formatDateDownload(worker.start_time),
                    end_time: new Date(worker.end_time).getFullYear() === 1969 ? "Sin registro":this.formatDateDownload(worker.end_time),
                };
                worksheet.addRow(row);
            });

            // Finalmente, descarga el archivo Excel
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            // Agregar la fecha actual al nombre del archivo
            const fileName = 'ReporteRelojControl_' + new Date().toLocaleDateString() + '.xlsx';
            if (window.navigator.msSaveOrOpenBlob) {
                // Para IE11
                window.navigator.msSaveOrOpenBlob(blob, fileName);
            } else {
                // Para otros navegadores
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            }
        }
    },
    watch: {
        dates() {
            if (this.dates.length > 0) {
                this.disabled = false
            }
        },
        // Me queda por hacer esto.
        details(){
            if(this.details === true){
                this.workers = []
                console.log("Mostrar detalles")
                this.workers_copy.forEach(worker => {
                    if (worker.Details.length > 0) {
                        worker.Details.forEach(detail => {
                            const tmp_worker = JSON.parse(JSON.stringify(worker)); // Copia el objeto worker completamente
                            tmp_worker.Finalized = {}; // Reinicia el objeto Finalized para evitar compartir referencias
                            tmp_worker.Finalized.start_time = detail.start_time;
                            tmp_worker.Finalized.end_time = detail.end_time;
                            tmp_worker.Finalized.state = detail.state;
                            tmp_worker.Finalized.total_time = detail.total_time;
                            tmp_worker.Finalized.ot = detail.ot;
                            tmp_worker.Finalized.resource = detail.resource;
                            tmp_worker.Finalized.quantity = detail.quantity;
                            tmp_worker.Finalized.total_time_assembly = detail.total_time_assembly;
                            tmp_worker.Finalized.total_time_ejecution = detail.total_time_ejecution;
                            tmp_worker.start_time = detail.start_time; // Asigna start_time a worker (no a Finalized)
                            tmp_worker.end_time = detail.end_time; // Asigna end_time a worker (no a Finalized)
                            this.workers.push(tmp_worker);
                        });
                    }
                    else if(worker.Finalized !== null){
                        console.log("Finalizado")
                        this.workers.push(worker)
                    }
                    else if(worker.Record !== null){
                        console.log("Record")
                        this.workers.push(worker)
                    }

                });

                console.log(this.workers)
            }else{
                console.log("Ocultar detalles")
                this.workers = []
                this.workers = this.workers_copy
            }
        }
    },
}
</script>
  
<style></style>