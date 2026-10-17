import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await cbtgenApi.auth.login(
        email.trim(),
        password
      )

      if (!result?.success) {
        setError(
          result?.message ||
          'Invalid email or password.'
        )
        return
      }

      const role =
        result.user?.role === 'admin'
          ? 'admin'
          : 'student'

      // The API already stores the login session
      // and current user's email. Store the role
      // separately for the route guards.
      localStorage.setItem(
        'cbtgen_user_role',
        role
      )

      // React Router navigation.
      // No hash navigation and no page reload.
      if (role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/question-papers', { replace: true })
      }

    } catch (error) {
      console.error('Login failed:', error)

      setError(
        error?.message ||
        'Unable to log in. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-28">
      <div className="mx-auto flex max-w-md justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">

          {/* CBTGen monogram — use the existing project asset */}
          <div className="mb-6 flex justify-center">
            <img
              src="/cbtgen-monogram.png"
              alt="CBTGen logo"
              className="h-14 w-14 object-contain"
            />
          </div>

          {/* Heading */}
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1020]">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Log in to access your question paper library.
            </p>
          </div>

          <form onSubmit={handleLogin}>

            {/* Email */}
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>

                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="cursor-pointer text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Forgot password?
                </button>
              </div>

              {/* Password input + show/hide button */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  title={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                >
                  {showPassword ? (
                    /* Eye with slash */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 3l18 18"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.58 10.58a2 2 0 102.83 2.83"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.88 4.24A10.8 10.8 0 0112 4c5 0 8.27 4.33 9.5 6.25a3.5 3.5 0 010 3.5 16.5 16.5 0 01-3.05 3.35"
                      />

                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.23 6.23A16.5 16.5 0 002.5 10.25a3.5 3.5 0 000 3.5C3.73 15.67 7 20 12 20a10.8 10.8 0 004.12-.81"
                      />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
                      />

                      <circle
                        cx="12"
                        cy="12"
                        r="2.5"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Login */}
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 h-px bg-slate-100" />

          {/* Signup */}
          <p className="text-center text-sm text-slate-500">
            Don't have an account?{' '}

            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="cursor-pointer font-semibold text-blue-600 transition hover:text-blue-700"
            >
              Create one
            </button>
          </p>

        </div>
      </div>
    </main>
  )
}

export default Login