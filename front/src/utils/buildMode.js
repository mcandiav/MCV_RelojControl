function readWindowBuildPath() {
  if (typeof window === 'undefined') return ''
  if (window.__CRONOMETRO_BUILD_PATH == null) return ''
  const v = String(window.__CRONOMETRO_BUILD_PATH).trim()
  return v
}

export function getBuildPath() {
  const runtime = readWindowBuildPath()
  const env = (process.env.VUE_APP_BUILD_PATH && String(process.env.VUE_APP_BUILD_PATH).trim()) || ''
  const raw = runtime || env || 'default'
  return raw.toLowerCase()
}

export function isTestBuild() {
  return getBuildPath() === 'test'
}
