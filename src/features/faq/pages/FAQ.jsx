import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const groups = [
  { title: 'Getting Started', description: 'Understand CBTGen and the basic workflow.', items: [
    ['What is CBTGen?', 'CBTGen is a computer-based testing platform designed to turn supported, structured question-paper data into an online examination experience. It supports paper structure, test configuration, question navigation, response handling and scoring according to configured marking rules.'],
    ['How do I get started?', 'Choose your original question paper in the import area. The planned internal workflow will extract questions and supporting content, validate uncertain items, and prepare the paper for practice. Source-document processing is still being connected.'],
    ['What does user-customisable CBT mean?', 'It means configuring a test using the settings available for the imported paper, such as its supported structure, question types and marking configuration. The exact options depend on the paper and the current version of CBTGen.'],
  ]},
  { title: 'Paper Import', description: 'Learn about adding original question papers to CBTGen.', items: [
    ['Can I upload a PDF directly?', 'The new import interface accepts PDF, DOCX, and supported image files for selection. The internal extraction and conversion engine is still being connected, so selecting a file does not yet process or save it.'],
    ['Which source formats are planned?', 'The source-first workflow is being built for PDF, DOCX, scanned documents, and supported image files. Availability will depend on the completed processing engine and its validation checks.'],
    ['How does CBTGen prepare a paper?', 'The planned internal pipeline extracts paper metadata, sections, questions, options, answer evidence, marking rules, and references to diagrams or other assets. It validates the result and flags uncertain content for review before saving.'],
    ['Can a paper include images and equations?', 'The conversion and rendering architecture supports rich content and image assets, along with mathematical rendering. Compatibility depends on the converted content and renderer, so inspect the imported paper before using it.'],
    ['What if an image or question is missing?', 'The intended processing workflow will flag extraction issues for review instead of silently inventing missing content. Until the internal engine is connected, selecting a source file does not perform extraction.'],
  ]},
  { title: 'Test Configuration', description: 'Understand the settings that shape a test.', items: [
    ['Can I customise subjects and sections?', 'CBTGen paper structure supports subjects and sections. The fields available for editing depend on the current test-configuration interface and the imported paper.'],
    ['Can different question types have different marking schemes?', 'The scoring architecture supports marking rules by question category, including different rules where the configuration distinguishes them. Review the displayed marking scheme for the specific paper.'],
    ['Which question types are supported?', 'The project includes question-type handling for formats such as single-choice, multiple-select, numerical-answer and match-the-following questions. Availability should be checked in the current production build for a particular paper.'],
    ['Can I generate different versions of a paper?', 'CBTGen includes paper-generation and randomisation logic. Available variations depend on the paper configuration and the generation rules exposed by the current interface.'],
    ['Can I preview before starting?', 'CBTGen includes preview and test-configuration workflows. Check the current preview screen and usage rules before assuming a particular preview route is available or free of usage deductions.'],
  ]},
  { title: 'Taking an Exam', description: 'Navigate questions and understand their statuses.', items: [
    ['What do the question-palette statuses mean?', 'Not Visited means the question has not been opened. Not Answered means it has been visited but has no response. Answered means a response has been provided. Marked for Review means it is flagged without an answer. Answered & Marked for Review means it has a response and is flagged for review.'],
    ['Can I change an answer?', 'The examination interface supports response entry and navigation. Editing or clearing a response depends on the question type and the current session state.'],
    ['What happens when the timer reaches zero?', 'The examination workflow includes a countdown timer and timeout handling. Exact timeout and finalisation behaviour should be confirmed in the deployed version and the instructions shown for the test.'],
    ['Can I pause and resume?', 'CBTGen includes pause-and-resume session handling. Availability depends on session type and state; follow the controls shown in the examination interface.'],
    ['What happens when I submit?', 'Submission moves an attempt through its finalisation workflow. The resulting score depends on the responses recorded and the paper’s configured marking rules.'],
  ]},
  { title: 'Results & Scoring', description: 'Learn how configured marks affect your result.', items: [
    ['How is my score calculated?', 'Scoring follows the applicable question-type marking configuration. Depending on the paper, this may include marks for correct answers, penalties for incorrect answers and partial credit.'],
    ['Are unanswered questions penalised?', 'That depends on the configured marking rules. Check the marking scheme for the specific paper rather than assuming every paper uses the same rule.'],
    ['Can I review my result?', 'CBTGen includes an exam-result workflow. The exact result details and any question-by-question analysis depend on the functionality enabled in the deployed version.'],
    ['Can I attempt the same paper again?', 'CBTGen has reattempt and usage-lifecycle logic. Whether another attempt is available depends on the applicable usage rules, session state and entitlements.'],
  ]},
  { title: 'Usage, Slots & Packs', description: 'Understand usage allowances and access limits.', items: [
    ['What is a usage slot?', 'A usage slot is part of CBTGen’s usage-management model. It helps control access to permitted operations according to the applicable pack and lifecycle rules.'],
    ['How many tests can I generate?', 'Available usage depends on the pack assigned to your account and the rules that apply to each generation or attempt. Check the current account interface for your actual allowance.'],
    ['Does previewing consume usage?', 'CBTGen’s tested authorisation logic distinguishes previewing from authorised operations that consume usage. The exact rule should be confirmed for the preview route currently deployed.'],
    ['What happens when I run out of slots?', 'Operations that require available usage may be restricted. The exact recharge process, pack allowances and expiry rules depend on the currently deployed billing policy.'],
  ]},
  { title: 'Privacy & Troubleshooting', description: 'Resolve common issues and find help.', items: [
    ['Why can’t my source paper be processed yet?', 'The source-file selection interface is available, but the internal PDF/DOCX extraction, crop generation, validation, and save pipeline is still under development. The selected file is not uploaded or stored by this interface.'],
    ['How will image and equation issues be handled?', 'The planned pipeline will preserve equations and diagrams where possible, create image crops when needed, and flag uncertain or potentially clipped content for review against the source document.'],
    ['Are my papers and attempts private?', 'CBTGen has user-isolation and access-control protections in its project architecture. For definitive details about storage, retention, sharing and deletion, consult the published privacy policy when available.'],
    ['How do I contact support?', 'The official CBTGen contact link will be added here when the support channel is finalised. Do not share passwords or other sensitive information when reporting an issue.'],
  ]},
]

