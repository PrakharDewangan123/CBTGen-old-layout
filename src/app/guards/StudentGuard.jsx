import { Navigate } from 'react-router-dom'
import {
  isLoggedIn,
  isStudent,
} from '../../features/auth/authUtils'

export default function StudentGuard({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  if (!isStudent()) {
    return <Navigate to="/admin" replace />
  }

  return children
}