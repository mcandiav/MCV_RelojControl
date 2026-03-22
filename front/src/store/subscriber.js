import store from "@/store";
import axios from "axios"

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