<template>
  <div class="text-center">
    <v-snackbar
    v-model="snackShow"
    :color="snackColor"
    centered
    >
      {{ snack }}
    </v-snackbar>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
export default {
  props: ['snackbar'],
  data: () => ({
      text: 'Se ha agregado exitosamente su producto al carrito.',
      timeout: 2000,
  }),
  computed: {
    ...mapGetters({
      snack: 'alert/snack',
      snackShow: 'alert/snackShow',
      snackColor: 'alert/snackColor'
    })
  }
}
</script>