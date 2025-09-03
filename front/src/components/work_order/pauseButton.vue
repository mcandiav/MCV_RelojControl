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
          :dark="!['No iniciado', 'Completado', 'Pausado'].includes(items.state)"
          small
          color="orange lighten-2"
          v-bind="attrs"
          v-on="on"
          :disabled="['No iniciado', 'Completado', 'Pausado'].includes(items.state)"
        >
          <v-icon dark>
            mdi-pause
          </v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <span class="text-h5 text-center" v-if="!this.items.finished_assembly">Pausar Montaje {{this.items.ot}}</span>
          <span class="text-h5 text-center" v-else>Pausar {{this.items.ot}}</span>
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
            color="blue darken-1"
            text
            @click="pause(items)"
          >
            Pausar
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
      dialog: false,
      quantity: null,
      quantityResource: [
          v => v >= 0 || 'La cantidad debe ser positiva.'
      ],
    }),
    methods: {
      ...mapActions({
      getListOrder: 'order/getListOrder',
      }),
      pause(item){
        axios.post('/order/pause', item).then(response => {
            if(response.status == 200){
                console.log('Pausado exitosamente.')
                this.getListOrder(this.currentSearch)
                this.dialog = false
            }
        })
      },
    },
    computed:{
      ...mapGetters({
        currentSearch: 'order/currentSearch'
      })
    }
  }
</script>