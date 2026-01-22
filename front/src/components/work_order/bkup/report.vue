<template>
    <div>
        <v-dialog v-model="dialog" height="500px">
            <template v-slot:activator="{ on, attrs }">
                <v-btn class="my-0 py-0 mx-3" dark color="light-orange" v-bind="attrs" v-on="on">
                    Reporte
                </v-btn>
            </template>
            <v-card>
                <v-card-title class="text-center">
                    Informe de cumplimiento 
                </v-card-title>
                <v-card-subtitle class="text-center">
                    Se consideran 6 horas diarias de trabajo en el cálculo.
                </v-card-subtitle>
                <v-card-text>
                    <v-row>
                        <v-col cols="4">
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
                                ></v-date-picker>
                            </v-row>
                        </v-col>
                        <v-divider vertical thickness="5"></v-divider>
                        <v-col cols="8">
                            <v-simple-table dense height="500px">
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
                                                Horas
                                            </th>
                                            <th class="text-left">
                                                Cumplimiento (%)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="item in reportInfo" :key="item.name">
                                            <!-- <td>{{ item.User.sign_in | formatDate }}</td>
                                            <td>{{ item.User.sign_out === null ? null:item.User.sign_out | formatDate }}</td> -->
                                            <td>{{ item.name}}</td>
                                            <td>{{ item.monthlyHours }}</td>
                                            <td>{{ item.compliance }}</td>
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
                        <v-card-actions>
                            <v-btn @click="buscar(picker)" dark color="light-green" :disabled="picker === null">
                                Generar reporte
                            </v-btn>
                            <v-btn @click="descargar(picker)" dark class="mx-5" color="#EF5350" :disabled="this.reportInfo === null" >
                                Descargar
                            </v-btn>
                        </v-card-actions>
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
            disabled: true,
            details: false,
            picker: null,
            reportInfo: null,
            pickerType: 'date',
            pickerTypes: [
                { text: 'Día', value: 'date' },
                { text: 'Mes', value: 'month' },
            ]
        }
    },
    methods: {
        async buscar(yearMonthdays){

            console.log('yearMonthdays: ', yearMonthdays)

            if(this.pickerType === 'month'){
                // Filtra los datos por mes y año
                const year = yearMonthdays.split('-')[0];
                const month = yearMonthdays.split('-')[1];

                // Consumimos los recursos de la API report
                await axios.post('/order/report', { year, month })
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
                // Filtra los datos por día
                const year = yearMonthdays.split('-')[0];
                const month = yearMonthdays.split('-')[1];
                const day = yearMonthdays.split('-')[2];

                console.log('day, month, year: ', day, month, year)

                // Consumimos los recursos de la API report
                await axios.post('/order/reportbyDay', { year, month, day })
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
        },

        async descargar(){
        
            // Crea un nuevo libro de trabajo
            const workbook = new ExcelJS.Workbook();
            
            // Crea una nueva hoja de trabajo
            const worksheet = workbook.addWorksheet('Informe de cumplimiento');

            // Crea la cabecera de la hoja de trabajo
            worksheet.columns = [
                { header: 'Trabajadores', key: 'name', width: 30 },
                { header: 'Horas Mensuales (hrs)', key: 'monthlyHours', width: 30 },
                { header: 'Cumplimiento (%)', key: 'compliance', width: 30 }
            ];

            // Transformamos el objeto "this.workers" a un array de objetos
            const workersArray = Object.values(this.reportInfo);
            
            // Recorre los datos y agrega las filas a la hoja de trabajo
            workersArray.forEach(info => {
                const row = {
                    name: info.name,
                    monthlyHours: info.monthlyHours,
                    compliance: info.compliance
                };
                worksheet.addRow(row);
            });

            // Finalmente, descarga el archivo Excel
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            // Agregar la fecha actual al nombre del archivo
            const fileName = 'ReporteCumplimiento_' + new Date().getFullYear() + '-' + new Date().getMonth() + '.xlsx';
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
            //this.dialog = false;
        }
    }
}
</script>
  
<style></style>