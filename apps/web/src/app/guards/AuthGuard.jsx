import { Navigate, useLocation } from 'react-router-dom'
import { isLoggedIn } from '../../features/auth/authUtils'

export default function AuthGuard({ children }) {
  const location = useLocation()

  if (!isLoggedIn()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return children
}