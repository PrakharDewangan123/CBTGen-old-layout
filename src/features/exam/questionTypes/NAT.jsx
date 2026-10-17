import { NumericResponse } from './QuestionTypePrimitives'

export default function NAT({ value, onChange }) {
  return <NumericResponse value={value} onChange={onChange} showKeypad />
}
