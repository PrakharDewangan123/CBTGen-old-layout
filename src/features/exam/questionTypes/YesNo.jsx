import { ChoiceResponse } from './QuestionTypePrimitives'

export default function YesNo({ question, value, onChange }) {
  return <ChoiceResponse question={question} value={value} onChange={onChange} />
}
