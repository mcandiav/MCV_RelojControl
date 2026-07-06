import { APP_RELEASE } from '@/constants/appRelease'

/** Versión de producto visible para operarios (no confundir con hash de build Git). */
export { APP_RELEASE }

export function getAppReleaseLabel() {
  return APP_RELEASE
}

/** Sello de versión visible: release de producto + hash de build (ej. V5.3.1@1841fce). */
export function getReleaseStamp() {
  return `${APP_RELEASE}@${getUiVersion()}`
}

function readWindowBuildPath() {
  if (typeof window === 'undefined') return ''
  if (window.__CRONOMETRO_BUILD_PATH == null) return ''
  const v = String(window.__CRONOMETRO_BUILD_PATH).trim()
  return v
}

function readWindowBuildVersion() {
  if (typeof window === 'undefined') return ''
  if (window.__CRONOMETRO_BUILD_VERSION == null) return ''
  return String(window.__CRONOMETRO_BUILD_VERSION).trim()
}

export function getBuildPath() {
  const runtime = readWindowBuildPath()
  const env = (process.env.VUE_APP_BUILD_PATH && String(process.env.VUE_APP_BUILD_PATH).trim()) || ''
  const raw = runtime || env || 'default'
  return raw.toLowerCase()
}

export function getUiVersion() {
  const runtime = readWindowBuildVersion()
  const env =
    (process.env.VUE_APP_BUILD_VERSION && String(process.env.VUE_APP_BUILD_VERSION).trim()) ||
    (process.env.VUE_APP_BUILD_LABEL && String(process.env.VUE_APP_BUILD_LABEL).trim()) ||
    ''
  return runtime || env || 'dev'
}

export function isTestBuild() {
  return getBuildPath() === 'test'
}
