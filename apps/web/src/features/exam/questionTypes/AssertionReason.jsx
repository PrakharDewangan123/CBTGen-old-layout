import { ChoiceResponse, ResponseBlock } from './QuestionTypePrimitives'

function statementText(statement) {
  if (!statement) return ''
  if (typeof statement === 'string') return statement
  return statement.text || ''
}

export default function AssertionReason({ question, value, onChange }) {
  const assertion = statementText(question?.content?.assertion)
  const reason = statementText(question?.content?.reason)
  const options = question?.response?.options || []

  return (
    <ResponseBlock>
      <div className="assertion-reason">
        <div className="assertion-reason-statement">
          <strong>Assertion (A)</strong>
          <p>{assertion || 'Assertion text is not supplied in the question paper.'}</p>
        </div>
        <div className="assertion-reason-statement">
          <strong>Reason (R)</strong>
          <p>{reason || 'Reason text is not supplied in the question paper.'}</p>
        </div>
      </div>

      {options.length > 0 ? (
        <ChoiceResponse question={question} value={value} onChange={onChange} withResponseBlock={false} />
      ) : (
        <div className="response-not-available">
          The question paper does not provide answer choices for this Assertion-Reason question.
        </div>
      )}
    </ResponseBlock>
  )
}
