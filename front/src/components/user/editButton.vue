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
          </v-card-title>
          <v-card-text>
            <v-form v-model="valid" ref="editOrder">
            <v-container>
              <v-row>
                    <v-col cols="12" sm="4">
                        <v-text-field v-model="editedItem.name" label="Nombre" outlined
                            :rules="nameRules"></v-text-field>
                    </v-col>

                    <v-col cols="12" sm="4">
                        <v-text-field v-model="editedItem.lastname" label="Apellido" outlined
                            :rules="lastnameRules"></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="4">
                        <v-text-field v-model="editedItem.username" label="Username" outlined
                            :rules="usernameRules" disabled></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6">
                        Roles
                        <v-select v-model="editedItem.Role" :items="roles" item-text="name" item-value="id"
                            label="Seleccionar un rol." return-object single-line :rules="rolesRules"></v-select>
                    </v-col>
                    <v-col cols="12" sm="6">
                        Lugar de trabajo
                        <v-select v-model="editedItem.Workplace" :items="workplaces" item-text="name" item-value="id"
                            label="Seleccionar el lugar de trabajo." return-object single-line
                            :rules="workplaceRules"></v-select>
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
      props: ['items'],
      data: () => ({
          dialog: false,
          valid: false,
          nameRules: [
              v => !!v || 'El Nombre es necesario.',
              v => v.length <= 100 || 'El nombre debe contener menos de 100 caracteres.',
          ],
          lastnameRules: [
              v => !!v || 'El Apellido es necesario.',
              v => v.length <= 100 || 'El apellido debe contener menos de 100 caracteres.',
          ],
          usernameRules: [
              v => !!v || 'El Username es necesario.',
              v => v.length <= 100 || 'El username debe contener menos de 100 caracteres.',
          ],
          rolesRules: [
              v => !!v || 'El rol es necesario.',
          ],
          workplaceRules: [
              v => !!v || 'El lugar de trabajo es necesario.',
          ],
          roles: [],
          workplaces: [],
          editedItem: {
              id: 0,
              name: null,
              lastname: null,
              username: null,
              Role: {
                  id: 0,
                  name: null
              },
              Workplace: {
                  id: 0,
                  name: null
              }
          }
      }),
      watch: {
        async dialog(val) {
            console.log("Dialog: ", val)
            if (val) {
                this.editedItem = Object.assign({}, this.items)
                console.log("Item: ", this.editedItem)
                await axios.get('/order/roles').then(res => {
                    console.log(res)
                    if (res.status === 200) {
                        this.roles = res.data
                    }
                })

                await axios.get('/order/workplaces').then(res => {
                    console.log(res)
                    if (res.status === 200) {
                        this.workplaces = res.data
                    }
                })

                this.workplaces.map((workplace) => {
                    if (workplace.name === "") {
                        workplace.name = "Todos los lugares de trabajo"
                    }
                })
            }
        },
      },
      methods: {
          ...mapActions({
              getListOrder: 'order/getListOrder',
              snack: 'alert/snack'
          }),
          edit() {
              if (this.valid) {
                console.log("Valores editados: ", this.editedItem)
                axios.put('/auth/users/' + this.editedItem.id, {
                    id: this.editedItem.id,
                    name: this.editedItem.name,
                    lastname: this.editedItem.lastname,
                    RoleId: this.editedItem.Role.id,
                    WorkplaceId: this.editedItem.Workplace.id
                }).then(res => {
                    if (res.status === 200) {
                        this.dialog = false
                        this.$emit('update')
                    }
                })
              }
          },
      },
      computed: {
          ...mapGetters({
              currentSearch: 'order/currentSearch'
          })
      }
  }
  </script>