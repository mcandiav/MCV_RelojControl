const { execSync } = require('child_process')
const path = require('path')

/**
 * Versión visible en UI (hash corto de Git). Orden: env explícita → git HEAD → fallback.
 */
function resolveBuildVersion(options = {}) {
  const fallback = options.fallback != null ? String(options.fallback) : 'dev'
  const fromEnv =
    (process.env.VUE_APP_BUILD_VERSION && String(process.env.VUE_APP_BUILD_VERSION).trim()) ||
    (process.env.VUE_APP_BUILD_LABEL && String(process.env.VUE_APP_BUILD_LABEL).trim()) ||
    (process.env.SOURCE_COMMIT && String(process.env.SOURCE_COMMIT).trim()) ||
    ''
  if (fromEnv) return fromEnv.slice(0, 40)
  try {
    const root = path.resolve(__dirname, '..', '..')
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim()
  } catch (_) {
    return fallback
  }
}

module.exports = { resolveBuildVersion }

if (require.main === module) {
  process.stdout.write(resolveBuildVersion())
}
