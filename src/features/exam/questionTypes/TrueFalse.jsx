import { ChoiceResponse } from './QuestionTypePrimitives'

export default function TrueFalse({ question, value, onChange }) {
  return <ChoiceResponse question={question} value={value} onChange={onChange} />
}
