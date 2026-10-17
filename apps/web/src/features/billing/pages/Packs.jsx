import { useNavigate } from 'react-router-dom'

const demoBenefits = [
  '2 free demo generations after your first login',
  'Use them on different papers or repeat the same paper',
  'No payment required for the two demo uses',
]

// These are display-only development concepts. They do not configure billing,
// grant entitlements, or change the existing usage/slot lifecycle.
const proposedPacks = [
  { name: 'Starter', price: 99, slots: 2, usesPerSlot: 2, validity: 365, description: 'Try a small set of papers' },
  { name: 'Basic', price: 199, slots: 5, usesPerSlot: 2, validity: 365, description: 'Build a regular practice routine' },
  { name: 'Standard', price: 399, slots: 10, usesPerSlot: 3, validity: 365, description: 'Practice across more papers', featured: true },
  { name: 'Pro', price: 699, slots: 20, usesPerSlot: 3, validity: 365, description: 'Longer-term preparation' },
  { name: 'Heavy', price: 999, slots: 30, usesPerSlot: 4, validity: 365, description: 'High-volume practice' },
]

function ComingSoonBadge() {
  return (
    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
      Coming Soon
    </span>
  )
}

export default function Packs() {
  const navigate = useNavigate()
  const loggedIn = localStorage.getItem('cbtgen_logged_in') === 'true'

  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-28 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-[#080d1d] px-6 py-10 text-white shadow-sm sm:px-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">CBTGen Plans</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Start free. Choose your practice plan.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            Every eligible new user starts with two free demo generations. After both are used,
            choose from the five planned packs below. Each pack currently shows a 365-day validity period.
          </p>
          <div className="mt-5 inline-flex rounded-full border border-blue-300/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200">
            Paid packs are development concepts · Coming Soon
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Start here</p>
              <h2 className="mt-2 text-2xl font-bold text-[#0b1020] sm:text-3xl">Free Demo</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Try CBTGen before choosing a paid pack. You decide whether to use your two demo generations
                on different papers or repeat the same paper.
              </p>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">FREE</span>
              <p className="text-4xl font-extrabold text-[#0b1020]">₹0</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {demoBenefits.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-emerald-50/70 p-4 text-sm leading-6 text-slate-700">
                <span className="mt-0.5 font-bold text-emerald-700" aria-hidden="true">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate(loggedIn ? '/question-papers' : '/login')}
            className="mt-6 w-full rounded-xl bg-[#2662ff] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto sm:min-w-48"
          >
            {loggedIn ? 'Go to My Library' : 'Get Started'}
          </button>
        </section>

        <section className="mt-12">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2662ff]">Planned packs</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0b1020] sm:text-3xl">Choose how you practise</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Compare slots, uses per slot, and total potential generations. All five temporary development packs
                have 365-day validity; prices are not final commercial pricing.
              </p>
            </div>
            <ComingSoonBadge />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {proposedPacks.map((pack) => {
              const totalUses = pack.slots * pack.usesPerSlot
              return (
                <article
                  key={pack.name}
                  className={`relative flex h-full flex-col rounded-3xl border bg-white p-6 shadow-sm transition ${
                    pack.featured ? 'border-[#2662ff] ring-2 ring-[#2662ff]/15' : 'border-slate-200'
                  }`}
                >
                  {pack.featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-[#2662ff] px-3 py-1 text-xs font-bold text-white">
                      Proposed popular choice
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{pack.name}</p>
                      <p className="mt-3 text-4xl font-extrabold tracking-tight text-[#0b1020]">₹{pack.price}</p>
                    </div>
                    <ComingSoonBadge />
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-slate-600">{pack.description}</p>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 py-1.5">
                      <span className="text-sm text-slate-600">Paper slots</span>
                      <span className="font-bold text-[#0b1020]">{pack.slots}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 py-2">
                      <span className="text-sm text-slate-600">Uses per slot</span>
                      <span className="font-bold text-[#0b1020]">{pack.usesPerSlot}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 py-2">
                      <span className="text-sm text-slate-600">Potential total uses</span>
                      <span className="font-bold text-[#0b1020]">{totalUses}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 py-2">
                      <span className="text-sm text-slate-600">Validity</span>
                      <span className="font-bold text-[#0b1020]">{pack.validity} days</span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Unused allowance is proposed to expire when the pack validity ends.
                  </p>
                  <button
                    type="button"
                    disabled
                    title="Purchases are not available yet"
                    className="mt-6 w-full cursor-not-allowed rounded-xl bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
                  >
                    Coming Soon
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500">
          Development-only pricing concept. Prices, validity assignments, pack availability, and purchase rules are not final.
          Paid cards are informational only: checkout is disabled and this page does not grant or modify pack entitlements.
          The existing CBTGen usage and slot architecture remains the source of truth.
        </p>
      </div>
    </main>
  )
}
