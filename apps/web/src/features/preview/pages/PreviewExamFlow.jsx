import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import CandidateAvatar from '../../exam/components/CandidateAvatar'
import '../../exam/styles/ExamLogin.css'
import '../../exam/styles/TestInstructions.css'
import '../../exam/styles/Examination.css'
import './PreviewExamFlow.css'

const demoPapers = {
  'jee-advanced-2022-paper-1': { title: 'JEE (Advanced) 2022 Paper 1', subject: 'Imported', questions: 54, duration: '180 min', sections: 9, marks: 180 },
  'jee-advanced-2016-paper-1': { title: 'JEE (Advanced) 2016 Paper 1', subject: 'Imported', questions: 54, duration: '180 min', sections: 9, marks: 180 },
  'sample-computer-science-2026': { title: 'Sample Computer Science Test', subject: 'Computer Science', questions: 5, duration: '30 min', sections: 1, marks: 'Demo' },
}
const sampleQuestions = [
  { prompt: 'Match the compounds in LIST-I with the observations in LIST-II, and choose the correct option.', rows: ['L1.  Aniline', 'L2.  o-Cresol', 'L3.  Cysteine', 'L4.  Caprolactam'], options: ['Select', 'Option A', 'Option B', 'Option C'] },
  { prompt: 'This demonstration question shows the multiple-choice response layout used by CBTGen.', options: ['Statement I only', 'Statement II only', 'Both statements', 'Neither statement'] },
  { prompt: 'Select the expression that would be appropriate for this demonstration problem.', options: ['Expression A', 'Expression B', 'Expression C', 'Expression D'] },
  { prompt: 'This is another placeholder question for previewing the interface, not an original exam question.', options: ['Choice 1', 'Choice 2', 'Choice 3', 'Choice 4'] },
  { prompt: 'You have reached the final demonstration question in this read-only preview.', options: ['Response A', 'Response B', 'Response C', 'Response D'] },
]

