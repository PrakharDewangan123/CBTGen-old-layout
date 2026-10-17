import { ChoiceResponse } from './QuestionTypePrimitives'

export default function MSQ({ question, value, onChange }) {
  return <ChoiceResponse question={question} value={value} onChange={onChange} multi />
}
