import { useEffect, useMemo, useState } from 'react'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'


function AdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')


  useEffect(() => {
    let mounted = true

    async function loadDashboard() {
      try {
        const result = await cbtgenApi.admin.dashboard()

        if (mounted) {
          setData(result)
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.message ||
            'Unable to load admin dashboard.'
          )
        }
      }
    }

    loadDashboard()

    return () => {
      mounted = false
    }
  }, [])


  const studentUsers = useMemo(
    () =>
      data?.users?.filter(
        (user) => user.role === 'student'
      ) || [],
    [data]
  )


  if (error) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">
            {error}
          </p>
        </div>
      </main>
    )
  }


  if (!data) {
    return (
      <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">
        <div className="mx-auto max-w-7xl">

          <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-white"
              />
            ))}
          </div>

        </div>
      </main>
    )
  }


  const {
    summary,
    users,
    packs,
    questionPapers,
    slots,
  } = data


  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 pb-20 pt-32 lg:px-8">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="mb-10">

          <p className="text-sm font-semibold tracking-wide text-blue-600">
            ADMINISTRATION
          </p>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h1 className="text-3xl font-bold tracking-tight text-[#0b1020] sm:text-4xl">
                Platform dashboard.
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Manage CBTGen users, question papers,
                packs, slots, and platform usage.
              </p>

            </div>

            <span className="w-fit rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
              Administrator
            </span>

          </div>

        </div>


        {/* SUMMARY */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <Stat
            label="Total users"
            value={summary.totalUsers}
            detail={`${summary.totalStudents} students`}
          />

          <Stat
            label="Question papers"
            value={summary.totalQuestionPapers}
            detail="Across all users"
          />

          <Stat
            label="Active packs"
            value={summary.activePacks}
            detail={`${summary.totalSlots} slots created`}
          />

          <Stat
            label="Generations"
            value={summary.totalGenerations}
            detail="Total consumed uses"
          />

        </div>


        {/* USERS + PACKS */}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">

          {/* STUDENTS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

            <SectionHeader
              title="Students"
              subtitle="All student accounts on the platform."
              count={studentUsers.length}
            />

            <div className="mt-5 space-y-3">

              {studentUsers.length === 0 ? (
                <Empty text="No student accounts yet." />
              ) : (
                studentUsers.map((user) => {

                  const userSlots =
                    slots.filter(
                      (slot) =>
                        slot.userId === user.id
                    )

                  const userPapers =
                    questionPapers.filter(
                      (qp) =>
                        qp.userId === user.id
                    )

                  const used =
                    userSlots.reduce(
                      (sum, slot) =>
                        sum +
                        Number(slot.used || 0),
                      0
                    )

                  return (
                    <div
                      key={user.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div>

                        <p className="font-semibold text-[#0b1020]">
                          {user.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {user.email}
                        </p>

                      </div>

                      <div className="flex gap-5 text-xs font-semibold text-slate-500">

                        <span>
                          {userPapers.length} QP
                        </span>

                        <span>
                          {userSlots.length} slots
                        </span>

                        <span>
                          {used} uses
                        </span>

                      </div>

                    </div>
                  )
                })
              )}

            </div>

          </section>


          {/* PACKS */}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

            <SectionHeader
              title="Packs"
              subtitle="Purchased student packs."
              count={packs.length}
            />

            <div className="mt-5 space-y-3">

              {packs.map((pack) => (

                <div
                  key={pack.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                >

                  <div className="flex items-center justify-between gap-4">

                    <p className="font-semibold text-[#0b1020]">
                      {pack.name}
                    </p>

                    <span className="text-xs font-semibold text-emerald-600">
                      {pack.status}
                    </span>

                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    ₹{pack.price}
                    {' · '}
                    {pack.maxSlots} slots
                    {' · '}
                    {pack.usesPerSlot} uses/slot
                  </p>

                </div>

              ))}

            </div>

          </section>

        </div>


        {/* QUESTION PAPERS */}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">

          <SectionHeader
            title="Question paper library"
            subtitle="QP records across student accounts."
            count={questionPapers.length}
          />

          <div className="mt-5 overflow-x-auto">

            <table className="w-full min-w-[760px] text-left text-sm">

              <thead>

                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">

                  <th className="px-3 py-3">
                    Question paper
                  </th>

                  <th className="px-3 py-3">
                    Owner
                  </th>

                  <th className="px-3 py-3">
                    Fingerprint
                  </th>

                  <th className="px-3 py-3">
                    Status
                  </th>

                </tr>

              </thead>


              <tbody>

                {questionPapers.map((qp) => {

                  const owner =
                    users.find(
                      (user) =>
                        user.id === qp.userId
                    )

                  return (
                    <tr
                      key={qp.id}
                      className="border-b border-slate-50 last:border-0"
                    >

                      <td className="px-3 py-4 font-semibold text-[#0b1020]">
                        {qp.name}
                      </td>

                      <td className="px-3 py-4 text-slate-600">
                        {owner?.email || qp.userId}
                      </td>

                      <td className="max-w-[260px] truncate px-3 py-4 font-mono text-xs text-slate-500">
                        {qp.fingerprint || '—'}
                      </td>

                      <td className="px-3 py-4">

                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          {qp.status}
                        </span>

                      </td>

                    </tr>
                  )
                })}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </main>
  )
}


function Stat({
  label,
  value,
  detail,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-[#0b1020]">
        {value}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {detail}
      </p>

    </section>
  )
}


function SectionHeader({
  title,
  subtitle,
  count,
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <div>

        <h2 className="text-xl font-bold text-[#0b1020]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {subtitle}
        </p>

      </div>

      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
        {count}
      </span>

    </div>
  )
}


function Empty({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  )
}


export default AdminDashboard