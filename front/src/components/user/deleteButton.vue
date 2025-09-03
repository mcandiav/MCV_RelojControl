<template>
    <v-row justify="center">
        <v-dialog v-model="dialog" persistent max-width="400px">
            <template v-slot:activator="{ on, attrs }">
                <v-btn class="my-3" fab dark small color="error" v-bind="attrs" v-on="on">
                    <v-icon dark>
                        mdi-delete
                    </v-icon>
                </v-btn>
            </template>
            <v-card>
                <v-card-title>
                    <span>Desea eliminar al usuario <br>{{ '\n' + this.items.name + ' ' + this.items.lastname }}?</span>
                </v-card-title>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="" text @click="dialog = false">
                        Cancelar
                    </v-btn>
                    <v-btn color="error" text @click="remove(items)">
                        Eliminar
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>
  
<script>
import axios from 'axios'

export default {
    props: ['items'],
    data: () => ({
        pass: "",
        dialog: false,
        valid: true
    }),
    methods: {
        async remove(item) {
            console.log(item)
            // Eliminar usuario
            await axios.delete('/auth/users/' + item.id).then(response => {
                console.log(response)
                if (response.status == 200) {
                    this.dialog = false
                    this.$emit('deleted')
                }
            }).catch(error => {
                console.log(error)
            })
        },
    },
}
</script>