import { TextResponse } from './QuestionTypePrimitives'

const MULTILINE_TYPES = new Set(['TEXT_LONG', 'ESSAY', 'MATRIX_TEXT', 'SUBJECTIVE'])

export default function TextInput({ question, value, onChange }) {
  return <TextResponse value={value} onChange={onChange} multiline={MULTILINE_TYPES.has(question.type)} />
}
