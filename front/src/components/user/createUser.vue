<template>
    <div>
        <v-dialog v-model="dialog" max-width="800px">
            <template v-slot:activator="{ on, attrs }">
                <v-btn class="my-3 mx-3" dark color="primary" v-bind="attrs" v-on="on">
                    Crear Usuario
                </v-btn>
            </template>
            <v-card>
                <v-tabs v-model="tab" color="deep-purple-accent-4" align-tabs="center">
                    <v-tab href="#create">Crear usuarios</v-tab>
                    <v-tab href="#edit">Editar y eliminar</v-tab>
                </v-tabs>
                <v-tabs-items v-model="tab">
                    <v-tab-item value="create">
                        <v-card-title class="text-center">
                            Crear usuario
                        </v-card-title>
                        <v-form v-model="valid" ref="createOrder">
                            <v-container>
                                <v-row>
                                    <v-col cols="12" sm="4">
                                        <v-text-field v-model="sigin.name" label="Nombre" outlined
                                            :rules="nameRules"></v-text-field>
                                    </v-col>

                                    <v-col cols="12" sm="4">
                                        <v-text-field v-model="sigin.lastname" label="Apellido" outlined
                                            :rules="lastnameRules"></v-text-field>
                                    </v-col>
                                    <v-col cols="12" sm="4">
                                        <v-text-field v-model="sigin.username" label="Username" outlined
                                            :rules="usernameRules" autocomplete="off"></v-text-field>
                                    </v-col>
                                    <v-col cols="12" sm="6">
                                        <v-text-field v-model="sigin.password" label="Contraseña" outlined
                                            type="password" :rules="passwordRules" autocomplete="new-password"></v-text-field>
                                    </v-col>
                                    <v-col cols="12" sm="6">
                                        <v-text-field v-model="sigin.passwordConfirm" label="Confirmar contraseña" outlined
                                            type="password" :rules="passwordConfirmRules" autocomplete="new-password"></v-text-field>
                                    </v-col>
                                    <v-col cols="12" sm="6">
                                        Roles
                                        <v-select v-model="formRoles" :items="roles" item-text="name" item-value="id"
                                            label="Seleccionar un rol." return-object single-line
                                            :rules="rolesRules"></v-select>
                                    </v-col>
                                    <v-col cols="12" sm="6">
                                        Lugar de trabajo
                                        <v-select v-model="formWorkplaces" :items="workplaces" item-text="name"
                                            item-value="id" label="Seleccionar el lugar de trabajo." return-object
                                            single-line :rules="workplaceRules"></v-select>
                                    </v-col>
                                </v-row>
                            </v-container>
                        </v-form>
                        <p v-if="alert" class="red text-center">
                            {{ this.error }}
                        </p>
                        <v-card-actions>
                            <v-btn color="success" @click="createUser()">
                                Crear usuario
                            </v-btn>
                        </v-card-actions>
                    </v-tab-item>
                    <!-- Ahora se mostrara la lista de todos los usuarios. Se podria modificar y eliminar. -->
                    <v-tab-item value="edit">
                        <v-card-title class="text-center">
                            Editar y eliminar usuarios
                        </v-card-title>
                        <v-container>
                            <!-- Listar todos los usuarios -->
                            <v-data-table :headers="header" :items="users" :items-per-page="10" class="elevation-1"
                                :loading="loading">
                                <template v-slot:item.actions="{ item }">
                                    <v-row>
                                        <v-col>
                                            <editButton :items="item" @update="alertUpdate"/>
                                        </v-col>
                                        <v-col>
                                            <deleteButton :items="item" @deleted="alertDelete"/>
                                        </v-col>
                                    </v-row>
                                </template>
                            </v-data-table>
                        </v-container>
                    </v-tab-item>
                </v-tabs-items>
            </v-card>
        </v-dialog>
    </div>
</template>

<script>
import axios from 'axios'
import editButton from './editButton.vue'
import deleteButton from './deleteButton.vue'
import { mapActions, mapMutations } from 'vuex'

export default {
    components: {
        editButton,
        deleteButton
    },
    data() {
        return {
            sigin: {
                name: '',
                lastname: '',
                username: '',
                password: '',
                passwordConfirm: ''
            },
            tab: 1,
            passValidation: null,
            dialog: false,
            alert: false,
            error: null,
            roles: [],
            workplaces: [],
            formRoles: null,
            formWorkplaces: null,
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
            passwordRules: [
                v => !!v || 'La contraseña es necesaria.',
                v => v.length >= 4 || 'La contraseña debe tener al menos 4 caracteres.',
            ],
            passwordConfirmRules: [
                v => !!v || 'Confirme la contraseña.',
                v => v === this.sigin.password || 'Las contraseñas no coinciden.',
            ],
            rolesRules: [
                v => !!v || 'El rol es necesario.',
            ],
            workplaceRules: [
                v => !!v || 'El lugar de trabajo es necesario.',
            ],
            // Editar y eliminar usuarios
            users: [],
            header: [
                { text: 'Nombre', value: 'name' },
                { text: 'Apellido', value: 'lastname' },
                { text: 'Username', value: 'username' },
                { text: 'Rol', value: 'Role.name' },
                { text: 'Lugar de trabajo', value: 'Workplace.name' },
                { text: 'Acciones', value: 'actions', sortable: false },
            ],
            loading: true

        }
    },
    watch: {
        tab(newTab) {
            if (newTab === 'edit') {
                this.getAllUsers()
            }
        }
    },
    methods: {
        ...mapMutations({
            SET_SNACK_COLOR: 'alert/SET_SNACK_COLOR'
        }),
        ...mapActions({
            snack: 'alert/snack'
        }),
        async createUser() {
            if (this.valid) {
                this.alert = false

                await axios.get('/order/getUsername', {
                    params: {
                        username: this.sigin.username
                    }
                }).then(res => {
                    if (res.status === 200) {
                        if (res.data.username) {
                            this.alert = true
                            this.error = "El usuario ya existe."
                        }
                    }
                })

                if (this.alert === false) {
                    await axios.post('/auth/signUp', {
                        name: this.sigin.name,
                        lastname: this.sigin.lastname,
                        username: this.sigin.username,
                        password: this.sigin.password,
                        RoleId: this.formRoles.id,
                        WorkplaceId: this.formWorkplaces.id
                    }).then(res => {
                        if (res.status === 200) {
                            this.dialog = false
                            this.$emit('update')
                        }
                    })
                }
            }
            // Limpiar formulario
            this.sigin.name = ''
            this.sigin.lastname = ''
            this.sigin.username = ''
            this.sigin.password = ''
            this.sigin.passwordConfirm = ''
            this.formRoles = null
            this.formWorkplaces = null
        },
        async getAllUsers() {
            await axios.get('/auth/users').then(res => {
                if (res.status === 200) {
                    this.users = res.data
                    this.loading = false
                }
            })
        },
        async alertUpdate(){
            await this.getAllUsers()
            this.snack({
                text: 'Usuario actualizado exitosamente.',
                timeout: 3000,
                color: 'success'
            })
        },
        async alertDelete(){
            await this.getAllUsers()
            this.snack({
                text: 'Usuario eliminado exitosamente.',
                timeout: 3000,
                color: 'success'
            })
        }
    },
    async mounted() {
        // get all roles and workplaces
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
}
</script>

<style></style>