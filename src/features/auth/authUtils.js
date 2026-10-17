export const AUTH_KEYS = {
  SESSION: 'cbtgen_logged_in',
  EMAIL: 'cbtgen_user_email',
  ROLE: 'cbtgen_user_role',
}

export function isLoggedIn() {
  return localStorage.getItem(AUTH_KEYS.SESSION) === 'true'
}

export function getCurrentEmail() {
  return localStorage.getItem(AUTH_KEYS.EMAIL)
}

export function getCurrentRole() {
  return localStorage.getItem(AUTH_KEYS.ROLE) || 'student'
}

export function isAdmin() {
  return isLoggedIn() && getCurrentRole() === 'admin'
}

export function isStudent() {
  return isLoggedIn() && getCurrentRole() === 'student'
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEYS.SESSION)
  localStorage.removeItem(AUTH_KEYS.EMAIL)
  localStorage.removeItem(AUTH_KEYS.ROLE)
}