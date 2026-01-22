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
          :dark="!['Completado', 'En curso', 'En montaje'].includes(items.state)"
          small
          color="success"
          v-bind="attrs"
          v-on="on"
          :disabled="['Completado', 'En curso', 'En montaje'].includes(items.state)"
        >
          <v-icon dark>
            mdi-play
          </v-icon>
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <span class="text-h5 text-center" v-if="!this.items.finished_assembly">Iniciar/Resumir Montaje {{this.items.ot}}</span>
          <span class="text-h5 text-center" v-else>Iniciar/Resumir {{this.items.ot}}</span>
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
            @click="play(items)"
          >
            Comenzar
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
      async play(item) {
        if (this.isSubmitting) return;

        this.isSubmitting = true;
        console.log("Iniciando montaje de la orden: ", item);

        try {
          const response = await axios.post('/order/play', item);
          if (response.status === 200) {
            console.log('Comenzado exitosamente.');
            await this.getListOrder(this.currentSearch);
            this.dialog = false;
          }
        } catch (error) {
          console.error('Error al iniciar la orden:', error);
        } finally {
          this.isSubmitting = false;
        }
      }
    },
    computed:{
      ...mapGetters({
        currentSearch: 'order/currentSearch'
      })
    }
  }
</script>