<template>
  <v-row justify="center">
    <v-dialog
      v-model="dialog"
      persistent
      max-width="400px"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          class="my-3"
          fab
          dark
          small
          color="error"
          v-bind="attrs"
          v-on="on"
        >
          <v-icon dark>
            mdi-delete
          </v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <span class="text-center">Eliminando: {{this.items.ot}}</span>
        </v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="error darken-1"
            text
            @click="dialog = false"
          >
            Cancelar
          </v-btn>
          <v-btn
            color="error"
            text
            @click="remove(items)"
          >
            Eliminar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import axios from 'axios'
import { mapActions, mapGetters } from 'vuex'

export default {
    props: ['items'],
    data: () => ({
      pass: "",
      dialog: false,
      length_password: 5, // CAMBIAR LARGO EN CASO DE ERROR CON LA CLAVE.
      valid: true
    }),
    methods: {
        ...mapActions({
        getListOrder: 'order/getListOrder',
        }),
        remove(item){
          //console.log(item)
          axios.post('/order/delete', item).then((response) => {
            if(response.status == 200){
                console.log('Eliminado exitosamente.')
                this.getListOrder(this.currentSearch)
                this.dialog = false
                this.valid = true
            }
          }).catch(() => {
            this.pass = "",
            this.valid = false
          })
        },
    },
    computed: {
      ...mapGetters({
        currentSearch: 'order/currentSearch'
      }),
      isActive () {
        return this.pass.length === this.length_password
      },
    },
    watch: {
      dialog: function(newValue){
        if(!newValue){
          this.pass = "",
          this.valid = true
        }
      }
    }
  }
</script>