import { ChoiceResponse } from './QuestionTypePrimitives'

export default function MCQ({ question, value, onChange }) {
  return <ChoiceResponse question={question} value={value} onChange={onChange} />
}
