const UI_VERSION = String(process.env.VUE_APP_BUILD_VERSION || process.env.VUE_APP_BUILD_LABEL || 'Version').trim()
const PAGE_TITLE = `Usuario - Cronometro - ${UI_VERSION}`

module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  configureWebpack: {
    performance: {
      hints: false
    }
  },
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
