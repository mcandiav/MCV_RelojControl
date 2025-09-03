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
          :dark="!['No iniciado', 'Completado'].includes(items.state)"
          small
          color="danger"
          v-bind="attrs"
          v-on="on"
          :disabled="['No iniciado', 'Completado'].includes(items.state)"
        >
          <v-icon dark>
            mdi-stop
          </v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <span class="text-h5 text-center" v-if="!this.items.finished_assembly">Detener Montaje {{this.items.ot}}</span>
          <span class="text-h5 text-center" v-else>Finalizar {{this.items.ot}}</span>
        </v-card-title>
        <div v-if="this.items.finished_assembly">
          <v-card-text>
            <v-container>
              <v-row>
                <v-col
                  cols="12"
                  sm="12"
                  md="12"
                >
                <v-form v-model="valid">
                  <v-text-field
                    v-model.number="quantity"
                    label="Ingrese cantidad terminada."
                    :rules="quantityResource"
                    required
                  ></v-text-field>
                </v-form>
                </v-col>
              </v-row>
            </v-container>
          </v-card-text>
        </div>
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
            Finalizar
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
      valid: false,
      quantityResource: [
        v => v >= 0 || 'La cantidad debe ser positiva.'
      ],
    }),
    methods: {
      ...mapActions({
      getListOrder: 'order/getListOrder',
      }),
      pause(item){
        if(!this.items.finished_assembly){
          item.quantity = this.quantity
          // En el caso de que la cantidad ingresada supere la cantidad planificada, alertar al usuario.
          axios.post('/order/stop', item).then(response => {
                if(response.status == 200){
                    console.log('Pausado exitosamente.')
                    this.getListOrder(this.currentSearch)
                    this.dialog = false
                }
            })
        }
        if((this.quantity !== null && this.quantity >=0) && this.items.finished_assembly){
            item.quantity = this.quantity
            if(this.quantity > this.items.n_times_paused){
              if(confirm('La cantidad ingresada supera la cantidad planificada. ¿Desea continuar?')){
                axios.post('/order/stop', item).then(response => {
                  if(response.status == 200){
                      console.log('Pausado exitosamente.')
                      this.getListOrder(this.currentSearch)
                      this.dialog = false
                  }
                })
              }
            }else{
              axios.post('/order/stop', item).then(response => {
                if(response.status == 200){
                    console.log('Pausado exitosamente.')
                    this.getListOrder(this.currentSearch)
                    this.dialog = false
                }
              })
            }
        }
      },
    },
    computed:{
      ...mapGetters({
        currentSearch: 'order/currentSearch'
      })
    }
  }
</script>