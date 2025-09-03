<template>
    <v-app>
      <appbar/>
      <v-container fluid>
      <div v-if="this.user !== null">
        <v-avatar color="indigo">
            <v-icon dark>
                mdi-account-circle
            </v-icon>
        </v-avatar>
        Usuario: {{user.name}} {{ user.lastname}} | Rol: {{user.Role.name}} | C. Fabricación: {{ user.Workplace.name === "" ? 'Todos':user.Workplace.name}}
      </div>
      </v-container>
      <v-divider></v-divider>
      <!-- <createOrder v-if="isAdmin"/> -->
      <uploadExcel v-if="isAdmin"/>
      <download v-if="isAdmin"/>
      <listWorkers v-if="isAdmin"/>
      <createUser v-if="isAdmin"/>
      <deleteAllButton v-if="isAdmin" />
      <report v-if="isAdmin"/>
      <timerReport v-if="isAdmin"/>
      <tableWork />
    </v-app>
  </template>
  
  <script>
  import '@mdi/font/css/materialdesignicons.css'
  import appbar from '@/components/navegation/appbar.vue'
  // import createOrder from '@/components/work_order/createOrder.vue'
  import tableWork from '@/components/work_order/tableData.vue'
  import uploadExcel from '@/components/upload_file/upload_excel.vue'
  import download from '@/components/work_order/download.vue'
  import createUser from '@/components/user/createUser.vue'
  import listWorkers from '@/components/work_order/listWorkers.vue'
  import deleteAllButton from '@/components/work_order/deleteAllButton.vue'
  import report from '@/components/work_order/report.vue'
  import timerReport from '@/components/work_order/timerReport.vue'
  import { mapGetters } from 'vuex'
  
  export default {
    name: 'App',
    components: {
      appbar,
      // createOrder,
      tableWork,
      uploadExcel,
      download,
      createUser,
      listWorkers,
      deleteAllButton,
      report,
      timerReport
    },
    data (){
      return {
      }
    },
    created(){
    },
    mounted(){
    },
    methods: {
    },
    computed: {
        ...mapGetters({
            user: 'auth/user',
            isAdmin: 'auth/isAdmin'
        })
    }
  
  };
  </script>