import { useNavigate } from 'react-router-dom'

function Hero() {
  const navigate = useNavigate()

  function startPracticing() {
    const loggedIn =
      localStorage.getItem('cbtgen_logged_in') === 'true'

    navigate(loggedIn ? '/question-papers' : '/login')
  }

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-white via-white to-blue-50/50 pt-28 pb-14 lg:pt-32 lg:pb-20"
    >
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-150 w-150 -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />

        <div className="absolute right-[-180px] top-[35%] h-100 w-100 rounded-full bg-indigo-100/30 blur-3xl" />

        <div className="absolute left-[-200px] bottom-[-200px] h-100 w-100 rounded-full bg-sky-100/30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        <div className="grid items-center gap-12 xl:grid-cols-[0.9fr_1.1fr] xl:gap-14">

          {/* LEFT */}
          <div>

            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              A better way to practice CBT
            </div>

            <h1 className="max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-7xl">
              Turn question papers into
              <span className="mt-2 block text-blue-600">
                real CBT practice.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              CBTGen gives you a realistic computer-based examination
              experience built around the question papers you want to practice.
            </p>

            {/* Buttons */}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={startPracticing}
                className="group cursor-pointer rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-slate-950/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-600/20 active:translate-y-0"
              >
                Start Practicing

                <span className="ml-2 inline-block transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/preview-papers')}
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:translate-y-0"
              >
                Preview Papers
                <span className="ml-2 inline-block" aria-hidden="true">↗</span>
              </button>

            </div>

            {/* Trust points */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  ✓
                </span>

                Realistic CBT interface
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                  ✓
                </span>

                Repeat your practice
              </div>

            </div>
          </div>

          {/* RIGHT — PRODUCT PREVIEW */}
          <div className="relative">

            {/* Glow */}
            <div className="absolute -inset-8 rounded-[32px] bg-blue-100/40 blur-3xl" />

            <div className="relative rounded-[28px] border border-slate-200/90 bg-white p-2 shadow-[0_32px_90px_-42px_rgba(15,23,42,0.28)] ring-1 ring-white/80">

              {/* Browser bar */}
              <div className="flex h-10 items-center justify-between rounded-t-[18px] border-b border-slate-200 bg-slate-50 px-4">

                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>

                <span className="text-[10px] font-semibold text-slate-400">
                  CBTGen • Practice Test
                </span>

                <div className="w-8" />
              </div>

              {/* CBT header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Computer Based Test
                  </p>

                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    Practice Examination
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">

                  <p className="text-[9px] font-medium text-slate-400">
                    TIME LEFT
                  </p>

                  <p className="text-sm font-bold text-slate-900">
                    42:18
                  </p>

                </div>
              </div>

              {/* Main CBT */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] lg:grid-cols-[1fr_160px]">

                {/* Question */}
                <div className="p-4 sm:p-5 lg:p-6">

                  <div className="flex items-center justify-between">

                    <span className="text-[11px] font-bold text-blue-600">
                      Question 12
                    </span>

                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-semibold text-blue-600">
                      1 Mark
                    </span>

                  </div>

                  <h3 className="mt-5 max-w-lg text-sm font-semibold leading-6 text-slate-900">
                    Which data structure is most suitable for implementing
                    a First-In-First-Out mechanism?
                  </h3>

                  <div className="mt-5 space-y-2.5">

                    {[
                      'Stack',
                      'Queue',
                      'Binary Tree',
                      'Graph',
                    ].map((option, index) => (
                      <div
                        key={option}
                        className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all duration-200 ${
                          index === 1
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[10px]">
                          {String.fromCharCode(65 + index)}
                        </span>

                        {option}
                      </div>
                    ))}

                  </div>

                  <div className="mt-6 flex gap-2">

                    <button
                      type="button"
                      className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Mark for Review
                    </button>

                    <button
                      type="button"
                      className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-[10px] font-semibold text-white transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:translate-y-px"
                    >
                      Save & Next
                    </button>

                  </div>
                </div>

                {/* Palette */}
                <div className="border-t border-slate-200 bg-slate-50 p-4 sm:border-l sm:border-t-0">

                  <div className="flex items-center justify-between">

                    <span className="text-[10px] font-bold text-slate-600">
                      Questions
                    </span>

                    <span className="text-[9px] text-slate-400">
                      20
                    </span>

                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-1.5">

                    {Array.from({ length: 20 }, (_, i) => (
                      <span
                        key={i}
                        className={`flex h-7 items-center justify-center rounded-md text-[9px] font-semibold ${
                          i === 11
                            ? 'bg-blue-600 text-white'
                            : i < 8
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'border border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                    ))}

                  </div>

                  <div className="mt-5 space-y-2 text-[9px] text-slate-500">

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100" />
                      Answered
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                      Current
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" />
                      Not visited
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-6 -left-5 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:block">

              <p className="text-[10px] font-medium text-slate-400">
                Practice progress
              </p>

              <div className="mt-1 flex items-end gap-2">

                <span className="text-xl font-bold text-slate-900">
                  78%
                </span>

                <span className="pb-0.5 text-[10px] font-semibold text-emerald-600">
                  completed
                </span>

              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero