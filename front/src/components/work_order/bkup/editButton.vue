<template>
  <v-row justify="center">
    <v-dialog
      v-model="dialog"
      persistent
      max-width="600px"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          class="my-3"
          fab
          small
          dark
          color="light-blue"
          v-bind="attrs"
          v-on="on"
        >
          <v-icon dark>
            mdi-pencil
          </v-icon>
        </v-btn>
      </template>
      <v-card v-if="items">
        <v-card-title>
          <span class="text-h5 text-center">Editar: {{ this.items.resource }}</span>
        </v-card-title>
        <v-card-text>
          <v-form v-model="valid" ref="editOrder">
          <v-container>
            <v-row>
              <v-col
                cols="12"
                sm="6"
                md="4"
              >
              <v-autocomplete
              v-model="editedItem.resource"
              :items="resources"
              :loading="isLoading_resource"
              :search-input.sync="search_resource"
              :rules="nameResource"
              type="string"
              hide-no-data
              hide-details
              item-text="resource"
              item-value="resource"
              label="Buscar recurso"
                >
              </v-autocomplete>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="4"
              >
              <v-autocomplete
                v-model="editedItem.ot"
                :items="ots"
                :loading="isLoading"
                :search-input.sync="search_ot"
                :rules="OTRules"
                type="number"
                hide-details
                hide-selected
                item-text="ot"
                item-value="ot"
                label="Buscar orden de trabajo."
                >
            </v-autocomplete>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="4"
              >
                <v-text-field
                  v-model="editedItem.item"
                  :rules="itemRules"
                  label="Ingresar secuencia"
                ></v-text-field>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="4"
              >
                <v-text-field
                  v-model="editedItem.assembly_time"
                  :rules="timeRules"
                  label="Ingresar tiempo estimado de montaje"
                ></v-text-field>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="4"
              >
                <v-text-field
                  v-model="editedItem.estimated_time"
                  :rules="timeRules"
                  label="Ingresar tiempo estimado de fabricación"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-container>
        </v-form>
        </v-card-text>
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
            @click="edit(items)"
          >
            Editar
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
    props: ['items', 'create'],
    data: () => ({
      dialog: false,
      editedIndex: -1,
      resources: [],
      ots: [],
      valid: false,
      search_resource: null,
      isLoading_resource: false,
      search_ot: null,
      isLoading: false,
      editedItem: {
        resource: 0,
        ot: 0,
        item: 0,
        assembly_time: 0,
        estimated_time: 0,
      },
      nameResource: [
        v => !!v || 'El nombre del recurso es necesario.',
        v => v.length <= 500 || 'El nombre del recurso contener menos de 500 caracteres.',
      ],
      OTRules: [
        v => !!v || 'Se debe ingresar una orden de trabajo.',
      ],
      timeRules: [
        v => v > 0 || 'El tiempo debe ser mayor a 0.'
      ],
      itemRules: [
        v => !!v || 'La secuencia es necesaria.',
        v => v >= 0 || 'El item debe ser mayor o igual a 0.'
      ]
    }),
    watch: {
      dialog (val) {
        if(val){
          this.editedItem = Object.assign({}, this.items)
        }
      },
      search_ot (val) {
          // Items have already been loaded
          //if (this.items.length > 0) return

          // Items have already been requested
          if (this.isLoading) return

          this.isLoading = true

          // Lazily load input items
          axios.get('/order/resource?search=' + val)
          .then(res => {
              this.ots = res.data
          })
          .catch(err => {
              console.log(err)
          })
          .finally(() => {
              this.isLoading = false
              if(this.ots.length < 1){
                  this.ots = [{
                      "id": 99999,
                      "ot": val,
                  }]
              }
          })
      },
      search_resource (val) {
        // Items have already been loaded
        //if (this.items.length > 0) return

        // Items have already been requested
        if (this.isLoading_resource) return

        this.isLoading_resource = true

        // Lazily load input items
        axios.get('/order/resource?search=' + val)
        .then(res => {
            this.resources = res.data
        })
        .catch(err => {
            console.log(err)
        })
        .finally(() => {
            this.isLoading_resource = false
        })
      },
    },
    methods: {
      ...mapActions({
      getListOrder: 'order/getListOrder',
      snack: 'alert/snack'
      }),
      edit(){
        if(this.valid){
          axios.post('/order/edit', this.editedItem).then(response => {
              if(response.status == 200){
                  this.snack({text: "Editado correctamente!", color: "success"})
                  this.getListOrder(this.currentSearch)
                  this.dialog = false
              }
          })
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