export default function FAQ() {
  const [query, setQuery] = useState('')
  const [openItems, setOpenItems] = useState({ 'Getting Started-0': true })
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups.map(group => ({ ...group, items: group.items.filter(([question, answer]) => !q || `${group.title} ${question} ${answer}`.toLowerCase().includes(q)) })).filter(group => group.items.length)
  }, [query])
  const total = filtered.reduce((sum, group) => sum + group.items.length, 0)
  function toggle(key) { setOpenItems(prev => ({ ...prev, [key]: !prev[key] })) }

  function scrollToTopic(title) {
    const section = document.getElementById(slug(title))
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-blue-50/70 px-4 pb-20 pt-32 text-[#0b1020] sm:px-6 sm:pt-36">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#2662ff]"><span className="h-2 w-2 rounded-full bg-[#2662ff]" /> CBTGen Help Center</div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Questions? <span className="text-[#2662ff]">We’ve got answers.</span></h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Learn how to import papers, customise your tests, practise in exam mode and understand your results.</p>
          <label className="mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-400 shadow-sm focus-within:border-[#2662ff] focus-within:ring-4 focus-within:ring-blue-100">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions, imports, scoring..." className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" aria-label="Search frequently asked questions" />
            {query && <button type="button" onClick={() => setQuery('')} className="text-sm font-semibold text-[#2662ff]">Clear</button>}
          </label>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">Browse topics</p>
            <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="FAQ categories">
              {filtered.map(group => <button key={group.title} type="button" onClick={() => scrollToTopic(group.title)} className="shrink-0 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-[#2662ff]">{group.title}</button>)}
            </nav>
          </aside>
          <div className="min-w-0 space-y-8">
            {filtered.map(group => <section key={group.title} id={slug(group.title)} className="scroll-mt-28">
              <div className="mb-4"><h2 className="text-xl font-bold tracking-tight sm:text-2xl">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {group.items.map(([question, answer], index) => {
                  const key = `${group.title}-${index}`
                  const isOpen = Boolean(openItems[key]) || Boolean(query.trim())
                  return <article key={question} className="border-b border-slate-100 last:border-b-0">
                    <h3><button type="button" aria-expanded={isOpen} onClick={() => toggle(key)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:px-6 sm:text-base"><span>{question}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isOpen ? 'bg-blue-100 text-[#2662ff]' : 'bg-slate-100 text-slate-500'}`} aria-hidden="true">{isOpen ? '−' : '+'}</span></button></h3>
                    {isOpen && <div className="px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6">{answer}</div>}
                  </article>
                })}
              </div>
            </section>)}
            {!total && <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-bold">No matching questions</h2><p className="mt-2 text-sm text-slate-500">Try another search term or clear your search.</p><button type="button" onClick={() => setQuery('')} className="mt-4 rounded-xl bg-[#2662ff] px-4 py-2.5 text-sm font-semibold text-white">Clear search</button></div>}
          </div>
        </div>

        <div className="mt-14 rounded-3xl bg-[#080d1d] p-7 text-white sm:p-10">
          <p className="text-sm font-semibold text-blue-300">Still need help?</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">We’re making CBT practice simpler.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">The official contact link will be added when CBTGen’s support channel is ready. For now, review the relevant FAQ section and check your paper package and error details.</p>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#2662ff] px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500">Back to home</Link>
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Some details depend on the current paper, account and deployed features. Check the settings shown in CBTGen for the definitive rules that apply to your session.</p>
      </div>
    </main>
  )
}

function slug(value) { return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
