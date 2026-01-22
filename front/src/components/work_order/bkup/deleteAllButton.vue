<template>
  <v-container fluid class="pt-0">
    <v-dialog v-model="dialog" persistent max-width="400px">
      <template v-slot:activator="{ on, attrs }">
        <v-btn color="red lighten-2" dark v-bind="attrs" v-on="on" class="my-0 py-0">
          Eliminar ots
        </v-btn>
      </template>
      <v-card>
        <v-card-title>
          <span class="text-center">Eliminar todas las ots?</span>
        </v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error darken-1" text @click="dialog = false">
            Cancelar
          </v-btn>
          <v-btn color="error" text @click="remove()">
            Eliminar todo
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <DialogAlert />
  </v-container>
</template>

<script>
import axios from 'axios'
import DialogAlert from '@/components/alert/DialogAlert.vue'
import { mapActions, mapMutations, mapGetters } from 'vuex'

export default {
  props: ['items'],
  components: {
    DialogAlert
  },
  data: () => ({
    pass: "",
    dialog: false,
    valid: true
  }),
  methods: {
    ...mapMutations({
      SET_SNACK_COLOR: 'alert/SET_SNACK_COLOR'
    }),
    ...mapActions({
      snack: 'alert/snack',
      getListOrder: 'order/getListOrder',
    }),
    remove() {
      axios.post('/order/deleteAll').then((response) => {
        if (response.status == 200) {
          this.snack({
            text: 'Se eliminaron todas las ots.',
            timeout: 4000,
            color: 'success'
          })
          this.dialog = false
          this.valid = true
          this.getListOrder(this.currentSearch)
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
    isActive() {
      return this.pass.length === this.length_password
    },
  },
  watch: {
    dialog: function (newValue) {
      if (!newValue) {
        this.pass = "",
          this.valid = true
      }
    }
  }
}
</script>