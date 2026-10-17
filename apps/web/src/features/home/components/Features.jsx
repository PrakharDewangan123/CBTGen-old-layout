function Features() {
  const features = [
    {
      number: '01',
      title: 'Real CBT Experience',
      description:
        'Practice in a focused computer-based test environment designed to feel like an actual examination.',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      number: '02',
      title: 'Question Paper Practice',
      description:
        'Choose from available question papers and turn them into structured CBT practice sessions.',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5M8 12h8M8 16h6" />
        </svg>
      ),
    },
    {
      number: '03',
      title: 'Practice Your Way',
      description:
        'Use your available practice capacity across question papers and build familiarity through repetition.',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <path d="M20 11a8.1 8.1 0 0 0-15.5-3M4 4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 3M20 20v-4h-4" />
        </svg>
      ),
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-slate-50 py-24 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">

        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">

          <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Why CBTGen
          </span>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            Built around the way

            <span className="block text-blue-600">
              you practice.
            </span>
          </h2>

          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
            Everything you need to turn question papers into a structured
            computer-based practice experience.
          </p>

        </div>

        {/* Feature cards */}
        <div className="mt-14 grid gap-5 md:grid-cols-3">

          {features.map((feature) => (
            <article
              key={feature.number}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
            >

              {/* Number */}
              <div className="absolute right-6 top-5 text-xs font-bold text-slate-200 transition group-hover:text-blue-100">
                {feature.number}
              </div>

              {/* Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                {feature.icon}
              </div>

              <h3 className="mt-7 text-lg font-bold text-slate-950">
                {feature.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {feature.description}
              </p>

              <div className="mt-7 h-px w-10 bg-blue-600 transition-all duration-300 group-hover:w-16" />

            </article>
          ))}

        </div>
      </div>
    </section>
  )
}

export default Features