export default function PreviewExamFlow() {
  const { paperId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const paper = demoPapers[paperId] || demoPapers['sample-computer-science-2026']
  const stage = location.pathname.endsWith('/instructions') ? 'instructions' : location.pathname.endsWith('/exam') ? 'exam' : 'login'
  const [candidateId, setCandidateId] = useState('PREVIEW001')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [visited, setVisited] = useState({ 0: true })
  const [markedForReview, setMarkedForReview] = useState({})
  const [sectionCollapsed, setSectionCollapsed] = useState(false)
  const go = (next) => navigate(`/preview-exam/${paperId}/${next}`)
  const leave = () => navigate('/preview-papers')
  const chooseResponse = (key, value) => setResponses((previous) => ({ ...previous, [key]: value }))
  const hasAnswer = (index) => responses[index] !== undefined || Boolean(sampleQuestions[index].rows?.some((row) => responses[`${index}-${row}`]))
  const visitQuestion = (index) => { setQuestionIndex(index); setVisited((previous) => ({ ...previous, [index]: true })) }
  const toggleReview = () => setMarkedForReview((previous) => ({ ...previous, [questionIndex]: !previous[questionIndex] }))
  const clearCurrentResponse = () => setResponses((previous) => { const next = { ...previous }; delete next[questionIndex]; sampleQuestions[questionIndex].rows?.forEach((row) => delete next[`${questionIndex}-${row}`]); return next })
  const questionStatus = (index) => hasAnswer(index) ? (markedForReview[index] ? 'ar' : 'a') : (markedForReview[index] ? 'r' : (visited[index] ? 'na' : 'nv'))

  if (stage === 'login') return (
    <div className="exam-login-page">
      <div className="exam-login-shell">
        <header className="exam-login-header"><img src="/cbtgen-monogram-dark.png" alt="" className="exam-brand-mark" /><span>CBTGen</span></header>
        <section className="exam-candidate-band">
          <div className="candidate-system-details"><div className="candidate-label">System Name :</div><div className="candidate-system-code">PREVIEW</div><div className="candidate-warning">Kindly contact the invigilator if there are any discrepancies in the Name and Photograph displayed on the screen or if the photograph is not yours.</div></div>
          <div className="candidate-name-details"><div className="candidate-label candidate-label-right">Candidate Name :</div><div className="candidate-name-value">Preview Candidate</div><div className="candidate-exam-block"><div className="candidate-label candidate-exam-label">Exam :</div><div className="candidate-exam-value">{paper.title}</div></div></div>
          <div className="candidate-avatar-panel"><CandidateAvatar className="exam-login-avatar" /></div>
        </section>
        <main className="exam-login-main"><div className="exam-login-stage"><section className="exam-login-card"><div className="exam-login-card-header">Login</div><form onSubmit={(event) => { event.preventDefault(); go('instructions') }}><div className="exam-login-field is-active"><span className="exam-login-field-icon" aria-hidden="true">♙</span><input aria-label="Candidate ID" value={candidateId} onChange={(event) => setCandidateId(event.target.value)} /></div><div className="exam-login-field"><span className="exam-login-field-icon" aria-hidden="true">▣</span><input aria-label="Password" value="PREVIEW ONLY" readOnly /></div><p className="preview-mode-note" style={{ margin: '0 0 14px' }}>Preview only — no account or password is checked.</p><button type="submit" className="exam-sign-in-button">Sign In</button><button type="button" onClick={leave} className="preview-exit-link">Exit Preview</button></form></section></div></main>
      </div>
    </div>
  )

  if (stage === 'instructions') return (
    <div className="reference-instructions-page">
      <header className="reference-instructions-header"><strong>{paper.title}</strong><span>Paper Code: PREVIEW</span></header>
      <div className="reference-instructions-layout">
        <main className={`reference-instructions-main ${sectionCollapsed ? 'is-collapsed' : ''}`}>
          <div className="reference-instructions-title">Instructions</div>
          <div className="reference-instructions-scroll"><section className="instruction-section">
            <h2>General Instructions</h2>
            <p><strong>Please read the following carefully.</strong></p>
            <ol className="instruction-numbered-list">
              <li>The duration of this demonstration is <strong>{paper.duration}</strong>. The timer is illustrative and does not count down.</li>
              <li>This preview uses demonstration content and does not represent an official or complete question paper.</li>
              <li>The Question Palette demonstrates the status shapes and navigation style used by CBTGen.</li>
              <li>Question text and options are illustrative placeholders, not original source-paper content.</li>
            </ol>
            <div className="instruction-legend-table">
              <div><span className="legend-demo nv">1</span><span>You have NOT visited the question yet.</span></div>
              <div><span className="legend-demo na">2</span><span>You have NOT answered the question.</span></div>
              <div><span className="legend-demo a">3</span><span>You have answered the question. <strong>This will be evaluated.</strong> (legend demonstration only)</span></div>
              <div><span className="legend-demo r">4</span><span>You have NOT answered the question but marked it for review.</span></div>
              <div><span className="legend-demo ar">5</span><span>You have answered the question and marked it for review.</span></div>
            </div>
            <ol className="instruction-numbered-list" start="5">
              <li>Use the arrow beside the Question Palette to collapse or restore the question panel.</li>
              <li>Any calculator or other exam tool shown in this preview is illustrative only.</li>
              <li><strong>Marking:</strong> This preview does not calculate or record marks.</li>
              <li><strong>Read-only preview:</strong> no answers, session progress, or submissions are saved; viewing does not consume a generation slot or practice attempt.</li>
            </ol>
            <h3>Question Paper Overview</h3>
            <table className="reference-paper-table reference-overview-table"><thead><tr><th>Subject</th><th>No. of Sections</th><th>No. of Questions</th><th>Sections</th><th>Maximum Marks</th></tr></thead><tbody><tr><td>{paper.subject}</td><td>{paper.sections}</td><td>{paper.questions}</td><td><div className="overview-section-list"><span>Mathematics — Section 1</span><span>Mathematics — Section 2</span><span>Physics — Section 1</span><span>Chemistry — Section 1</span></div></td><td>{paper.marks}</td></tr></tbody></table>
            <div className="preview-overview-note"><strong>Paper total:</strong> {paper.sections} section(s), {paper.questions} question(s), {paper.marks} maximum mark(s) — illustrative preview metadata.</div>
            <h3>Marking</h3><p>Marking is configured independently for each question category in a real paper. This demonstration does not calculate scores.</p>
            <table className="reference-paper-table"><thead><tr><th>Question Type</th><th>No. of Questions</th><th>Marking Scheme</th></tr></thead><tbody><tr><td>Multiple Choice Question (demo)</td><td>{paper.questions}</td><td>Not applied in preview</td></tr></tbody></table>
            <h3>Question Types</h3><p><strong>Multiple Choice:</strong> options are displayed to demonstrate the visual layout only.</p><p><strong>Numerical Answer:</strong> answer fields and scoring are not active in this preview.</p><p><strong>Match the Following:</strong> rows and response controls are illustrative.</p>
            <h3>Paper Specific Instructions</h3><p>This section demonstrates the location and styling of paper-specific information. Actual instructions should be derived from the imported paper configuration.</p>
            <h3>Navigating and Answering</h3><ol className="instruction-numbered-list"><li>Use the question palette to navigate between demonstration questions.</li><li>Answer selection, save response, mark for review, and clear response are disabled.</li><li>Use the button below to open the read-only examination preview.</li></ol>
          </section></div>
          <div className="reference-bottom-actions"><button type="button" onClick={leave}>Exit Preview</button><button type="button" onClick={() => go('exam')}>I am ready to begin</button></div>
        </main>
        {!sectionCollapsed && <aside className="reference-summary"><strong>Test Summary</strong><div className="reference-summary-row"><span>Test</span><strong>{paper.title}</strong></div><div className="reference-summary-row"><span>Subject</span><strong>{paper.subject}</strong></div><div className="reference-summary-row"><span>Duration</span><strong>{paper.duration}</strong></div><div className="reference-summary-row"><span>Sections</span><strong>{paper.sections}</strong></div><div className="reference-summary-row"><span>Questions</span><strong>{paper.questions}</strong></div><div className="reference-summary-row"><span>Max Marks</span><strong>{paper.marks}</strong></div></aside>}
        <button className="reference-collapse" type="button" onClick={() => setSectionCollapsed((value) => !value)} aria-label="Toggle preview summary">{sectionCollapsed ? '❮' : '❯'}</button>
      </div>
      <footer className="reference-instructions-footer">CBTGen</footer>
    </div>
  )

  const current = sampleQuestions[questionIndex]
  return (
    <div className="cbt-exam-root screen">
      <div className="frame">
        <header className="header"><span className="exam-brand-title"><img src="/cbtgen-monogram-dark.png" alt="" className="exam-brand-mark" />CBTGen</span><button type="button" className="header-pause" onClick={leave}>Exit Preview</button></header>
        <div className="exam-strip"><span>PREVIEW MODE — {paper.title} — Answers and submission disabled</span><div className="exam-tools"><span className="info-action">Read-only demonstration</span></div></div>
        <div className="pre-question"><div className="pre-left"><div className="subject-row"><button className="subject-button" type="button">{paper.subject}</button><span style={{ marginLeft: 'auto', padding: '7px 10px', color: '#444' }}>Question {questionIndex + 1} of {sampleQuestions.length}</span></div><div className="section-strip"><span>Sections</span><span className="timer">Time Left: --:--</span></div><div className="tabs"><button className="section-tab selected" type="button">Section A <span className="info-icon">i</span></button></div></div><div className="candidate-panel"><CandidateAvatar /><div><strong>Preview Candidate</strong><p>Candidate ID: {candidateId || 'PREVIEW001'}</p><p>System: PREVIEW</p><p>Timer: --:--</p></div></div></div>
        <div className="body">
          <main className="main"><div className="type-row">Question Type : DEMONSTRATION <span>Preview only · No marks recorded</span></div><div className="qno"><strong>Question No. : {questionIndex + 1}</strong></div><section className="question"><p>{current.prompt}</p>{current.rows ? <div className="preview-match-rows">{current.rows.map((row) => <div className="preview-match-row" key={row}><strong>{row}</strong><select aria-label={`Demonstration response for ${row}`} value={responses[`${questionIndex}-${row}`] || ''} onChange={(event) => chooseResponse(`${questionIndex}-${row}`, event.target.value)}><option value=''>Select</option><option value='A'>Option A</option><option value='B'>Option B</option><option value='C'>Option C</option><option value='D'>Option D</option></select></div>)}</div> : current.options.map((option, index) => <button type="button" className={`option preview-selectable-option ${responses[questionIndex] === String(index) ? 'is-selected' : ''}`} key={option} onClick={() => chooseResponse(questionIndex, String(index))} aria-pressed={responses[questionIndex] === String(index)}><span style={{ marginRight: 10 }}>{String.fromCharCode(65 + index)}.</span>{option}</button>)}<p style={{ marginTop: 22, color: '#777', fontSize: 12 }}>Demonstration content only. Your selections stay in this preview and are not submitted, scored, or saved.</p></section><div className="actions"><button type="button" onClick={toggleReview}>{markedForReview[questionIndex] ? 'Unmark Review' : 'Mark for Review and next'}</button><button type="button" onClick={clearCurrentResponse}>Clear Response</button><div className="push"><button type="button" onClick={() => visitQuestion(Math.min(sampleQuestions.length - 1, questionIndex + 1))} disabled={questionIndex === sampleQuestions.length - 1}>Save &amp; Next</button><button type="button" onClick={leave}>Exit Preview</button></div></div></main>
          {!sectionCollapsed && <aside className="right-nav"><div className="legend"><div><span className="badge a"><span className="badge-value">{sampleQuestions.filter((_, index) => hasAnswer(index) && !markedForReview[index]).length}</span></span><small>Answered</small></div><div><span className="badge na"><span className="badge-value">{sampleQuestions.filter((_, index) => visited[index] && !hasAnswer(index) && !markedForReview[index]).length}</span></span><small>Not Answered</small></div><div><span className="badge nv"><span className="badge-value">{sampleQuestions.filter((_, index) => !visited[index]).length}</span></span><small>Not Visited</small></div><div><span className="badge r"><span className="badge-value">{sampleQuestions.filter((_, index) => markedForReview[index] && !hasAnswer(index)).length}</span></span><small>Marked for Review</small></div><div className="wide"><span className="badge ar"><span className="badge-value">{sampleQuestions.filter((_, index) => markedForReview[index] && hasAnswer(index)).length}</span></span><small>Answered &amp; Marked for Review</small></div></div><div className="phead">Section A — Preview</div><div className="psub">Choose a Question</div><div className="grid">{sampleQuestions.map((question, index) => <button type="button" key={question.prompt} className={`p ${questionStatus(index)} ${index === questionIndex ? 'current' : ''}`} onClick={() => visitQuestion(index)} aria-label={`View sample question ${index + 1}: ${questionStatus(index)}`}><span className="question-number">{index + 1}</span></button>)}</div><div style={{ padding: '4px 10px', color: '#666', fontSize: 11 }}>Statuses update locally in this preview only; nothing is submitted or persisted.</div></aside>}
          <button className={`collapse ${sectionCollapsed ? 'is-collapsed' : ''}`} type="button" onClick={() => setSectionCollapsed((value) => !value)} aria-label="Toggle question palette"><span>{sectionCollapsed ? '❮' : '❯'}</span></button>
        </div>
        <footer>CBTGen PREVIEW MODE</footer>
      </div>
    </div>
  )
}
