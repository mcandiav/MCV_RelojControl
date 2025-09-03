<template>
    <v-container fluid class="pt-0">
      <v-dialog
        v-model="dialog"
        width="500"
      >
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            color="red lighten-2"
            dark
            v-bind="attrs"
            v-on="on"
            class="my-0 py-0"
          >
            Subir información
          </v-btn>
        </template>
  
        <v-card>
          <v-card-title class="text-h5 grey lighten-2">
            Cargar archivo
          </v-card-title>
  
        <v-file-input
        label="Selecciona el archivo excel."
        outlined
        dense
        class="mt-4 mr-6"
        v-model="fileInput"
        :error="this.error"
        :disabled="loading"
        :error-messages="error_message"
        ></v-file-input>

        <v-card-actions>
          <v-btn 
          color="success" 
          @click="uploadFile()" 
          :loading="loading"
          >
              Subir
          </v-btn>
        </v-card-actions>

        </v-card>
      </v-dialog>
      <DialogAlert/>
    </v-container>
</template>

<script>
import axios from 'axios';
import DialogAlert from '@/components/alert/DialogAlert.vue'
import { mapActions, mapMutations } from 'vuex'

export default {
    components:{
      DialogAlert
    },
    data(){
        return{
            dialog: false,
            fileInput: null,
            loading: false,
            error: null,
            error_message: null
        }
    },
    methods: {
      ...mapMutations({
        SET_SNACK_COLOR: 'alert/SET_SNACK_COLOR'
      }),
      ...mapActions({
        snack: 'alert/snack'
      }),
      async uploadFile() {
          // Obtener la lista de archivos seleccionados
          const files = this.fileInput;

          if(files === null){
            this.error = true
            return
          }

          if(files.name.split(".").pop() !== 'xls' && files.name.split(".").pop() !== 'xlsx'){
            this.error = true
            this.error_message = "El archivo debe ser .xlsx o .xls"
            return
          }

          // El boton queda en estado cargando...
          this.loading = true
          this.error = false

          // Crear una instancia de FormData para almacenar el archivo
          const formData = new FormData();
          formData.append('file', files);
          try {
            // Enviar el archivo al backend usando Axios
            await axios.post('/upload', formData, {
              headers: {
              'Content-Type': 'multipart/form-data'
              }
            }).then(()=>{
              this.loading = false
              this.error_message = ""
              this.error = false
              this.dialog = false
              this.snack({text: "Archivo subido correctamente", color: 'success'})
            })
          } catch (error) {
            this.snack({text: "Error en el archivo. Por favor, verifica las columnas.", color: 'error'})
            this.loading = false
            this.error = false
            this.dialog = false
          }
      }
    },
}
</script>

<style>

</style>