import { ContentBlocks } from '../components/ContentRenderer'
import { textFromContent } from '../examEngine/examUtils'
import { ResponseBlock } from './QuestionTypePrimitives'

function hasRichContent(content) {
  return Boolean(
    Array.isArray(content?.blocks) && content.blocks.some((block) => block.type !== 'text')
  )
}

function MatchItemContent({ item }) {
  const content = item?.content || {}
  if (hasRichContent(content) || (Array.isArray(content.blocks) && content.blocks.length)) {
    return <ContentBlocks content={content} />
  }
  return <span>{textFromContent(content) || item?.text || item?.label || ''}</span>
}

export default function Match({ question, value, onChange }) {
  const match = question.response?.match || {}
  const left = match.leftItems || []
  const right = match.rightItems || []
  const mappings = value && typeof value === 'object' && !Array.isArray(value) ? value : {}

  return (
    <ResponseBlock>
      {right.length > 0 && right.some((item) => hasRichContent(item.content)) && (
        <div className="match-reference-panel" aria-label="Match options">
          <div className="match-reference-title">List-II / Options</div>
          <div className="match-reference-list">
            {right.map((target) => (
              <div className="match-reference-item" key={target.id}>
                <span className="match-reference-id">{target.id}.</span>
                <div className="match-reference-content">
                  <MatchItemContent item={target} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {left.map(item => (
        <div className="match-row" key={item.id}>
          <div className="match-left-content">
            <span className="match-item-id">{item.id}.</span>
            <div className="match-item-body">
              <MatchItemContent item={item} />
            </div>
          </div>
          <select
            className="text-response"
            value={mappings[item.id] || ''}
            onChange={event => onChange({ ...mappings, [item.id]: event.target.value })}
            aria-label={`Select match for ${item.id}`}
          >
            <option value="">Select</option>
            {right.map(target => (
              <option key={target.id} value={target.id}>
                {target.id}. {textFromContent(target.content) || target.text || target.label || 'Option'}
              </option>
            ))}
          </select>
        </div>
      ))}
    </ResponseBlock>
  )
}
