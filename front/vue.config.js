/** Version UI del front (V4). Mantener alineado con public/index.html (title + fallback). */
const PAGE_TITLE = 'Bignotti Â· CronÃ³metro V4'

module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  devServer: {
    // API Express (backend/src/index.js) escucha en 8000
    proxy: 'http://localhost:8000'
  },
  chainWebpack: (config) => {
    config.plugin('html').tap((args) => {
      args[0].title = PAGE_TITLE
      return args
    })
  }
}
