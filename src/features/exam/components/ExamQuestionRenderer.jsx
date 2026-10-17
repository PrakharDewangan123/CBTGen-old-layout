import { createElement } from 'react'
import { ContentBlocks } from './ContentRenderer'
import { getQuestionTypeRenderer } from '../questionTypes/questionTypeRegistry'

export function QuestionContent({ question }) {
  return <ContentBlocks content={question.content || {}} />
}

export function ResponseRenderer({ question, value, onChange }) {
  const renderer = getQuestionTypeRenderer(question.type)

  return createElement(renderer, {
    question,
    value,
    onChange,
  })
}
