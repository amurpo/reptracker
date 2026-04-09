import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Framework7 from 'framework7/lite-bundle'
import Framework7Vue from 'framework7-vue/bundle'
import router from './router'
import './style.css'
import App from './App.vue'

Framework7.use(Framework7Vue)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
