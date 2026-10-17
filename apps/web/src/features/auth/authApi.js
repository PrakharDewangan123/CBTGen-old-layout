import { cbtgenApi } from '../../lib/api/cbtgenApi'
import {
  AUTH_KEYS,
  clearAuth,
} from './authUtils'

export const authApi = {
  async login(email, password) {
    const result = await cbtgenApi.auth.login(email, password)

    if (!result?.success) {
      return result
    }

    const user = result.user

    localStorage.setItem(AUTH_KEYS.SESSION, 'true')
    localStorage.setItem(AUTH_KEYS.EMAIL, user.email)
    localStorage.setItem(AUTH_KEYS.ROLE, user.role || 'student')

    return {
      success: true,
      user,
    }
  },

  logout() {
    try {
      cbtgenApi.auth.logout()
    } finally {
      clearAuth()
    }

    return { success: true }
  },

  getCurrentUser() {
    return cbtgenApi.auth.getCurrentUser()
  },

  isAuthenticated() {
    return localStorage.getItem(AUTH_KEYS.SESSION) === 'true'
  },
}