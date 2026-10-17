import { Navigate } from 'react-router-dom'
import {
  isLoggedIn,
  isAdmin,
} from '../../features/auth/authUtils'

export default function AdminGuard({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin()) {
    return <Navigate to="/question-papers" replace />
  }

  return children
}