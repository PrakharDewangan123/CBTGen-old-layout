import { useMemo, useState } from 'react'
import { getSectionIdForQuestion, getCounts, shortenSectionName, extractSubjectName } from '../examEngine/examUtils'

export function useExamViewModel({ paper, questions, answers, review, visited, questionPaperMeta, curIndex }) {
  const current = questions[curIndex] || null
  const [activeSection, setActiveSection] = useState('')

  const sections = useMemo(() => {
    if (!paper) return []
    const paperSections = Array.isArray(paper.sections) ? paper.sections : []
    if (paperSections.length) {
      return paperSections.map((section, index) => ({
        id: section.id || `section-${index + 1}`,
        name: section.name || `Section ${index + 1}`,
        short: shortenSectionName(section.name || `Section ${index + 1}`),
        subject: String(section.subject || section.category || extractSubjectName(section.name || '') || '').trim(),
      }))
    }
    const ids = [...new Set(questions.map(getSectionIdForQuestion))]
    return ids.map((id, index) => ({
      id,
      name: id === '__default__' ? `Section ${index + 1}` : id,
      short: id === '__default__' ? `Section ${index + 1}` : id,
    }))
  }, [paper, questions])

  const currentSectionId = current ? getSectionIdForQuestion(current) : ''
  const effectiveActiveSection = currentSectionId || activeSection

  const currentSection = sections.find(section => section.id === effectiveActiveSection) || sections[0] || null
  const sectionQuestions = useMemo(
    () => questions.filter(question => getSectionIdForQuestion(question) === currentSection?.id),
    [questions, currentSection],
  )

  const counts = useMemo(() => getCounts(sectionQuestions, answers, review, visited), [sectionQuestions, answers, review, visited])

  const countsBySection = useMemo(() => {
    const result = {}
    sections.forEach(section => {
      result[section.id] = getCounts(
        questions.filter(question => getSectionIdForQuestion(question) === section.id),
        answers,
        review,
        visited,
      )
    })
    return result
  }, [sections, questions, answers, review, visited])

  const subjectGroups = useMemo(() => {
    const groups = []
    const seen = new Set()
    sections.forEach(section => {
      const name = String(section.subject || section.category || extractSubjectName(section.name) || '').trim()
      if (!name || seen.has(name)) return
      seen.add(name)
      groups.push({ id: `subject-${groups.length + 1}`, name, firstSectionId: section.id })
    })
    if (!groups.length) {
      const fallback = questionPaperMeta?.category || paper?.exam?.name || 'Imported'
      groups.push({ id: 'subject-1', name: fallback, firstSectionId: sections[0]?.id })
    }
    return groups
  }, [sections, questionPaperMeta, paper])

  const countsBySubject = useMemo(() => {
    const result = {}
    subjectGroups.forEach(subject => {
      const subjectQuestions = questions.filter(question => {
        const section = sections.find(item => item.id === getSectionIdForQuestion(question))
        const name = String(section?.subject || extractSubjectName(section?.name || '') || '').trim()
        return name === subject.name
      })
      result[subject.id] = getCounts(subjectQuestions, answers, review, visited)
    })
    return result
  }, [subjectGroups, sections, questions, answers, review, visited])

  const activeSubjectName = extractSubjectName(currentSection?.name || '') || subjectGroups[0]?.name || 'Imported'
  const activeSubject = subjectGroups.find(subject => subject.name === activeSubjectName) || subjectGroups[0] || null
  const activeSubjectSections = useMemo(() => {
    if (!activeSubject) return sections
    return sections.filter(section => String(section.subject || extractSubjectName(section.name || '') || '').trim() === activeSubject.name)
  }, [sections, activeSubject])

  return {
    current,
    sections,
    activeSection: effectiveActiveSection,
    setActiveSection,
    currentSection,
    sectionQuestions,
    counts,
    countsBySection,
    subjectGroups,
    countsBySubject,
    activeSubjectName,
    activeSubjectSections,
  }
}
