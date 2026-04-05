import Vue from 'vue';
import Vuetify from 'vuetify/lib/framework';
import '@mdi/font/css/materialdesignicons.css'

Vue.use(Vuetify);

export default new Vuetify({
    icons: {
        iconfont: 'mdi',
      },
    theme: {
      options: {
        customProperties: true,
      },
      themes: {
        light: {
          primary: '#FF5722',
          secondary: '#212121',
          accent: '#FFA726',
          error: '#C62828',
          info: '#0277BD',
          success: '#2E7D32',
          warning: '#F9A825',
          anchor: '#E64A19',
        },
      },
    },
});
