import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Navbar() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const loggedIn =
    localStorage.getItem('cbtgen_logged_in') === 'true'

  const role =
    localStorage.getItem('cbtgen_user_role') === 'admin'
      ? 'admin'
      : 'student'

  const isAdmin = role === 'admin'

  function go(path) {
    setOpen(false)
    navigate(path)
  }

  function goHomeSection(sectionId) {
    setOpen(false)

    navigate('/')

    setTimeout(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  function handleLogout() {
    localStorage.removeItem('cbtgen_logged_in')
    localStorage.removeItem('cbtgen_user_email')
    localStorage.removeItem('cbtgen_user_role')

    setOpen(false)
    navigate('/')
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-6">

      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5">

        {/* =========================
            LOGO
        ========================== */}

        <button
          type="button"
          onClick={() => go('/')}
          className="flex cursor-pointer items-center gap-3"
        >
          <img
            src="/cbtgen-monogram.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
          />

          <span className="text-base font-bold tracking-tight text-[#0b1020]">
            CBT<span className="text-blue-600">Gen</span>
          </span>
        </button>


        {/* =========================
            DESKTOP NAVIGATION
        ========================== */}

        <div className="hidden items-center gap-7 lg:flex">

          <button
            type="button"
            onClick={() => go('/')}
            className="cursor-pointer text-sm font-medium text-slate-600 transition hover:text-[#0b1020]"
          >
            Home
          </button>


          <button
            type="button"
            onClick={() => goHomeSection('how-it-works')}
            className="cursor-pointer text-sm font-medium text-slate-600 transition hover:text-[#0b1020]"
          >
            How It Works
          </button>


          <button
            type="button"
            onClick={() => go('/plans')}
            className="cursor-pointer text-sm font-medium text-slate-600 transition hover:text-[#0b1020]"
          >
            Plans
          </button>

          <button
            type="button"
            onClick={() => go('/faq')}
            className="cursor-pointer text-sm font-medium text-slate-600 transition hover:text-[#0b1020]"
          >
            FAQ
          </button>

        </div>


        {/* =========================
            DESKTOP ACTIONS
        ========================== */}

        <div className="hidden items-center gap-4 lg:flex">

          {loggedIn ? (

            /* LOGGED IN */

            <>
              {isAdmin ? (

                /* ADMIN */

                <button
                  type="button"
                  onClick={() => go('/admin')}
                  className="cursor-pointer rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  Admin Dashboard
                </button>

              ) : (

                /* STUDENT */

                <>
                  <button
                    type="button"
                    onClick={() => go('/question-papers')}
                    className="cursor-pointer text-sm font-semibold text-slate-700 transition hover:text-[#0b1020]"
                  >
                    My Library
                  </button>


                  <button
                    type="button"
                    onClick={() => go('/account')}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Account
                  </button>
                </>

              )}


              {/* Logout */}

              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-xl bg-[#080d1d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#11182d]"
              >
                Log out
              </button>

            </>

          ) : (

            /* LOGGED OUT */

            <>
              <button
                type="button"
                onClick={() => go('/login')}
                className="cursor-pointer text-sm font-semibold text-slate-700 transition hover:text-[#0b1020]"
              >
                Log in
              </button>

              <button
                type="button"
                onClick={() => go('/login')}
                className="cursor-pointer rounded-xl bg-[#080d1d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#11182d]"
              >
                Get Started
              </button>
            </>

          )}

        </div>


        {/* =========================
            MOBILE MENU BUTTON
        ========================== */}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <div className="space-y-1.5">

            <span
              className={`block h-0.5 w-5 bg-[#0b1020] transition ${
                open ? 'translate-y-2 rotate-45' : ''
              }`}
            />

            <span
              className={`block h-0.5 w-5 bg-[#0b1020] transition ${
                open ? 'opacity-0' : ''
              }`}
            />

            <span
              className={`block h-0.5 w-5 bg-[#0b1020] transition ${
                open ? '-translate-y-2 -rotate-45' : ''
              }`}
            />

          </div>
        </button>

      </nav>


      {/* =========================
          MOBILE MENU
      ========================== */}

      {open && (
        <div className="mx-auto mt-2 max-w-7xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg lg:hidden">

          <div className="flex flex-col gap-1">

            <MobileLink
              label="Home"
              onClick={() => go('/')}
            />


            <MobileLink
              label="How It Works"
              onClick={() =>
                goHomeSection('how-it-works')
              }
            />


            <MobileLink
              label="Plans"
              onClick={() => go('/plans')}
            />

            <MobileLink
              label="FAQ"
              onClick={() =>
                goHomeSection('faq')
              }
            />


            <div className="my-2 h-px bg-slate-100" />


            {loggedIn ? (

              <>
                {isAdmin ? (

                  <MobileLink
                    label="Admin Dashboard"
                    onClick={() => go('/admin')}
                  />

                ) : (

                  <>
                    <MobileLink
                      label="My Library"
                      onClick={() =>
                        go('/question-papers')
                      }
                    />


                    <MobileLink
                      label="Account"
                      onClick={() =>
                        go('/account')
                      }
                    />
                  </>

                )}


                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 cursor-pointer rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white"
                >
                  Log out
                </button>
              </>

            ) : (

              <>
                <button
                  type="button"
                  onClick={() => go('/login')}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Log in
                </button>

                <button
                  type="button"
                  onClick={() => go('/login')}
                  className="cursor-pointer rounded-xl bg-[#080d1d] px-4 py-3 text-sm font-semibold text-white"
                >
                  Get Started
                </button>
              </>

            )}

          </div>

        </div>
      )}

    </header>
  )
}


function MobileLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[#0b1020]"
    >
      {label}
    </button>
  )
}


export default Navbar
