import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { useTestConfiguration } from '../hooks/useTestConfiguration'
import { QUESTION_TYPES, partialMarksDisplay } from '../services/testConfigurationService'

function TestConfiguration() {
  const {
    config,
    error,
    setError,
    localPaperAvailable,
    pendingPractice,
    showFinalConfirmation,
    authorizing,
    updateField,
    updateSubject,
    addSubject,
    removeSubject,
    updateSection,
    moveSectionToSubject,
    updateType,
    addType,
    removeType,
    addSection,
    removeSection,
    saveAndContinue,
    cancelFinalConfirmation,
    confirmFinalPractice,
  } = useTestConfiguration()

  if (error && !config) {
    return (
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#f8fafc] px-3 pb-24 pt-28 sm:px-5">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
        </div>
      </main>
    )
  }

  if (!config) {
    return (
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#f8fafc] px-3 pb-24 pt-28 sm:px-5">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">Loading test configuration...</div>
        </div>
      </main>
    )
  }

  const configuredQuestionCount = config.sections.reduce(
    (sum, section) => sum + (section.types || []).reduce((sectionSum, row) => sectionSum + Math.max(0, Number(row.count) || 0), 0),
    0,
  )

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-[#f8fafc] px-3 pb-24 pt-28 sm:px-5">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="text-sm font-bold tracking-wide text-blue-600">STEP 2 — TEST CONFIGURATION</div>
          <h1 className="mt-2 text-3xl font-bold text-[#0b1020]">Configure your test</h1>
          <p className="mt-2 text-slate-500">All information available in the question paper is pre-filled. Only unavailable or optional information needs your input.</p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button type="button" className="ml-4 font-semibold underline" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        {!localPaperAvailable && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            The QP metadata is available, but the complete local XML/paper is not available in this browser. Values that require question-level source data cannot be auto-filled until the QP is imported locally again.
          </div>
        )}

        {config.source?.sourceOnly && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            The complete source XML is loaded locally. This paper is currently source-only because its answer key is incomplete; section, question-count, question-type and marking configuration can still be pre-filled from the XML.
          </div>
        )}

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6 lg:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="test-name-field" label="Test Name" value={config.testName} disabled={Boolean(config.fieldLocks?.testName || config.configurationFrozen)} onChange={(value) => updateField('testName', value)} required />
            <Field label="Paper Code / QP ID" value={config.paperCode} disabled={Boolean(config.fieldLocks?.paperCode || config.configurationFrozen)} onChange={(value) => updateField('paperCode', value)} />
            <Field label="Year" type="number" value={config.year} disabled={Boolean(config.fieldLocks?.year || config.configurationFrozen)} onChange={(value) => updateField('year', Number(value))} />
            <Field label="Paper Number" value={config.paperNumber} disabled={Boolean(config.fieldLocks?.paperNumber || config.configurationFrozen)} onChange={(value) => updateField('paperNumber', value)} />
            <Field
              id="duration-field"
              label="Duration (minutes)"
              type="number"
              value={config.duration}
              required
              min={1}
              disabled={Boolean(config.fieldLocks?.duration || config.configurationFrozen)}
              helperText={
                'Required when the question paper does not provide a duration.'
              }
              onChange={(value) => updateField('duration', value === '' ? '' : Number(value))}
            />
            <Field
              label="Total Questions"
              type="number"
              value={config.totalQuestions}
              onChange={(value) => updateField('totalQuestions', Number(value))}
              disabled={Boolean(config.fieldLocks?.totalQuestions || config.configurationFrozen)}
              required
            />

            <Field
              label="Total / Maximum Marks"
              type="number"
              value={config.maxMarks}
              onChange={(value) => updateField('maxMarks', Number(value))}
              disabled={Boolean(config.fieldLocks?.maxMarks || config.configurationFrozen)}
              required
           />
          </div>

          <div id="sections-config" className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#0b1020]">Subjects & Section Structure</h2>
                <p className="mt-1 text-sm text-slate-500">Subjects and section relationships are extracted when the QP provides them. Otherwise the available QP category is used as an editable fallback.</p>
              </div>
              <button type="button" onClick={addSubject} disabled={Boolean(config.subjects.some((item) => item.locks?.name) || config.configurationFrozen)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">+ Add Subject</button>
            </div>

            <div className="mt-5 space-y-4">
              {config.subjects.map((subject, subjectIndex) => (
                <div key={subject.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <div className="w-full min-w-0">
                      <label htmlFor={subjectIndex === 0 ? 'subject-field' : undefined} className="block text-sm font-semibold text-slate-700">Subject Name <span className="ml-1 text-red-500">*</span></label>
                      <input id={subjectIndex === 0 ? 'subject-field' : undefined} value={subject.name} disabled={Boolean(subject.locks?.name || config.configurationFrozen)} onChange={(event) => updateSubject(subjectIndex, event.target.value)} className="mt-2 block w-full min-w-0 box-border rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500" placeholder="Enter subject name if unavailable in QP" />
                    </div>
                    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                      <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">Sections: {subject.sections.length}</div>
                      <button type="button" onClick={() => addSection(subject.id)} disabled={Boolean(config.sections.some((item) => item.locks?.name) || config.configurationFrozen)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">+ Add Section</button>
                      <button type="button" onClick={() => removeSubject(subjectIndex)} disabled={config.subjects.length <= 1 || Boolean(subject.locks?.name || config.configurationFrozen)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Remove Subject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-slate-50 p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <Summary label="Questions" value={configuredQuestionCount || config.totalQuestions} />
              <Summary label="Max Marks" value={config.maxMarks} />
              <Summary label="Sections" value={config.sections.length} />
              <Summary label="Subjects" value={config.subjects.length} />
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-[#0b1020]">Section & Marking Configuration</h2>
              <p className="mt-1 text-sm text-slate-500">Question-level data is grouped by question type and marking scheme. If the same type has different marking, each scheme remains a separate row. Conditional partial-marking rules are preserved separately from the base correct/wrong marks.</p>
            </div>

            <div className="space-y-5">
              {config.sections.map((section) => (
                <section key={section.id} className="rounded-xl border border-slate-200 bg-white">
                  <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-100 px-3 py-3 sm:px-4">
                    <input value={section.name} disabled={Boolean(section.locks?.name || config.configurationFrozen)} onChange={(event) => updateSection(section.id, 'name', event.target.value)} className={`w-full min-w-0 flex-1 rounded-lg sm:min-w-[220px] border border-slate-300 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 ${section.locks?.name || config.configurationFrozen ? 'bg-slate-100 text-slate-500' : ''}`} />
                    <select value={section.subjectId || ''} disabled={Boolean(section.locks?.subjectName || config.configurationFrozen)} onChange={(event) => moveSectionToSubject(section.id, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500">
                      {config.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name || 'Unnamed Subject'}</option>)}
                    </select>
                    <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600">Questions: {section.types.reduce((sum, row) => sum + Number(row.count || 0), 0) || section.declaredQuestionCount || 0}</div>
                    <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600">Declared Marks: {section.declaredMarks || 0}</div>
                    <button type="button" onClick={() => removeSection(section.id)} disabled={config.sections.length <= 1 || Boolean(section.locks?.name || config.configurationFrozen)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Remove Section</button>
                  </div>

                  <div className="max-w-full overflow-x-auto p-3 sm:p-4">
                    <table className="w-full min-w-[820px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 text-left">
                          <th className="border border-slate-200 px-3 py-2">Question Type</th>
                          <th className="border border-slate-200 px-3 py-2">No. of Questions</th>
                          <th className="border border-slate-200 px-3 py-2">Correct Marks</th>
                          <th className="border border-slate-200 px-3 py-2">Wrong Marks</th>
                          <th className="border border-slate-200 px-3 py-2">Partial Marks</th>
                          <th className="border border-slate-200 px-3 py-2 min-w-[280px]">Partial Marking Rules</th>
                          <th className="border border-slate-200 px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {section.types.length > 0 ? section.types.map((row, typeIndex) => (
                          <tr key={`${section.id}-${row.type}-${typeIndex}`}>
                            <td className="border border-slate-200 px-3 py-2">
                              <select value={row.type || 'MCQ'} disabled={Boolean(row.locks?.type || config.configurationFrozen)} title={row.locks?.type ? 'Question type is defined by the imported paper' : undefined} onChange={(event) => updateType(section.id, typeIndex, 'type', event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500">
                                {QUESTION_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
                              </select>
                            </td>
                            {['count', 'correct', 'wrong', 'partial'].map((field) => (
                              <td key={field} className="border border-slate-200 px-3 py-2">
                                {field === 'partial' && row.partialRules ? (
                                  <input
                                    type="text"
                                    value={partialMarksDisplay(row.partialRules) || '—'}
                                    readOnly
                                    title="Derived from the conditional partial-marking rules"
                                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-500 outline-none"
                                  />
                                ) : (
                                  <input type="number" step="any" min={field === 'count' ? 0 : undefined} value={row[field] ?? ''} disabled={Boolean(row.locks?.[field] || config.configurationFrozen)} onChange={(event) => updateType(section.id, typeIndex, field, event.target.value)} placeholder={field === 'partial' ? '—' : undefined} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500" />
                                )}
                              </td>
                            ))}
                            <td className="border border-slate-200 px-3 py-2">
                              <textarea
                                value={row.partialRules || ''}
                                disabled={Boolean(row.locks?.partialRules || config.configurationFrozen)}
                                onChange={(event) => updateType(section.id, typeIndex, 'partialRules', event.target.value)}
                                rows={3}
                                placeholder="—"
                                className="w-full min-w-[260px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                              />
                            </td>
                            <td className="border border-slate-200 px-3 py-2 text-center">
                              <button type="button" onClick={() => removeType(section.id, typeIndex)} disabled={section.types.length <= 1 || Boolean(row.locks?.type || config.configurationFrozen)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100">Remove</button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="7" className="border border-slate-200 px-3 py-5 text-center text-slate-500">No question-type data was available. Add a type below.</td></tr>
                        )}
                      </tbody>
                    </table>
                    <button type="button" onClick={() => addType(section.id)} disabled={Boolean(section.types.some((row) => row.locks?.type) || config.configurationFrozen)} className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">+ Add Question Type</button>
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <label className="text-sm font-semibold text-slate-700">Additional Instructions</label>
            <textarea value={config.additional} disabled={Boolean(config.fieldLocks?.additional || config.configurationFrozen)} onChange={(event) => updateField('additional', event.target.value)} rows={5} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" placeholder="Auto-filled from the QP when present. Add any missing instructions here." />
          </div>

          <div className="mt-8 flex justify-end">
            <button type="button" onClick={saveAndContinue} className="rounded-xl bg-[#080d1d] px-6 py-3 text-sm font-semibold text-white hover:bg-[#11182d]">Save & Continue →</button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showFinalConfirmation}
        title="Confirm Practice"
        message={`Do you want to practice ‘${pendingPractice?.qpName || config.testName || 'Question Paper'}’?`}
        onCancel={cancelFinalConfirmation}
        onConfirm={confirmFinalPractice}
        busy={authorizing}
      />

    </main>
  )
}

function typeLabel(type) {
  const labels = {
    MCQ: 'Multiple Choice Question (MCQ)',
    MSQ: 'Multiple Select Question (MSQ)',
    NAT: 'Numerical Answer Type (NAT)',
    MATCH: 'Match the Following',
    MATCH_MULTIPLE: 'Match the Following',
    MATRIX_SINGLE: 'Matrix Match (Single)',
    MATRIX_MULTI: 'Matrix Match (Multiple)',
    MATRIX_TEXT: 'Matrix Text',
    ORDERING: 'Ordering',
    RANKING: 'Ranking',
    TRUE_FALSE: 'True / False',
    YES_NO: 'Yes / No',
    DROPDOWN: 'Dropdown',
    TEXT_SHORT: 'Short Text',
    TEXT_LONG: 'Long Text',
    SUBJECTIVE: 'Subjective',
    FILL_BLANK: 'Fill in the Blank',
    ESSAY: 'Essay',
    IMAGE_CHOICE: 'Image Choice',
    IMAGE_MULTI_CHOICE: 'Image Multi Choice',
    HOTSPOT: 'Hotspot',
    HOTSPOT_MULTI: 'Hotspot Multi',
    DRAG_DROP: 'Drag & Drop',
    ANNOTATION: 'Annotation',
    CODE_OUTPUT: 'Code Output',
    CODE_TRACE: 'Code Trace',
    CODE_COMPLETION: 'Code Completion',
    CODE_EDITOR: 'Code Editor',
    EQUATION_INPUT: 'Equation Input',
    GRAPH_RESPONSE: 'Graph Response',
  }
  return labels[type] || type || 'Question'
}

function Field({ id, label, value, onChange, type = 'text', required = false, min, helperText, disabled = false }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        required={required}
        min={min}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-500 ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500 opacity-100' : 'bg-white'}`}
      />
      {helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  )
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-[#0b1020]">{value ?? 0}</div>
    </div>
  )
}

export default TestConfiguration
