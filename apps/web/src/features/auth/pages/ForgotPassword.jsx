import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'

function ForgotPassword() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  async function handleSubmit(e) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    try {
      const result =
        await cbtgenApi.auth.requestPasswordReset(email)

      if (!result?.success) {
        setError(
          result?.message ||
          'Unable to process your request.'
        )
        return
      }

      setSuccess(
        'If an account exists with this email, password reset instructions have been sent.'
      )

    } catch (err) {
      console.error('Password reset failed:', err)

      setError(
        err?.message ||
        'Unable to process your request.'
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
              Forgot your password?
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Enter your email and we'll help you reset your password.
            </p>

          </div>


          <form onSubmit={handleSubmit}>

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
                  setSuccess('')
                }}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

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


            {/* Submit */}

            <button
              type="submit"
              className="w-full cursor-pointer rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#11182d] active:scale-[0.99]"
            >
              Send reset instructions
            </button>

          </form>


          {/* Divider */}

          <div className="my-6 h-px bg-slate-100" />


          {/* Back to Login */}

          <p className="text-center text-sm text-slate-500">

            Remember your password?{' '}

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

export default ForgotPassword