import { NumericResponse } from './QuestionTypePrimitives'

export default function NumericRange({ value, onChange }) {
  return <NumericResponse value={value} onChange={onChange} placeholder="Enter your answer" />
}
