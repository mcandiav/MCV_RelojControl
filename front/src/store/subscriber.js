import store from "@/store";
import axios from "axios"

const STATION_STORAGE_KEY = 'reloj_station_id'

/** Misma PC / mismo navegador: todos los operarios comparten este id (cabecera x-station-id). */
function getOrCreateStationId() {
  const fromEnv = typeof process !== 'undefined' && process.env && process.env.VUE_APP_STATION_ID
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().slice(0, 64)
  }
  try {
    let id = localStorage.getItem(STATION_STORAGE_KEY)
    if (!id || String(id).length < 8) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
      localStorage.setItem(STATION_STORAGE_KEY, id)
    }
    return String(id).trim().slice(0, 64)
  } catch (e) {
    return `station-${Date.now()}`
  }
}

axios.defaults.headers.common['x-station-id'] = getOrCreateStationId()

// window.name debe ser string; en casos raros evitamos .length sobre no-string (rompe todo el bundle).
const existingName = String(typeof window.name === 'string' ? window.name : '')
window.name = existingName.length === 0 ? generateWindowName() : existingName
console.log('windowName', window.name)

store.subscribe((mutation) => {
    switch (mutation.type){
        case 'auth/SET_TOKEN':
            if(mutation.payload){
                axios.defaults.headers.common['x-access-token'] = mutation.payload
                localStorage.setItem(`token_${window.name}`, mutation.payload)
            } else {
                delete axios.defaults.headers.common['x-access-token']
                localStorage.removeItem(`token_${window.name}`)
            }
            break
    }
})

function generateWindowName() {
    let name = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 10; i++) {
      name += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return name;
  }