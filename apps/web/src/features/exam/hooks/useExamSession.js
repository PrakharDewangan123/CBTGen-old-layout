import { useEffect, useState } from 'react'
import { cbtgenApi } from '../../../lib/api/cbtgenApi'
import { getPaper, getPaperForQuestionPaper, getSourcePaper } from '../../../lib/cbtgen/paperStorage'
import { readSessionJson, randomizePaper, enrichPaperWithPartialMarking } from '../examEngine/examSession'
import { resolvePaperAssetUrls, revokePaperAssetUrls } from '../../../lib/cbtgen/assetResolver'


function hydrateAssertionReasonFromXml(questions, xmlText) {
  if (!Array.isArray(questions) || typeof xmlText !== 'string' || !xmlText.trim()) return questions

  try {
    const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
    if (xml.querySelector('parsererror')) return questions

    const sourceById = new Map()
    xml.querySelectorAll('question[id]').forEach((questionNode) => {
      const id = questionNode.getAttribute('id')
      if (!id) return

      const assertionNode = questionNode.querySelector('content > assertion')
      const reasonNode = questionNode.querySelector('content > reason')
      const assertionText = assertionNode?.querySelector('text')?.textContent?.trim() || assertionNode?.textContent?.trim() || ''
      const reasonText = reasonNode?.querySelector('text')?.textContent?.trim() || reasonNode?.textContent?.trim() || ''

      if (assertionText || reasonText) {
        sourceById.set(id, { assertionText, reasonText })
      }
    })

    if (!sourceById.size) return questions

    return questions.map((question) => {
      const source = sourceById.get(question.sourceQuestionId)
      if (!source) return question

      const content = { ...(question.content || {}) }
      if (source.assertionText) content.assertion = { text: source.assertionText }
      if (source.reasonText) content.reason = { text: source.reasonText }

      return { ...question, content }
    })
  } catch {
    return questions
  }
}

export function useExamSession() {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [paper, setPaper] = useState(null)
  const [questionPaperMeta, setQuestionPaperMeta] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [config, setConfig] = useState(null)
  const [user, setUser] = useState(null)
  const [questions, setQuestions] = useState([])

  useEffect(() => {
    let cancelled = false
    let objectUrls = []

    async function load() {
      try {
        const session = readSessionJson('cbtgen_exam_state') || readSessionJson('cbtgen_active_session')
        const savedConfig = readSessionJson('cbtgen_test_configuration')
        if (!session?.sessionId || !session?.qpId) {
          throw new Error('No active examination session was found.')
        }

        const [userResult, qpResult] = await Promise.all([
          cbtgenApi.account.get(),
          cbtgenApi.questionPapers.get(session.qpId),
        ])

        if (!qpResult?.success || !qpResult.questionPaper) {
          throw new Error('The question paper metadata could not be loaded.')
        }

        let localPaper = await getPaperForQuestionPaper(qpResult.questionPaper)

        if (!localPaper?.paper && qpResult.questionPaper?.sourceId) {
          localPaper = await getSourcePaper(qpResult.questionPaper.sourceId, qpResult.questionPaper.userId)
        }

        if (!localPaper?.paper && qpResult.questionPaper?.fingerprint) {
          localPaper = await getPaper(qpResult.questionPaper.fingerprint, qpResult.questionPaper.userId)
        }

        if (!localPaper?.paper) {
          throw new Error('The local question-paper content is unavailable for this session.')
        }

        const resolvedAssets = resolvePaperAssetUrls(localPaper.paper, localPaper.assets || [])
        objectUrls = resolvedAssets.objectUrls
        const resolvedPaper = resolvedAssets.paper

        const randomized = randomizePaper(
          resolvedPaper,
          `${session.sessionId}:${qpResult.questionPaper.fingerprint}`,
        )

        if (!randomized.length) throw new Error('This question paper contains no questions.')
        if (cancelled) return

        const enrichedPaper = enrichPaperWithPartialMarking(resolvedPaper, localPaper.xmlText)
        const hydratedQuestions = randomized.map(question => {
          const source = enrichedPaper.questions?.find(item => item.sourceQuestionId === question.sourceQuestionId)
          return source ? { ...question, marking: source.marking } : question
        })
        const questionsWithStatements = hydrateAssertionReasonFromXml(hydratedQuestions, localPaper.xmlText)

        setUser(userResult?.user || null)
        setQuestionPaperMeta(qpResult.questionPaper)
        setActiveSession(session)
        setConfig(savedConfig)
        if (session.status === 'paused') setStatus('paused')
        setPaper(enrichedPaper)
        setQuestions(questionsWithStatements)
        setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load the examination.')
          setStatus('error')
        }
      }
    }

    load()
    return () => {
      cancelled = true
      revokePaperAssetUrls(objectUrls)
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready' || !activeSession) return undefined

    const onBeforeUnload = event => {
      event.preventDefault()
      event.returnValue = ''
    }

    const onVisibility = () => {
      try {
        const key = 'cbtgen_exam_visibility_events'
        const events = JSON.parse(sessionStorage.getItem(key) || '[]')
        events.push({ sessionId: activeSession.sessionId, at: new Date().toISOString(), hidden: document.hidden })
        sessionStorage.setItem(key, JSON.stringify(events.slice(-100)))
      } catch {
        // Diagnostics are best-effort only.
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, activeSession])

  return {
    status,
    setStatus,
    error,
    setError,
    paper,
    questionPaperMeta,
    activeSession,
    config,
    user,
    questions,
  }
}
