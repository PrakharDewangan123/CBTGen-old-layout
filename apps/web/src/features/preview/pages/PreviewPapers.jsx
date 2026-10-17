import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const previewPapers = [
  {
    id: 'jee-advanced-2022-paper-1',
    title: 'JEE (Advanced) 2022 — Paper 1',
    exam: 'JEE Advanced',
    year: '2022',
    questions: '54 questions',
    marks: '180 marks',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    description: 'A read-only look at the structure of a complete JEE Advanced paper.',
    sections: [
      'Mathematics — 18 questions',
      'Physics — 18 questions',
      'Chemistry — 18 questions',
    ],
    note: 'This preview shows paper structure only. It does not start an exam or create a practice attempt.',
  },
  {
    id: 'jee-advanced-2016-paper-1',
    title: 'JEE (Advanced) 2016 — Paper 1',
    exam: 'JEE Advanced',
    year: '2016',
    questions: '54 questions',
    marks: 'Paper structure preview',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    description: 'Explore the layout and section-based format of the 2016 Paper 1.',
    sections: [
      'Physics — Section 1 and Section 2',
      'Chemistry — sections as supplied in the source paper',
      'Mathematics — sections as supplied in the source paper',
    ],
    note: 'Read-only preview. Answering, scoring, and exam-session controls are disabled here.',
  },
  {
    id: 'sample-computer-science-2026',
    title: 'Sample Computer Science Test',
    exam: 'CBTGen Sample',
    year: '2026',
    questions: '5 questions',
    marks: '7 marks',
    subjects: ['Computer Science'],
    description: 'A short sample showing how a CBTGen question paper is presented.',
    sections: ['Computer Science — 5 questions'],
    sampleQuestion: {
      prompt: 'Which data structure follows FIFO?',
      options: ['Stack', 'Queue', 'Binary Tree', 'Graph'],
    },
    note: 'This is a demonstration preview. Choices are shown for display only and cannot be submitted.',
  },
]

export default function PreviewPapers() {
  const navigate = useNavigate()
  const [selectedPaperId, setSelectedPaperId] = useState(null)
  const selectedPaper = previewPapers.find((paper) => paper.id === selectedPaperId)

  return (
    <main className="min-h-screen bg-slate-50 pb-16 pt-28 sm:pt-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-6 cursor-pointer text-sm font-semibold text-slate-600 transition hover:text-blue-700"
        >
          ← Back to home
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            PREVIEW LIBRARY · READ ONLY
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Explore question papers before you practice.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Browse these sample paper previews to see the kind of structure CBTGen supports. Previewing is free and does not consume a generation slot or start a practice attempt.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">No exam session</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">No answers submitted</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">No slots consumed</span>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {previewPapers.map((paper) => (
            <article key={paper.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{paper.exam}</span>
                <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">{paper.year}</span>
              </div>
              <h2 className="mt-5 text-xl font-bold leading-7 text-slate-950">{paper.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{paper.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Questions</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{paper.questions}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Marks</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{paper.marks}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {paper.subjects.map((subject) => (
                  <span key={subject} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">{subject}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate(`/preview-exam/${paper.id}/login`)}
                className="mt-6 w-full cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                View Preview Paper <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>

        {selectedPaper && (
          <section className="mt-8 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Read-only paper preview</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedPaper.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{selectedPaper.note}</p>
              </div>
              <button type="button" onClick={() => setSelectedPaperId(null)} className="cursor-pointer self-start rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close preview</button>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Paper overview</h3>
                <ul className="mt-3 space-y-2">
                  {selectedPaper.sections.map((section) => (
                    <li key={section} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{section}</li>
                  ))}
                </ul>
              </div>
              {selectedPaper.sampleQuestion ? (
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sample question · display only</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-900">{selectedPaper.sampleQuestion.prompt}</p>
                  <div className="mt-4 space-y-2">
                    {selectedPaper.sampleQuestion.options.map((option, index) => (
                      <div key={option} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs">{String.fromCharCode(65 + index)}</span>
                        {option}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-slate-500">Options are intentionally not interactive in preview mode.</p>
                </div>
              ) : (
                <div className="flex flex-col justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                  <p className="text-sm font-bold text-slate-900">Paper structure preview</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">This preview displays the paper identity and section structure. The interactive examination, answer submission, and scoring are not available from this page.</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
              <button type="button" onClick={() => navigate('/login')} className="cursor-pointer rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">Start practicing with CBTGen</button>
              <button type="button" onClick={() => navigate('/')} className="cursor-pointer rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Back to home</button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
