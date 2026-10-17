import { useEffect, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { cbtgenApi } from '../../../lib/api/cbtgenApi'

function Account() {

  const navigate = useNavigate()

  const [data, setData] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    cbtgenApi.account.get()
      .then(result => {
        if (!cancelled) {
          setData(result)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Unable to load account.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {

    await cbtgenApi.auth.logout()

    navigate('/', { replace: true })

  }

  if (loading) {

    return (

      <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

            <div className="h-56 animate-pulse rounded-2xl bg-white" />

            <div className="h-56 animate-pulse rounded-2xl bg-white" />

          </div>

        </div>

      </main>

    )

  }

  if (error) {

    return (

      <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">

            <p className="font-semibold text-red-700">

              {error}

            </p>

          </div>

        </div>

      </main>

    )

  }

  const {

    user,

    pack,

    slots,

    purchases,

    summary,

    demoAllowance,

  } = data

  const capacityPercent =

    summary.totalCapacity > 0

      ? (

          (summary.usedGenerations /

            summary.totalCapacity) *

          100

        )

      : 0

  return (

    <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-10">

          <p className="text-sm font-semibold tracking-wide text-blue-600">

            ACCOUNT

          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1020] sm:text-4xl">

            Your account.

          </h1>

          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">

            Manage your personal information, pack,

            practice capacity, and account settings.

          </p>

        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">

          {/* LEFT */}

          <div className="space-y-6">

            {/* PROFILE */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                    Personal information

                  </p>

                  <h2 className="mt-2 text-xl font-bold text-[#0b1020]">

                    Profile

                  </h2>

                  <p className="mt-1 text-sm text-slate-500">

                    Your basic CBTGen account information.

                  </p>

                </div>

                <button

                  type="button"

                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"

                >

                  Edit

                </button>

              </div>

              <div className="mt-7 grid gap-5 sm:grid-cols-2">

                <InfoField

                  label="Name"

                  value={user.name}

                />

                <InfoField

                  label="Email"

                  value={user.email}

                />

              </div>

            </section>

            {/* CURRENT PACK */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">

                    Current pack

                  </p>

                  <h2 className="mt-2 text-xl font-bold text-[#0b1020]">

                    {pack?.name || (demoAllowance ? 'Free Demo Plan' : 'No active pack')}

                  </h2>

                  <p className="mt-1 text-sm text-slate-500">

                    {pack ? 'Your purchased practice capacity.' : demoAllowance ? 'Your free demo entitlement. This is separate from paid packs and slots.' : 'Your current practice capacity.'}

                  </p>

                </div>

                {pack && (

                  <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">

                    {pack.status === 'active'

                      ? 'Active'

                      : 'Inactive'}

                  </span>

                )}

              </div>

              {pack ? (

                <>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                    <Stat

                      label="Price"

                      value={`₹${pack.price}`}

                    />

                    <Stat

                      label="Slots"

                      value={`${slots.length} / ${pack.maxSlots}`}

                    />

                    <Stat

                      label="Generations"

                      value={`${summary.usedGenerations} / ${summary.totalCapacity}`}

                    />

                    <Stat

                      label="Uses / slot"

                      value={pack.usesPerSlot}

                    />

                  </div>

                  <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-5">

                    <div className="flex items-center justify-between gap-4">

                      <div>

                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">

                          Overall generation capacity

                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">

                          {summary.remainingGenerations} generations remaining

                        </p>

                      </div>

                      <span className="text-sm font-bold text-blue-600">

                        {summary.usedGenerations} / {summary.totalCapacity}

                      </span>

                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">

                      <div

                        className="h-full rounded-full bg-blue-600 transition-all"

                        style={{

                          width: `${capacityPercent}%`,

                        }}

                      />

                    </div>

                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">

                      <span>

                        Purchased:{' '}

                        {formatDate(pack.purchasedAt)}

                      </span>

                      <span>

                        Valid until:{' '}

                        {formatDate(pack.expiresAt)}

                      </span>

                    </div>

                  </div>

                </>

              ) : demoAllowance ? (

                <>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-5">

                    <div>

                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Current plan</p>

                      <p className="mt-1 text-2xl font-bold text-slate-950">₹0 <span className="text-sm font-medium text-slate-500">Free Demo Plan</span></p>

                      <p className="mt-1 text-sm text-slate-600">No purchase required · lifetime demo allowance</p>

                    </div>

                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">Active</span>

                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">

                    <Stat label="Demo generations included" value={`${demoAllowance.allowed} lifetime`} />

                    <Stat label="Demo generations used" value={`${demoAllowance.used} of ${demoAllowance.allowed}`} />

                    <Stat label="Demo generations remaining" value={demoAllowance.remaining} />

                  </div>

                  <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">The Free Demo allowance is separate from paid practice slots. Previewing papers and failed generations should not consume it. The demo generation workflow is not yet connected, so this card displays the planned allowance but does not authorize or charge a generation.</p>

                </>

              ) : (

                <div className="mt-6 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">

                  You currently do not have an active pack.

                </div>

              )}

            </section>

            {/* SLOT USAGE */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                  Slot usage

                </p>

                <h2 className="mt-2 text-xl font-bold text-[#0b1020]">

                  Your active slots

                </h2>

                <p className="mt-1 text-sm text-slate-500">

                  Each slot is bound to a question paper.

                </p>

              </div>

              <div className="mt-6 space-y-3">

                {slots.length === 0 ? (

                  <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">

                    No slots have been created yet.

                  </div>

                ) : (

                  slots.map(slot => {

                    const qp =

                      data.questionPapers.find(

                        item =>

                          item.id === slot.qpId

                      )

                    const remaining =

                      Math.max(

                        0,

                        slot.usesPerSlot -

                          slot.used

                      )

                    return (

                      <Slot

                        key={slot.id}

                        slot={slot.id

                          .split('-')

                          .pop()

                          .slice(-2)

                          .padStart(2, '0')}

                        name={

                          qp?.name ||

                          'Question Paper'

                        }

                        used={`${slot.used} / ${slot.usesPerSlot}`}

                        remaining={

                          remaining > 0

                            ? `${remaining} remaining`

                            : 'Exhausted'

                        }

                        active={

                          remaining > 0

                        }

                      />

                    )

                  })

                )}

              </div>

            </section>

            {/* SECURITY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                Security

              </p>

              <h2 className="mt-2 text-xl font-bold text-[#0b1020]">

                Account security

              </h2>

              <div className="mt-6 divide-y divide-slate-100">

                <SecurityRow

                  title="Password"

                  description="Keep your account protected with a strong password."

                  action="Change password"

                />

                <SecurityRow

                  title="Email address"

                  description={user.email}

                  action="Manage"

                />

              </div>

            </section>

          </div>

          {/* RIGHT */}

          <div className="space-y-6">

            {/* ACCOUNT SUMMARY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#080d1d] text-lg font-bold text-white">

                  {user.name

                    ?.charAt(0)

                    ?.toUpperCase() || 'C'}

                </div>

                <div className="min-w-0">

                  <h2 className="truncate text-lg font-bold text-[#0b1020]">

                    {user.name}

                  </h2>

                  <p className="truncate text-sm text-slate-500">

                    {user.email}

                  </p>

                </div>

              </div>

              <div className="mt-6 rounded-xl bg-blue-50 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">

                  Account status

                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">

                  Active account

                </p>

              </div>

            </section>

            {/* PURCHASE HISTORY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                Purchase history

              </p>

              <h2 className="mt-2 text-lg font-bold text-[#0b1020]">

                Recent purchases

              </h2>

              <div className="mt-5 space-y-3">

                {purchases.length === 0 ? (

                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">

                    No purchases yet.

                  </div>

                ) : (

                  purchases.map(purchase => (

                    <div

                      key={purchase.id}

                      className="rounded-xl border border-slate-100 bg-slate-50 p-4"

                    >

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm font-semibold text-slate-800">

                            {purchase.packName}

                          </p>

                          <p className="mt-1 text-xs text-slate-500">

                            {formatDate(

                              purchase.purchasedAt

                            )}

                          </p>

                        </div>

                        <p className="text-sm font-bold text-slate-900">

                          ₹{purchase.price}

                        </p>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">

                        <span className="rounded-md bg-white px-2 py-1">

                          {purchase.maxSlots} slots

                        </span>

                        <span className="rounded-md bg-white px-2 py-1">

                          {purchase.usesPerSlot} uses / slot

                        </span>

                        <span className="rounded-md bg-white px-2 py-1">

                          {purchase.validityDays === 365

                            ? '1 year'

                            : `${purchase.validityDays} days`}

                        </span>

                      </div>

                    </div>

                  ))

                )}

              </div>

            </section>

            {/* ACCOUNT ACTIONS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">

                Account

              </p>

              <h2 className="mt-2 text-lg font-bold text-[#0b1020]">

                Account actions

              </h2>

              <div className="mt-5 space-y-2">

                <button

                  type="button"

                  className="w-full cursor-pointer rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"

                >

                  Purchase a new pack

                </button>

                <button

                  type="button"

                  className="w-full cursor-pointer rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"

                >

                  View help

                </button>

                <button

                  type="button"

                  onClick={logout}

                  className="w-full cursor-pointer rounded-xl border border-red-200 px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"

                >

                  Log out

                </button>

              </div>

            </section>

          </div>

        </div>

      </div>

    </main>

  )

}

function InfoField({ label, value }) {

  return (

    <div>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">

        {label}

      </p>

      <p className="mt-2 text-sm font-semibold text-slate-800">

        {value}

      </p>

    </div>

  )

}

function Stat({ label, value }) {

  return (

    <div className="rounded-xl bg-slate-50 p-4">

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">

        {label}

      </p>

      <p className="mt-2 text-lg font-bold text-[#0b1020]">

        {value}

      </p>

    </div>

  )

}

function Slot({

  slot,

  name,

  used,

  remaining,

  active,

}) {

  return (

    <div className="rounded-xl border border-slate-100 p-4">

      <div className="flex items-start gap-3">

        <div

          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${

            active

              ? 'bg-blue-50 text-blue-600'

              : 'bg-slate-100 text-slate-400'

          }`}

        >

          {slot}

        </div>

        <div className="min-w-0 flex-1">

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

            <p className="truncate text-sm font-semibold text-slate-800">

              {name}

            </p>

            <span

              className={`text-xs font-semibold ${

                active

                  ? 'text-blue-600'

                  : 'text-slate-500'

              }`}

            >

              {remaining}

            </span>

          </div>

          <p className="mt-1 text-xs text-slate-500">

            {used} used

          </p>

        </div>

      </div>

    </div>

  )

}

function SecurityRow({

  title,

  description,

  action,

}) {

  return (

    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">

      <div>

        <p className="text-sm font-semibold text-slate-800">

          {title}

        </p>

        <p className="mt-1 text-xs text-slate-500">

          {description}

        </p>

      </div>

      <button

        type="button"

        className="w-fit cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"

      >

        {action}

      </button>

    </div>

  )

}

function formatDate(value) {

  if (!value) return '—'

  return new Date(value).toLocaleDateString(

    'en-IN',

    {

      day: '2-digit',

      month: 'short',

      year: 'numeric',

    }

  )

}

export default Account
