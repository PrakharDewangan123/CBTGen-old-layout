
export default function UnsupportedQuestionType({ question }) {
  return (
    <div className="response-block" role="status">
      <strong>Response</strong>
      <div>
        This question type ({question?.type || 'UNKNOWN'}) is not yet supported for candidate input in CBTGen.
      </div>
    </div>
  )
}
