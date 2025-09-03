<template>
  <v-container fluid>
      <v-dialog
      v-model="dialog"
      max-width="800"
      >
          <template v-slot:activator="{ on, attrs }">
              <v-btn
              v-bind="attrs"
              v-on="on"
              color="primary"
              >
                Crear orden
              </v-btn>
          </template>

          <v-card>
              <v-card-title class="text-center">
                  Creando Orden de Trabajo con Timer.
              </v-card-title>

              <v-card-text>
                    <v-form v-model="valid" ref="createOrder">
                        <v-container>
                        <v-row>
                            <v-col
                            cols="5"
                            md="5"
                            >
                            <v-autocomplete
                            v-model="form.resource"
                            :items="resources"
                            :loading="isLoading_resource"
                            :search-input.sync="search_resource"
                            :rules="nameResource"
                            hide-no-data
                            hide-details
                            item-text="resource"
                            item-value="resource"
                            label="Buscar recurso"
                            >
                            </v-autocomplete>
                    </v-col>
                    <v-col
                    cols="2"
                    md="2"
                    >
                    <v-text-field
                        v-model="form.item"
                        :rules="itemRules"
                        label="Secuencia de operaciones"
                        required
                        @keypress="isNumber($event)"
                    ></v-text-field>
                    </v-col>
                    <v-col
                    cols="5"
                    md="5"
                    >
                    <v-autocomplete
                        v-model="form.ot"
                        :items="items"
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
                        <template v-slot:no-data>
                            <v-list-item>
                            <v-list-item-title>
                                Buscar
                                <strong>Orden de Trabajo</strong>
                            </v-list-item-title>
                            </v-list-item>
                        </template>
                        <template v-slot:selection="{ attr, on, item, selected }">
                            <v-chip
                            v-bind="attr"
                            :input-value="selected"
                            color="blue-grey"
                            class="white--text"
                            v-on="on"
                            >
                            <span v-text="item.ot"></span>
                            </v-chip>
                        </template>
                        <template v-slot:item="{ item }">
                            <v-list-item-content>
                                <v-list-item-title><strong>Orden de Trabajo</strong></v-list-item-title>
                            </v-list-item-content>
                            <v-list-item-content>
                                <v-list-item-title >{{ item.ot }}</v-list-item-title>
                            </v-list-item-content>
                            <v-list-item-action>
                            </v-list-item-action>
                        </template>
                    </v-autocomplete>
                    </v-col>
                    <v-col
                    cols="4"
                    md="4"
                    >
                        <v-text-field
                            v-model="form.assembly_time"
                            :rules="timeRules"
                            label="Tiempo de montaje"
                            required
                        ></v-text-field>
                    </v-col>
                    <v-col
                    cols="4"
                    md="4"
                    >
                        <v-text-field
                            v-model="form.estimated_time"
                            :rules="timeRules"
                            label="Tiempo de fabricación"
                            required
                        ></v-text-field>
                    </v-col>
                </v-row>
                </v-container>
                </v-form>
            </v-card-text>

              <v-card-actions>
                  <v-btn
                  color="primary"
                  @click="submit"
                  >
                      Crear
                  </v-btn>
              </v-card-actions>
          </v-card>
      </v-dialog>
      <!-- <DialogAlert/> -->
  </v-container>
</template>

<script>
import axios from 'axios'
import { mapActions } from 'vuex'
// import DialogAlert from '@/components/alert/DialogAlert.vue'
export default {
    components:{
        // DialogAlert
    },
    data(){
        return{
            dialog: false,
            valid: false,
            code: "",
            isLoading: false,
            isLoading_resource: false,
            items: [],
            resources: [],
            model: null,
            search_ot: null,
            search_resource: null,
            form: {
                ot: '',
                resource: '',
                item: '',
                assembly_time: '',
                estimated_time: '',
                date: Date.now()
            },
            nameRules: [
                v => !!v || 'El Nombre es necesario.',
                v => v.length <= 100 || 'El nombre debe contener menos de 100 caracteres.',
            ],
            nameResource: [
                v => !!v || 'El nombre del recurso es necesario.',
                v => v.length <= 500 || 'El nombre del recurso contener menos de 500 caracteres.',
            ],
            // quantityResource: [
            //     v => v > 0 || 'La cantidad debe ser mayor a 0.'
            // ],
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
        }
    },
    watch: {
        search_ot (val) {
            // Items have already been loaded
            //if (this.items.length > 0) return

            // Items have already been requested
            if (this.isLoading) return

            this.isLoading = true

            // Lazily load input items
            axios.get('/order/resource?search=' + val)
            .then(res => {
                this.items = res.data
            })
            .catch(err => {
                console.log(err)
            })
            .finally(() => {
                this.isLoading = false
                if(this.items.length < 1){
                    this.items = [{
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
                if(this.resources.length < 1){
                    this.resources = [{
                        "resource": val,
                    }]
                }
            })
      },
    },
    computed:{

    },
    methods:{
        ...mapActions({
            createOrder: 'order/createOrder',
            getListOrder: 'order/getListOrder'
        }),
        // ...mapActions({
        //     updateProfile: 'user/updateUser',
        //     setTextSnack: 'alert/snack',
        // }),
        // ...mapMutations({
        //     updateUser: 'user/SET_USER'
        // }),
        async submit(){
            // this.createOrder({payload: this.form})
            if(this.valid){
                const response = await axios.post('/order', this.form)
                if(response.status == 200){
                    this.getListOrder()
                    this.$refs.createOrder.resetValidation();
                    this.form.ot = ''
                    this.form.resource = ''
                    this.form.assembly_time = ''
                    this.form.estimated_time = ''
                    this.form.item = ''
                    //this.form.quantity= '',
                    this.dialog = false
                }
            }
        },
        uppercase() {
            this.form.name = this.form.name.toUpperCase();
            //this.form.ot = this.form.ot.toUpperCase();
            this.form.resource = this.form.resource.toUpperCase();
        },

        isNumber (evt){
            const keysAllowed = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
            const keyPressed = evt.key;
            
            if (!keysAllowed.includes(keyPressed)) {
                evt.preventDefault()
            }
        }
    }
}
</script>

<style>

</style>