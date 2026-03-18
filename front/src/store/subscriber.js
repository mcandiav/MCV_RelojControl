import store from "@/store";
import axios from "axios"

window.name = window.name.length === 0? generateWindowName() : window.name
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