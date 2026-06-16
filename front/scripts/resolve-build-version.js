const fs = require('fs')
const { execSync } = require('child_process')
const path = require('path')

function findGitRoot(startDir) {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Versión visible en UI (hash corto de Git). Orden: env explícita → git HEAD → fallback.
 */
function resolveBuildVersion(options = {}) {
  const fallback = options.fallback != null ? String(options.fallback) : 'dev'
  const fromEnv =
    (process.env.VUE_APP_BUILD_VERSION && String(process.env.VUE_APP_BUILD_VERSION).trim()) ||
    (process.env.VUE_APP_BUILD_LABEL && String(process.env.VUE_APP_BUILD_LABEL).trim()) ||
    (process.env.GIT_SHA && String(process.env.GIT_SHA).trim()) ||
    (process.env.SOURCE_COMMIT && String(process.env.SOURCE_COMMIT).trim()) ||
    ''
  if (fromEnv) {
    const v = fromEnv.slice(0, 40)
    return v.length > 12 ? v.slice(0, 7) : v
  }
  const gitRoot = findGitRoot(path.resolve(__dirname, '..'))
  if (gitRoot) {
    try {
      return execSync('git rev-parse --short HEAD', { cwd: gitRoot, encoding: 'utf8' }).trim()
    } catch (_) {
      /* ignore */
    }
  }
  return fallback
}

module.exports = { resolveBuildVersion }

if (require.main === module) {
  process.stdout.write(resolveBuildVersion())
}
