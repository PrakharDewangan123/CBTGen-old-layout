import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import { saveRuntime, setExamMode, requestExamFullscreen } from '../examEngine/examRuntime'
import {
  loadTestConfiguration,
  normalizeTypeRow,
} from '../services/testConfigurationService'

function frozenConfigurationKey(qpId) {
  return `cbtgen_frozen_configuration_${String(qpId || '')}`
}

export function useTestConfiguration() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [localPaperAvailable, setLocalPaperAvailable] = useState(false)
  const [pendingPractice, setPendingPractice] = useState(null)
  const [confirmedConfig, setConfirmedConfig] = useState(null)
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false)
  const [authorizing, setAuthorizing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const rawPendingPractice = sessionStorage.getItem('cbtgen_pending_practice')
        if (!rawPendingPractice) throw new Error('No pending practice confirmation was found.')

        const pending = JSON.parse(rawPendingPractice)
        if (!pending?.qpId) throw new Error('The pending practice request is invalid.')

        const result = await cbtgenApi.questionPapers.get(pending.qpId)
        if (!result?.success || !result.questionPaper) {
          throw new Error(result?.message || 'Unable to load the question paper.')
        }

        const loaded = await loadTestConfiguration(result.questionPaper)
        if (cancelled) return

        let effectiveConfig = loaded.config
        try {
          const frozenRaw = localStorage.getItem(frozenConfigurationKey(pending.qpId))
          if (frozenRaw) {
            const frozen = JSON.parse(frozenRaw)
            if (frozen && frozen.configurationFrozen === true) effectiveConfig = frozen
          }
        } catch (freezeReadError) {
          console.warn('Unable to read frozen CBTGen configuration:', freezeReadError)
        }

        setLocalPaperAvailable(loaded.localPaperAvailable)
        setPendingPractice(pending)
        setConfig(effectiveConfig)
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setError(err?.message || 'Unable to load test configuration.')
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  function updateField(field, value) {
    setConfig((current) => {
      if (!current || current.configurationFrozen || current.fieldLocks?.[field]) return current
      return { ...current, [field]: value }
    })
  }

  function updateSubject(subjectIndex, value) {
    setConfig((current) => {
      if (current.configurationFrozen || current.subjects[subjectIndex]?.locks?.name) return current
      const subjects = current.subjects.map((subject, index) =>
        index === subjectIndex ? { ...subject, name: value } : subject,
      )
      const sections = current.sections.map((section) => {
        const subject = subjects.find((item) => item.sections.includes(section.id))
        return subject ? { ...section, subjectId: subject.id, subjectName: subject.name } : section
      })
      return { ...current, subject: subjects[0]?.name || '', subjects, sections }
    })
  }

  function addSubject() {
    setConfig((current) => ({
      ...current,
      subjects: [...current.subjects, { id: `subject-${Date.now()}`, name: `Subject ${current.subjects.length + 1}`, sections: [] }],
    }))
  }

  function removeSubject(subjectIndex) {
    setConfig((current) => {
      if (current.subjects.length <= 1) return current
      const subject = current.subjects[subjectIndex]
      const remainingSubjects = current.subjects.filter((_, index) => index !== subjectIndex)
      const sections = current.sections.map((section) => {
        if (!subject.sections.includes(section.id)) return section
        const fallback = remainingSubjects[0]
        return fallback ? { ...section, subjectId: fallback.id, subjectName: fallback.name } : section
      })
      const subjects = remainingSubjects.map((item) => ({
        ...item,
        sections: sections.filter((section) => section.subjectId === item.id).map((section) => section.id),
      }))
      return { ...current, subject: subjects[0]?.name || '', subjects, sections }
    })
  }

  function updateSection(sectionId, field, value) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section
        if (current.configurationFrozen || section.locks?.[field]) return section
        return { ...section, [field]: value }
      }),
    }))
  }

  function moveSectionToSubject(sectionId, subjectId) {
    setConfig((current) => {
      const subject = current.subjects.find((item) => item.id === subjectId)
      if (!subject) return current
      const sections = current.sections.map((section) => section.id === sectionId ? { ...section, subjectId: subject.id, subjectName: subject.name } : section)
      const subjects = current.subjects.map((item) => ({ ...item, sections: sections.filter((section) => section.subjectId === item.id).map((section) => section.id) }))
      return { ...current, subjects, sections }
    })
  }

  function updateType(sectionId, typeIndex, field, value) {
    setConfig((current) => ({
      ...current,
      sections: current.sections.map((section) => section.id !== sectionId ? section : ({
        ...section,
        types: section.types.map((row, index) => {
          if (index !== typeIndex) return row
          if (current.configurationFrozen || row.locks?.[field]) return row
          return { ...row, [field]: field === 'type' || field === 'partialRules' ? value : (value === '' ? '' : (Number.isFinite(Number(value)) ? Number(value) : '')) }
        }),
      })),
    }))
  }

  function addType(sectionId) {
    setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, types: [...(section.types || []), { type: 'MCQ', count: 0, correct: 1, wrong: 0, partial: '', partialRules: '' }] } : section) }))
  }

  function removeType(sectionId, typeIndex) {
    setConfig((current) => ({ ...current, sections: current.sections.map((section) => section.id !== sectionId || section.types.length <= 1 ? section : { ...section, types: section.types.filter((_, index) => index !== typeIndex) }) }))
  }

  function addSection(subjectId) {
    setConfig((current) => {
      const subject = current.subjects.find((item) => item.id === subjectId)
      if (!subject) return current
      const id = `section-${Date.now()}`
      const section = { id, name: `Section ${String.fromCharCode(65 + current.sections.length)}`, subjectId, subjectName: subject.name, declaredQuestionCount: 0, declaredMarks: 0, types: [{ type: 'MCQ', count: 0, correct: 1, wrong: 0, partial: '', partialRules: '' }] }
      return { ...current, sections: [...current.sections, section], subjects: current.subjects.map((item) => item.id === subjectId ? { ...item, sections: [...item.sections, id] } : item) }
    })
  }

  function removeSection(sectionId) {
    setConfig((current) => {
      if (current.sections.length <= 1) return current
      const sections = current.sections.filter((section) => section.id !== sectionId)
      const subjects = current.subjects.map((subject) => ({ ...subject, sections: subject.sections.filter((id) => id !== sectionId) }))
      return { ...current, sections, subjects }
    })
  }

  function scrollToRequiredField(targetId) {
    requestAnimationFrame(() => {
      const element = document.getElementById(targetId)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (typeof element.focus === 'function') element.focus({ preventScroll: true })
    })
  }

  function saveAndContinue() {
    if (!config?.testName?.trim()) { setError('Test Name is required.'); scrollToRequiredField('test-name-field'); return }
    if (!config?.subject?.trim()) { setError('Subject is required.'); scrollToRequiredField('subject-field'); return }
    if (config?.duration === '' || config?.duration == null || Number(config.duration) <= 0) { setError('Duration (minutes) is required and must be greater than zero.'); scrollToRequiredField('duration-field'); return }
    if (!config?.sections?.length) { setError('At least one section is required.'); scrollToRequiredField('sections-config'); return }

    const sections = config.sections.map((section) => ({ ...section, types: (section.types || []).map(normalizeTypeRow) }))
    const questionCount = sections.reduce((sum, section) => sum + section.types.reduce((sectionSum, row) => sectionSum + Math.max(0, Number(row.count) || 0), 0), 0)
    const derivedMaxMarks = sections.reduce((sum, section) => sum + section.types.reduce((sectionSum, row) => sectionSum + Math.max(0, Number(row.count) || 0) * (Number(row.correct) || 0), 0), 0)
    const subjects = config.subjects.map((subject) => ({ ...subject, sections: sections.filter((section) => section.subjectId === subject.id).map((section) => section.id) }))
    const finalConfig = { ...config, subject: subjects[0]?.name || config.subject || '', subjects, sections, totalQuestions: questionCount > 0 ? questionCount : config.totalQuestions, maxMarks: config.maxMarks > 0 ? config.maxMarks : derivedMaxMarks }

    sessionStorage.setItem('cbtgen_test_configuration', JSON.stringify(finalConfig))

    const authorizationRequestId = pendingPractice?.authorizationRequestId || `practice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const nextPendingPractice = { ...pendingPractice, authorizationRequestId }

    setPendingPractice(nextPendingPractice)
    setConfirmedConfig(finalConfig)
    sessionStorage.setItem('cbtgen_pending_practice', JSON.stringify(nextPendingPractice))
    setConfig(finalConfig)
    setError('')
    setShowFinalConfirmation(true)
  }

  function cancelFinalConfirmation() {
    if (authorizing) return
    setShowFinalConfirmation(false)
  }

  async function confirmFinalPractice() {
    if (!pendingPractice || authorizing) return

    const authorizationRequestId = pendingPractice.authorizationRequestId
    const configurationForSession = confirmedConfig || (() => {
      try {
        const stored = sessionStorage.getItem('cbtgen_test_configuration')
        return stored ? JSON.parse(stored) : null
      } catch {
        return null
      }
    })()

    if (!authorizationRequestId) {
      setError('Practice authorization is not ready. Please save the configuration again.')
      return
    }

    if (!configurationForSession) {
      setError('The saved test configuration could not be recovered. Please save the configuration again.')
      return
    }

    setAuthorizing(true)
    setError('')

    try {
      const result = await cbtgenApi.questionPapers.authorizePractice(
        pendingPractice.qpId,
        authorizationRequestId,
      )

      if (!result?.success || !result.session) {
        throw new Error(result?.message || 'Unable to authorize practice.')
      }

      const frozenConfiguration = {
        ...configurationForSession,
        configurationFrozen: true,
        configVersion: configurationForSession.configVersion || `config-${Date.now()}`,
        frozenAt: new Date().toISOString(),
      }
      const sessionWithConfiguration = {
        ...result.session,
        testConfiguration: frozenConfiguration,
      }

      try {
        localStorage.setItem(
          frozenConfigurationKey(pendingPractice.qpId),
          JSON.stringify(frozenConfiguration),
        )
      } catch (freezeWriteError) {
        console.warn('Unable to persist frozen CBTGen configuration:', freezeWriteError)
      }

      sessionStorage.setItem(
        'cbtgen_active_session',
        JSON.stringify(sessionWithConfiguration),
      )

      sessionStorage.setItem(
        'cbtgen_active_usage',
        JSON.stringify(result.usage || {}),
      )

      // Persist the final configuration with the authoritative practice
      // session as well as sessionStorage/runtime. This prevents the
      // Login -> Instructions transition from losing a customized config
      // if the transient browser state is cleared or replaced.
      try {
        await cbtgenApi.questionPapers.updateSessionStatus(
          result.session.id,
          result.session.status || 'created',
          {
            testConfiguration: frozenConfiguration,
            configurationSavedAt: new Date().toISOString(),
          },
        )
      } catch (configurationError) {
        console.warn('Unable to persist test configuration on the practice session:', configurationError)
      }

      saveRuntime({
        sessionId: result.session.id,
        qpId: result.session.qpId,
        config: frozenConfiguration,
        answers: {},
        review: {},
        visited: [],
        curIndex: 0,
        questionTiming: {},
        savedAt: new Date().toISOString(),
      })
      setExamMode('active')
      await requestExamFullscreen()

      sessionStorage.removeItem('cbtgen_pending_practice')
      sessionStorage.removeItem('cbtgen_exam_login')
      sessionStorage.removeItem('cbtgen_exam_state')
      sessionStorage.removeItem('cbtgen_test_started_at')

      setShowFinalConfirmation(false)
      navigate('/exam-login')
    } catch (err) {
      console.error('Practice authorization failed:', err)
      setError(err?.message || 'Unable to authorize practice. Please try again.')
    } finally {
      setAuthorizing(false)
    }
  }


  return { config, error, setError, localPaperAvailable, pendingPractice, showFinalConfirmation, authorizing, updateField, updateSubject, addSubject, removeSubject, updateSection, moveSectionToSubject, updateType, addType, removeType, addSection, removeSection, saveAndContinue, cancelFinalConfirmation, confirmFinalPractice }
}
