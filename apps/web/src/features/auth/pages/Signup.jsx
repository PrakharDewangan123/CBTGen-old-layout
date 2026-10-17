import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'

function Signup() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  async function handleSignup(e) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      const result = await cbtgenApi.auth.signup({
        name,
        email,
        password,
      })

      if (!result?.success) {
        setError(
          result?.message ||
          'Unable to create your account.'
        )
        return
      }

      setSuccess('Account created successfully. Redirecting...')

      setTimeout(() => {
        navigate('/login')
      }, 900)

    } catch (err) {
      console.error('Signup failed:', err)

      setError(
        err?.message ||
        'Unable to create your account.'
      )
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
              Create your account
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create an account to start building your CBT library.
            </p>

          </div>


          <form onSubmit={handleSignup}>

            {/* Name */}

            <div className="mb-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                placeholder="Your name"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

            </div>


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
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

            </div>


            {/* Password */}

            <div className="mb-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="relative">

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Create a password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((prev) => !prev)
                  }
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                >
                  {showPassword ? (
                    /* Eye with slash — matches the login page */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58a2 2 0 102.83 2.83" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 4.24A10.8 10.8 0 0112 4c5 0 8.27 4.33 9.5 6.25a3.5 3.5 0 010 3.5 16.5 16.5 0 01-3.05 3.35" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.23 6.23A16.5 16.5 0 002.5 10.25a3.5 3.5 0 000 3.5C3.73 15.67 7 20 12 20a10.8 10.8 0 004.12-.81" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>

              </div>

            </div>


            {/* Confirm Password */}

            <div className="mb-5">

              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm password
              </label>

              <div className="relative">

                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Confirm your password"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((prev) => !prev)
                  }
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                >
                  {showConfirmPassword ? (
                    /* Eye with slash — matches the login page */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.58 10.58a2 2 0 102.83 2.83" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.88 4.24A10.8 10.8 0 0112 4c5 0 8.27 4.33 9.5 6.25a3.5 3.5 0 010 3.5 16.5 16.5 0 01-3.05 3.35" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.23 6.23A16.5 16.5 0 002.5 10.25a3.5 3.5 0 000 3.5C3.73 15.67 7 20 12 20a10.8 10.8 0 004.12-.81" />
                    </svg>
                  ) : (
                    /* Eye */
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                      <circle cx="12" cy="12" r="2.5" />
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


            {/* Success */}

            {success && (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}


            {/* Signup */}

            <button
              type="submit"
              className="w-full cursor-pointer rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d] active:scale-[0.99]"
            >
              Create account
            </button>

          </form>


          {/* Divider */}

          <div className="my-6 h-px bg-slate-100" />


          {/* Login */}

          <p className="text-center text-sm text-slate-500">

            Already have an account?{' '}

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              Log in
            </button>

          </p>

        </div>

      </div>

    </main>
  )
}

export default Signup