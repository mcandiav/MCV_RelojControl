import Vue from 'vue'
import { APP_RELEASE } from '@/constants/appRelease'

/** Versión de producto visible para operarios (no confundir con hash de build Git). */
export { APP_RELEASE }

export function getAppReleaseLabel() {
  return APP_RELEASE
}

/** Estado reactivo del badge (API version llega de /health). */
export const releaseState = Vue.observable({
  apiVersion: null
})

/** Badge de app: sin hash. Formato: UI <ver> · API <ver> */
export function getReleaseStamp() {
  const api = releaseState.apiVersion || '—'
  return `UI ${APP_RELEASE} · API ${api}`
}

export function getApiProductVersion() {
  return releaseState.apiVersion
}

export function setApiProductVersion(version) {
  const v = version != null ? String(version).trim() : ''
  releaseState.apiVersion = v || null
  return releaseState.apiVersion
}

/**
 * Lee la versión de producto del API (campo `version` de /health).
 * @param {import('axios').AxiosInstance} http
 */
export async function refreshApiProductVersion(http) {
  if (!http || typeof http.get !== 'function') return releaseState.apiVersion
  try {
    const res = await http.get('/health')
    const data = res && res.data ? res.data : null
    const version = data && (data.version || data.app_version || data.appVersion)
    if (version) setApiProductVersion(version)
  } catch (_) {
    /* badge queda API — */
  }
  return releaseState.apiVersion
}

function readWindowBuildPath() {
  if (typeof window === 'undefined') return ''
  const raw =
    window.__CRONOMETRO_BUILD_PATH__ != null
      ? window.__CRONOMETRO_BUILD_PATH__
      : window.__CRONOMETRO_BUILD_PATH
  if (raw == null) return ''
  return String(raw).trim()
}

function readWindowBuildVersion() {
  if (typeof window === 'undefined') return ''
  const raw =
    window.__CRONOMETRO_BUILD_VERSION__ != null
      ? window.__CRONOMETRO_BUILD_VERSION__
      : window.__CRONOMETRO_BUILD_VERSION
  if (raw == null) return ''
  return String(raw).trim()
}

export function getBuildPath() {
  const runtime = readWindowBuildPath()
  const env = (process.env.VUE_APP_BUILD_PATH && String(process.env.VUE_APP_BUILD_PATH).trim()) || ''
  const raw = runtime || env || 'default'
  return raw.toLowerCase()
}

/** Hash de build del front (solo diagnóstico / EasyPanel; no va al badge). */
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
