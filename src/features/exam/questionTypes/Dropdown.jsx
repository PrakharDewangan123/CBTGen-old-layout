import { optionLabel, textFromContent } from '../examEngine/examUtils'
import { ResponseBlock } from './QuestionTypePrimitives'

export default function Dropdown({ question, value, onChange }) {
  const options = question.response?.options || []
  return (
    <ResponseBlock>
      <select className="text-response" value={value ?? ''} onChange={event => onChange(event.target.value)}>
        <option value="">Select an option</option>
        {options.map((option, index) => (
          <option value={option.id} key={option.id}>
            {optionLabel(option, index)}. {textFromContent(option.content)}
          </option>
        ))}
      </select>
    </ResponseBlock>
  )
}
