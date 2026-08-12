const { resolveBuildVersion } = require('./scripts/resolve-build-version')
const { APP_RELEASE } = require('./scripts/app-release')

const UI_VERSION = resolveBuildVersion({ fallback: 'dev' })
process.env.VUE_APP_BUILD_VERSION = UI_VERSION

const PAGE_TITLE = `Usuario - Cronometro UI ${APP_RELEASE}`

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
