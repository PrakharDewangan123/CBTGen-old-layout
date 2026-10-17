import { textFromContent } from '../examEngine/examUtils'
import { ResponseBlock } from './QuestionTypePrimitives'

export default function Ordering({ question, value, onChange }) {
  const items = question.response?.items || []
  const current = Array.isArray(value) ? value : []
  return (
    <ResponseBlock>
      {items.map((item, index) => (
        <div className="match-row" key={item.id || index}>
          <span>{textFromContent(item.content) || item.text || item.label || item.id}</span>
          <select
            className="text-response"
            value={current[index] || ''}
            onChange={event => {
              const next = [...current]
              next[index] = event.target.value
              onChange(next)
            }}
          >
            <option value="">Position</option>
            {items.map((_, position) => <option key={position + 1} value={position + 1}>{position + 1}</option>)}
          </select>
        </div>
      ))}
    </ResponseBlock>
  )
}
