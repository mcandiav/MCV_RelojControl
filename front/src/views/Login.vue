<template>
<v-container fluid fill-height>
    <v-layout align-center justify-center>
        <v-flex xs12 sm8 md6 lg5 xl4>
            <v-card>
                <v-toolbar color="primary">
                    <v-toolbar-title style="color: white;">
                        Inicio de sesión
                    </v-toolbar-title>
                </v-toolbar>
                <v-card-text>
                    <v-text-field v-model="usernameTransform" autofocus color="accent" label="Usuario" required>
                    </v-text-field>
                    <v-text-field v-model="password" type="password" color="accent" label="Contraseña" required>
                    </v-text-field>
                    <v-flex class="red--text" v-if="error.status">
                        {{error.message}}
                    </v-flex>
                </v-card-text>
                <v-card-actions class="px-3 pb-3">
                    <v-flex text-xs-right>
                        <v-btn v-on:click="ingresar()" color="primary">Ingresar</v-btn>
                    </v-flex>
                </v-card-actions>
            </v-card>
        </v-flex>
    </v-layout>

</v-container>
</template>



<script>
//import axios from 'axios';
import { mapActions } from 'vuex'

export default {
    data (){
        return{
            username:'',
            password:'',
            error: {
                status: null,
                message: ""
            }
        }
    },
    methods:{
        ...mapActions({
            signIn: 'auth/signIn',
        }), 

        ingresar(){
            if(this.username && this.password){     
                let configuracion = {
                    username: this.username.toUpperCase(),
                    password: this.password.toUpperCase()
                }
                this.signIn(configuracion).then(() => {
                    this.$router.push('/');
                }).catch(() => {
                    this.error.status = true
                    this.error.message = "Datos invalidos."
                })
           }else {
               this.errorM='Tiene que completar los campos email y password';
           }
        },
        
    },
    computed:{
        usernameTransform: {
            get(){
                return this.username
            },
            set(val){
                this.username = val.toUpperCase()
            }
        }
    }
}
</script>