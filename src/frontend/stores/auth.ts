import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // El token JWT vive en cookie httpOnly — no accesible desde JS.
  // Solo guardamos el objeto user para la UI y para el guard del router.
  const user = ref<{ id: number; email: string } | null>(
    JSON.parse(localStorage.getItem('user') || 'null')
  )

  function setAuth(newUser: { id: number; email: string }) {
    user.value = newUser
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  function logout() {
    user.value = null
    localStorage.removeItem('user')
  }

  return { user, setAuth, logout }
})
